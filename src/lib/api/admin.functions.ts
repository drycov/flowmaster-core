import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission } from "./_helpers";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profile, roles, roleDefs] = await Promise.all([
      supabase.from("profiles").select("*, departments(id, name_ru, name_kk, code), positions(*)").eq("id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("role_definitions").select("*"),
    ]);

    const userRoles = (roles.data ?? []).map((r) => r.role);
    const permissions: Record<string, boolean> = {};

    // Merge permissions from all roles
    (roleDefs.data ?? []).forEach((def) => {
      if (userRoles.includes(def.role)) {
        const rolePerms = def.permissions as Record<string, boolean>;
        Object.keys(rolePerms).forEach((p) => {
          if (rolePerms[p]) permissions[p] = true;
        });
      }
    });

    return {
      profile: profile.data,
      roles: userRoles,
      permissions,
    };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, email, full_name_ru, full_name_kk, position_ru, position_kk, department_id")
      .order("full_name_ru", { ascending: true });
    if (error) throw new Error(error.message);
    const { data: roles } = await context.supabase.from("user_roles").select("user_id, role");
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
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!isAdmin) throw new Error("Admin only");
    if (data.enabled) {
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: data.user_id, role: data.role } as never, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
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
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
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
      .from("role_definitions")
      .select("role, title_ru, title_kk")
      .order("role", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ entity_type: z.string().optional(), entity_id: z.string().optional(), limit: z.number().max(500).default(100) }).optional())
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data?.limit ?? 100);
    if (data?.entity_type) q = q.eq("entity_type", data.entity_type);
    if (data?.entity_id) q = q.eq("entity_id", data.entity_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
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
