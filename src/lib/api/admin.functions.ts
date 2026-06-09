import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ALL_PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import {
  fetchProfileById,
  fetchUserRoles,
  mapProfileRow,
  registerUser,
  setUserRole as setUserRoleDb,
} from "@/lib/auth/server";
import { fetchUserPermissions, requireAnyPermission, requirePermission } from "./_helpers";
import { buildTemplateAuthorDefaultsForUser } from "@/lib/templates/author-defaults.server";

function adminPermissions(): Record<Permission, boolean> {
  return Object.fromEntries(ALL_PERMISSIONS.map((p) => [p, true])) as Record<Permission, boolean>;
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const profileData = await fetchProfileById(userId);
    if (!profileData) throw new Error("Профиль пользователя не найден");

    const userRoles = await fetchUserRoles(userId);
    const permissions = userRoles.includes("admin")
      ? adminPermissions()
      : await fetchUserPermissions(supabaseAdmin, userId);

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
      await requirePermission(supabaseAdmin, context.userId, "manage_users");
    }

    const profileData = await fetchProfileById(data.user_id);
    if (!profileData) throw new Error("Профиль пользователя не найден");

    const userRoles = await fetchUserRoles(data.user_id);
    return mapProfileRow(profileData, userRoles);
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePermission(supabaseAdmin, context.userId, "manage_users");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name_ru, full_name_kk, position_ru, position_kk, department_id, created_at")
      .order("full_name_ru", { ascending: true });
    if (error) throw new Error(error.message);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });
    return (data ?? []).map((u) => ({ ...u, roles: roleMap.get(u.id) ?? [] }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(["admin", "registrar", "approver", "signer", "archivist", "viewer"]),
      enabled: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requirePermission(supabaseAdmin, context.userId, "manage_users");
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
    await requirePermission(context.supabase, context.userId, "manage_org");
    const { supabase } = context;
    if (data.id) {
      const { error } = await supabase.from("departments").update(data as never).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { id: _id, ...insert } = data;
    void _id;
    const { data: row, error } = await supabase.from("departments").insert(insert as never).select("id").single();
    if (error) throw new Error(error.message);
    return row;
  });

// ============ DESIGNER HELPERS ============

export const listUsersBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name_ru, full_name_kk, email, department_id, position_id")
      .order("full_name_ru", { ascending: true });
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
    await requirePermission(context.supabase, context.userId, "view_audit");
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
    await requireAnyPermission(context.supabase, context.userId, [
      "manage_users",
      "manage_roles",
    ]);
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
    await requireAnyPermission(context.supabase, context.userId, [
      "manage_users",
      "manage_roles",
    ]);
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
    await requireAnyPermission(context.supabase, context.userId, [
      "manage_users",
      "manage_roles",
    ]);
    const { id, ...patch } = data;
    if (id) {
      const { error } = await context.supabase.from("roles").update(patch as never).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await context.supabase
      .from("roles")
      .insert(patch as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
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
    await requireAnyPermission(context.supabase, context.userId, [
      "manage_users",
      "manage_roles",
    ]);
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
    await requireAnyPermission(context.supabase, context.userId, [
      "manage_users",
      "manage_roles",
    ]);
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
    await requirePermission(context.supabase, context.userId, "manage_users");
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
    await requirePermission(context.supabase, context.userId, "manage_users");
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
      full_name_ru: z.string().min(1),
      full_name_kk: z.string().min(1),
      password: z.string().min(8).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requirePermission(supabaseAdmin, context.userId, "manage_users");

    const password = data.password ?? `${crypto.randomUUID()}Aa1!`;

    const newUserId = await registerUser({
      email: data.email,
      password,
      full_name_ru: data.full_name_ru,
      full_name_kk: data.full_name_kk,
      locale: "ru",
      auth_method: "email",
    });

    return { id: newUserId, email: data.email };
  });