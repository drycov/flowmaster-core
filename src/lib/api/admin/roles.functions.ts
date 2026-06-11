import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { upsertRow } from "@/lib/api/db.helpers.server";
import { assertUserManagedByActor } from "@/lib/access/tenant-admin.server";
import { requireModuleAccess } from "../_helpers";

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
      code: z
        .string()
        .min(2)
        .max(64)
        .regex(/^[a-z0-9_]+$/),
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
    await requireModuleAccess(context.supabase, context.userId, "admin_roles", {
      action: "manage",
    });
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
    await requireModuleAccess(context.supabase, context.userId, "admin_roles", {
      action: "manage",
    });
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
    const profilesMap = new Map<string, { full_name_ru: string | null; email: string }>();
    if (userIds.length > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, full_name_ru, email")
        .in("id", userIds);
      (profs ?? []).forEach((p) =>
        profilesMap.set(p.id, { full_name_ru: p.full_name_ru, email: p.email }),
      );
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
