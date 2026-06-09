import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { upsertRow } from "@/lib/api/db.helpers.server";
import {
  assertUserManagedByActor,
  resolveActorOrganizationId,
  resolveTenantListScope,
} from "@/lib/access/tenant-admin.server";
import { APP_ROLES, type AppRole } from "@/lib/auth/roles";
import {
  fetchProfileById,
  fetchUserRoles,
  mapProfileRow,
  registerUser,
  setUserRole as setUserRoleDb,
} from "@/lib/auth/server";
import {
  fetchUserPermissions,
  requireAnyPermission,
  requireModuleAccess,
} from "./_helpers";
import { buildTemplateAuthorDefaultsForUser } from "@/lib/templates/author-defaults.server";

const ASSIGNABLE_ROLES = [...APP_ROLES] as const;

function isPlatformRole(role: AppRole): boolean {
  return role === "platform_admin";
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const profileData = await fetchProfileById(userId);
    if (!profileData) throw new Error("Профиль пользователя не найден");

    const userRoles = await fetchUserRoles(userId);
    const permissions = await fetchUserPermissions(supabaseAdmin, userId);

    const mapped = mapProfileRow(profileData, userRoles);
    const template_defaults = await buildTemplateAuthorDefaultsForUser(userId);

    return {
      profile: mapped.profile,
      roles: mapped.roles,
      permissions,
      template_defaults,
    };
  });

export const getUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ user_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const isSelf = data.user_id === context.userId;
    if (!isSelf) {
      await requireModuleAccess(supabaseAdmin, context.userId, "admin_users", { action: "read" });
      await assertUserManagedByActor(
        supabaseAdmin,
        context.userId,
        data.user_id,
        context.organizationId,
      );
    }

    const profileData = await fetchProfileById(data.user_id);
    if (!profileData) throw new Error("Профиль пользователя не найден");

    const userRoles = await fetchUserRoles(data.user_id);
    return mapProfileRow(profileData, userRoles);
  });

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

export const listDepartments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("departments")
      .select("*")
      .order("code", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      parent_id: z.string().uuid().nullable().optional(),
      code: z.string().min(1).max(64),
      name_ru: z.string().min(1),
      name_kk: z.string().min(1),
      kind: z.string().max(32).optional(),
      phone: z.string().max(64).optional(),
      email: z.string().max(255).optional(),
      head_user_id: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "admin_org", { action: "write" });
    const { supabase } = context;
    const row = await upsertRow({
      supabase,
      table: "departments",
      row: data,
      id: data.id,
    });
    return { id: String(row.id) };
  });

// ============ DESIGNER HELPERS ============

export const listUsersBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAnyPermission(supabaseAdmin, context.userId, [
      "manage_hr",
      "manage_schedules",
      "manage_users",
      "manage_org",
      "manage_workflows",
    ]);

    const scope = await resolveTenantListScope(
      supabaseAdmin,
      context.userId,
      context.organizationId,
    );

    let query = supabaseAdmin
      .from("profiles")
      .select("id, full_name_ru, full_name_kk, email, department_id, position_id")
      .order("full_name_ru", { ascending: true });

    if (!scope.platformWide && scope.organizationId) {
      query = query.eq("organization_id", scope.organizationId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listDepartmentsBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("departments")
      .select("id, code, name_ru, name_kk, head_user_id, parent_id")
      .order("code", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listRolesBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("roles")
      .select("code, name_ru, name_kk")
      .eq("is_active", true)
      .order("code", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      role: r.code,
      title_ru: r.name_ru,
      title_kk: r.name_kk,
    }));
  });

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ entity_type: z.string().optional(), entity_id: z.string().optional(), limit: z.number().max(500).default(100) }).optional())
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "audit", { action: "read" });
    let q = context.supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data?.limit ?? 100);
    if (data?.entity_type) q = q.eq("entity_type", data.entity_type);
    if (data?.entity_id) q = q.eq("entity_id", data.entity_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const actorIds = Array.from(
      new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean) as string[]),
    );
    const profileMap = new Map<string, { full_name_ru: string | null; email: string }>();
    if (actorIds.length > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, full_name_ru, email")
        .in("id", actorIds);
      (profs ?? []).forEach((p) =>
        profileMap.set(p.id, { full_name_ru: p.full_name_ru, email: p.email }),
      );
    }

    return (rows ?? []).map((r) => ({
      ...r,
      actor: r.actor_id ? profileMap.get(r.actor_id) ?? null : null,
    }));
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() } as never)
      .eq("user_id", context.userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============== ROLES V2 (RBAC matrix) ==============
export const listPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireModuleAccess(context.supabase, context.userId, "admin_roles", { action: "read" });
    const { data, error } = await context.supabase
      .from("permissions")
      .select("*")
      .order("category", { ascending: true })
      .order("code", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listRolesV2 = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireModuleAccess(context.supabase, context.userId, "admin_roles", { action: "read" });
    const [roles, perms] = await Promise.all([
      context.supabase.from("roles").select("*").order("code", { ascending: true }),
      context.supabase.from("role_permissions").select("role_id, permission_code"),
    ]);
    if (roles.error) throw new Error(roles.error.message);
    if (perms.error) throw new Error(perms.error.message);
    const map = new Map<string, string[]>();
    (perms.data ?? []).forEach((rp) => {
      const arr = map.get(rp.role_id) ?? [];
      arr.push(rp.permission_code);
      map.set(rp.role_id, arr);
    });
    return (roles.data ?? []).map((r) => ({ ...r, permission_codes: map.get(r.id) ?? [] }));
  });

