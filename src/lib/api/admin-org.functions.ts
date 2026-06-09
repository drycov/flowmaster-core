import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { upsertRow } from "@/lib/api/db.helpers.server";
import { resolveTenantListScope } from "@/lib/access/tenant-admin.server";
import { requireAnyPermission, requireModuleAccess } from "./_helpers";

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
