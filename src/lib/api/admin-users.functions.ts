import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  assertUserManagedByActor,
  resolveActorOrganizationId,
  resolveTenantListScope,
} from "@/lib/access/tenant-admin.server";
import { APP_ROLES, type AppRole } from "@/lib/auth/roles";
import { registerUser, setUserRole as setUserRoleDb } from "@/lib/auth/server";
import { requireModuleAccess } from "./_helpers";

const ASSIGNABLE_ROLES = [...APP_ROLES] as const;

function isPlatformRole(role: AppRole): boolean {
  return role === "platform_admin";
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "admin_users", { action: "read" });
    const scope = await resolveTenantListScope(
      supabaseAdmin,
      context.userId,
      context.organizationId,
    );

    let query = supabaseAdmin
      .from("profiles")
      .select(
        "id, email, full_name_ru, full_name_kk, iin, auth_method, position_ru, position_kk, department_id, access_level_id, created_at, ref_access_levels!profiles_access_level_id_fkey(id, code, name_ru, name_kk, level_order)",
      )
      .order("full_name_ru", { ascending: true });

    if (!scope.platformWide && scope.organizationId) {
      query = query.eq("organization_id", scope.organizationId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const userIds = (data ?? []).map((u) => u.id);
    const roleMap = new Map<string, string[]>();
    if (userIds.length > 0) {
      const { data: roles, error: rolesErr } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);
      if (rolesErr) throw new Error(rolesErr.message);
      (roles ?? []).forEach((r) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });
    }

    return (data ?? []).map((u) => ({ ...u, roles: roleMap.get(u.id) ?? [] }));
  });

export const setUserAccessLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      user_id: z.string().uuid(),
      access_level_id: z.string().uuid().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "admin_users", { action: "write" });
    await assertUserManagedByActor(
      supabaseAdmin,
      context.userId,
      data.user_id,
      context.organizationId,
    );

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ access_level_id: data.access_level_id } as never)
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(ASSIGNABLE_ROLES),
      enabled: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "admin_users", { action: "write" });

    if (isPlatformRole(data.role)) {
      await requireModuleAccess(supabaseAdmin, context.userId, "admin_platform", {
        action: "manage",
      });
    } else {
      await assertUserManagedByActor(
        supabaseAdmin,
        context.userId,
        data.user_id,
        context.organizationId,
      );
    }

    if (data.enabled && isPlatformRole(data.role)) {
      const { data: targetProfile, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .select("organization_id")
        .eq("id", data.user_id)
        .maybeSingle();
      if (profileErr) throw new Error(profileErr.message);
      if (!targetProfile?.organization_id) {
        throw new Error("Пользователь не привязан к организации");
      }

      const { data: primaryOrg } = await supabaseAdmin
        .from("organization")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (
        primaryOrg?.id &&
        (targetProfile as { organization_id: string }).organization_id !== primaryOrg.id
      ) {
        throw new Error(
          "Роль администратора платформы назначается только пользователям primary-организации",
        );
      }
    }

    await setUserRoleDb(data.user_id, data.role, data.enabled);
    return { ok: true };
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      email: z.string().email(),
      full_name_ru: z.string().optional().default(""),
      full_name_kk: z.string().optional().default(""),
      password: z.string().min(8).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "admin_users", {
      action: "write",
      seats: true,
    });

    const password = data.password ?? `${crypto.randomUUID()}Aa1!`;
    const fallbackName = data.email.split("@")[0] || data.email;
    const full_name_ru = data.full_name_ru.trim() || fallbackName;
    const full_name_kk = data.full_name_kk.trim() || fallbackName;

    const { loadSystemSettings } = await import("@/lib/auth/policy");
    const defaultLocale = (await loadSystemSettings()).general.default_locale;

    const actorOrgId = await resolveActorOrganizationId(
      supabaseAdmin,
      context.userId,
      context.organizationId,
    );
    if (!actorOrgId) {
      throw new Error("Организация не определена — невозможно создать пользователя");
    }

    const newUserId = await registerUser({
      email: data.email,
      password,
      full_name_ru,
      full_name_kk,
      locale: defaultLocale,
      auth_method: "email",
      organization_id: actorOrgId,
    });

    return { id: newUserId, email: data.email };
  });

export const adminResetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      user_id: z.string().uuid(),
      password: z.string().min(8),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "admin_users", { action: "write" });
    await assertUserManagedByActor(
      supabaseAdmin,
      context.userId,
      data.user_id,
      context.organizationId,
    );

    const { loadSystemSettings, validatePassword } = await import("@/lib/auth/policy");
    const pwdErr = validatePassword(data.password, (await loadSystemSettings()).auth);
    if (pwdErr) throw new Error(pwdErr);

    const { data: target, error: loadErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", data.user_id)
      .maybeSingle();

    if (loadErr) throw new Error(loadErr.message);
    if (!target) throw new Error("Пользователь не найден");

    const { error } = await supabaseAdmin.rpc(
      "change_app_user_password" as never,
      {
        p_user_id: data.user_id,
        p_new_password: data.password,
      } as never,
    );
    if (error) throw new Error(error.message);

    return { ok: true };
  });