export const upsertRoleV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      code: z.string().min(2).max(64).regex(/^[a-z0-9_]+$/),
      name_ru: z.string().min(1).max(255),
      name_kk: z.string().min(1).max(255),
      description: z.string().max(2000).optional().default(""),
      kind: z.enum(["system", "org", "department", "temporary"]).default("org"),
      parent_role_id: z.string().uuid().nullable().optional(),
      scope_department_id: z.string().uuid().nullable().optional(),
      is_active: z.boolean().default(true),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "admin_roles", { action: "manage" });
    const { id, ...patch } = data;
    const row = await upsertRow({
      supabase: context.supabase,
      table: "roles",
      row: patch,
      id,
    });
    return { id: String(row.id) };
  });

export const setRolePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      role_id: z.string().uuid(),
      permission_codes: z.array(z.string().min(1).max(64)).max(100),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "admin_roles", { action: "manage" });
    const { supabase } = context;
    const { error: delErr } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", data.role_id);
    if (delErr) throw new Error(delErr.message);
    if (data.permission_codes.length > 0) {
      const rows = data.permission_codes.map((p) => ({
        role_id: data.role_id,
        permission_code: p,
      }));
      const { error } = await supabase.from("role_permissions").insert(rows as never);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const listRoleGrants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ role_id: z.string().uuid().optional() }).optional())
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "admin_roles", { action: "read" });
    let q = context.supabase
      .from("user_role_grants")
      .select("*, roles(code, name_ru)")
      .order("granted_at", { ascending: false })
      .limit(500);
    if (data?.role_id) q = q.eq("role_id", data.role_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    let profilesMap = new Map<string, { full_name_ru: string | null; email: string }>();
    if (userIds.length > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, full_name_ru, email")
        .in("id", userIds);
      (profs ?? []).forEach((p) => profilesMap.set(p.id, { full_name_ru: p.full_name_ru, email: p.email }));
    }
    return (rows ?? []).map((r) => ({ ...r, profile: profilesMap.get(r.user_id) ?? null }));
  });


export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      user_id: z.string().uuid(),
      role_id: z.string().uuid(),
      scope_department_id: z.string().uuid().nullable().optional(),
      expires_at: z.string().datetime().nullable().optional(),
      reason: z.string().max(500).optional().default(""),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "admin_users", { action: "write" });
    await assertUserManagedByActor(
      context.supabase,
      context.userId,
      data.user_id,
      context.organizationId,
    );

    const { data: row, error } = await context.supabase
      .from("user_role_grants")
      .insert({
        user_id: data.user_id,
        role_id: data.role_id,
        scope_department_id: data.scope_department_id ?? null,
        expires_at: data.expires_at ?? null,
        reason: data.reason ?? "",
        granted_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const revokeRoleGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ grant_id: z.string().uuid(), reason: z.string().max(500).optional() }))
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "admin_users", { action: "write" });

    const { data: grant, error: grantErr } = await context.supabase
      .from("user_role_grants")
      .select("user_id")
      .eq("id", data.grant_id)
      .maybeSingle();
    if (grantErr) throw new Error(grantErr.message);
    if (!grant?.user_id) throw new Error("Назначение роли не найдено");

    await assertUserManagedByActor(
      context.supabase,
      context.userId,
      grant.user_id,
      context.organizationId,
    );

    const { error } = await context.supabase
      .from("user_role_grants")
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: context.userId,
        reason: data.reason ?? null,
      } as never)
      .eq("id", data.grant_id);
    if (error) throw new Error(error.message);
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

    const { error } = await supabaseAdmin.rpc("change_app_user_password" as never, {
      p_user_id: data.user_id,
      p_new_password: data.password,
    } as never);
    if (error) throw new Error(error.message);

    return { ok: true };
  });