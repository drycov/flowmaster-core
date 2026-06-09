import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { upsertRow } from "@/lib/api/db.helpers.server";
import { requireModuleAccess, requireAnyPermission } from "./_helpers";

const dutySelect = `
  id, duty_role_id, assignee_id, substitute_id, department_id, starts_at, ends_at, status, note,
  ref_duty_roles!duty_assignments_duty_role_id_fkey(id, code, name_ru, name_kk, color),
  assignee:profiles!duty_assignments_assignee_id_fkey(id, full_name_ru, full_name_kk, email),
  substitute:profiles!duty_assignments_substitute_id_fkey(id, full_name_ru, full_name_kk, email),
  departments!duty_assignments_department_id_fkey(id, code, name_ru, name_kk)
`;

export const listDutyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ department_id: z.string().uuid().optional() }).optional())
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "hr", { action: "read" });
    let q = context.supabase
      .from("ref_duty_roles" as never)
      .select("id, code, name_ru, name_kk, color, department_id, sort_order")
      .eq("is_active", true)
      .order("sort_order");
    if (data?.department_id) {
      q = q.or(`department_id.is.null,department_id.eq.${data.department_id}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listDutyAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      department_id: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "hr", { action: "read" });
    let q = supabaseAdmin
      .from("duty_assignments" as never)
      .select(dutySelect)
      .lte("starts_at", `${data.to}T23:59:59Z`)
      .gte("ends_at", `${data.from}T00:00:00Z`)
      .neq("status", "cancelled")
      .order("starts_at");
    if (data.department_id) q = q.eq("department_id", data.department_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Дежурства текущего пользователя (основной или замещающий). */
export const listMyDutyAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "hr", { action: "read" });
    const { data: rows, error } = await context.supabase
      .from("duty_assignments" as never)
      .select(dutySelect)
      .or(`assignee_id.eq.${context.userId},substitute_id.eq.${context.userId}`)
      .lte("starts_at", `${data.to}T23:59:59Z`)
      .gte("ends_at", `${data.from}T00:00:00Z`)
      .neq("status", "cancelled")
      .order("starts_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createDutyAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      duty_role_id: z.string().uuid(),
      assignee_id: z.string().uuid(),
      department_id: z.string().uuid().nullable().optional(),
      substitute_id: z.string().uuid().nullable().optional(),
      starts_at: z.string().datetime(),
      ends_at: z.string().datetime(),
      note: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "hr", { action: "manage" });
    if (data.substitute_id && data.substitute_id === data.assignee_id) {
      throw new Error("Замещающий не может совпадать с дежурным");
    }
    const row = await upsertRow({
      supabase: context.supabase,
      table: "duty_assignments",
      row: {
        ...data,
        substitute_id: data.substitute_id ?? null,
        note: data.note?.trim() ?? "",
      },
      insertOnly: { created_by: context.userId, status: "scheduled" },
    });
    return { id: String(row.id) };
  });

export const cancelDutyAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "hr", { action: "manage" });
    await requireAnyPermission(supabaseAdmin, context.userId, ["manage_schedules", "manage_hr"]);

    const { data: existing, error: loadErr } = await supabaseAdmin
      .from("duty_assignments" as never)
      .select("id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!existing) throw new Error("Назначение не найдено");
    if ((existing as { status: string }).status === "cancelled") {
      return { ok: true };
    }

    const { error } = await supabaseAdmin
      .from("duty_assignments" as never)
      .update({ status: "cancelled" } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyWorkTimeEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "hr", { action: "read" });
    const { data: rows, error } = await context.supabase
      .from("work_time_entries" as never)
      .select("*, document_projects(id, code, name_ru, name_kk)")
      .eq("user_id", context.userId)
      .gte("work_date", data.from)
      .lte("work_date", data.to)
      .order("work_date", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertWorkTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      duration_minutes: z.number().int().min(1).max(1440),
      entry_type: z.enum(["work", "overtime", "break", "remote", "business_trip"]).default("work"),
      project_id: z.string().uuid().nullable().optional(),
      description: z.string().max(1000).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "hr", { action: "write" });
    const payload = {
      work_date: data.work_date,
      duration_minutes: data.duration_minutes,
      entry_type: data.entry_type,
      project_id: data.project_id ?? null,
      description: data.description?.trim() ?? "",
      status: "draft",
    };
    const row = await upsertRow({
      supabase: context.supabase,
      table: "work_time_entries",
      row: payload,
      id: data.id,
      insertOnly: { user_id: context.userId },
      updateEq: data.id ? { user_id: context.userId } : undefined,
    });
    return { id: String(row.id) };
  });

export const submitWorkTimeEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ ids: z.array(z.string().uuid()).min(1) }))
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "hr", { action: "write" });
    const { error } = await context.supabase
      .from("work_time_entries" as never)
      .update({ status: "submitted" } as never)
      .in("id", data.ids)
      .eq("user_id", context.userId)
      .eq("status", "draft");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSchedulePlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "hr", { action: "read" });
    const { data, error } = await context.supabase
      .from("schedule_plans" as never)
      .select(
        "id, code, name_ru, name_kk, plan_type, planned_start, planned_end, status, project_id, department_id, document_projects(id, code, name_ru)",
      )
      .neq("status", "archived")
      .order("code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getSchedulePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "hr", { action: "read" });
    const { data: plan, error } = await context.supabase
      .from("schedule_plans" as never)
      .select(
        "*, document_projects(id, code, name_ru, name_kk), departments(id, code, name_ru, name_kk)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!plan) throw new Error("График не найден");

    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("schedule_plan_items" as never)
      .select(
        "*, assignee:profiles!schedule_plan_items_assignee_id_fkey(id, full_name_ru, full_name_kk)",
      )
      .eq("plan_id", data.id)
      .order("sort_order")
      .order("planned_start");
    if (itemsErr) throw new Error(itemsErr.message);

    return { plan, items: items ?? [] };
  });

export const upsertSchedulePlanItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      plan_id: z.string().uuid(),
      title_ru: z.string().min(1),
      title_kk: z.string().min(1),
      planned_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      planned_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      assignee_id: z.string().uuid().nullable().optional(),
      progress_pct: z.number().int().min(0).max(100).optional(),
      color: z.string().max(20).optional(),
      item_type: z.enum(["milestone", "task", "phase"]).optional(),
      depends_on_id: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "hr", { action: "read" });
    await requireAnyPermission(supabaseAdmin, context.userId, [
      "manage_schedules",
      "manage_projects",
      "manage_hr",
    ]);
    if (data.planned_end < data.planned_start) {
      throw new Error("Дата окончания раньше даты начала");
    }
    const payload = {
      plan_id: data.plan_id,
      title_ru: data.title_ru.trim(),
      title_kk: data.title_kk.trim(),
      planned_start: data.planned_start,
      planned_end: data.planned_end,
      assignee_id: data.assignee_id ?? null,
      progress_pct: data.progress_pct ?? 0,
      color: data.color ?? "#3b82f6",
      item_type: data.item_type ?? "task",
      depends_on_id: data.depends_on_id ?? null,
    };
    const row = await upsertRow({
      supabase: context.supabase,
      table: "schedule_plan_items",
      row: payload,
      id: data.id,
    });
    return { id: String(row.id) };
  });

export const createSchedulePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      code: z.string().min(1).max(64),
      name_ru: z.string().min(1),
      name_kk: z.string().min(1),
      plan_type: z.enum(["project", "department", "general"]).default("general"),
      project_id: z.string().uuid().nullable().optional(),
      department_id: z.string().uuid().nullable().optional(),
      planned_start: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
      planned_end: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "hr", { action: "read" });
    await requireAnyPermission(supabaseAdmin, context.userId, [
      "manage_schedules",
      "manage_projects",
      "manage_hr",
    ]);
    const row = await upsertRow({
      supabase: context.supabase,
      table: "schedule_plans",
      row: data,
      insertOnly: { owner_id: context.userId, status: "active" },
    });
    return { id: String(row.id) };
  });
