import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchProfileById } from "@/lib/auth/server";
import { requireModuleAccess, requireAnyPermission } from "./_helpers";

const leaveSelect = `
  id, user_id, absence_type_id, date_from, date_to, business_days, status,
  reason, approver_id, decided_at, decision_note, created_at, updated_at,
  ref_absence_types!leave_requests_absence_type_id_fkey(id, code, name_ru, name_kk, color),
  employee:profiles!leave_requests_user_id_fkey(id, full_name_ru, full_name_kk, email),
  approver:profiles!leave_requests_approver_id_fkey(id, full_name_ru, full_name_kk, email)
`;

function parseLeaveBalance(
  data: { entitled_days?: number; used_days?: number } | null,
  year: number,
) {
  const entitled = data?.entitled_days ?? 24;
  const used = data?.used_days ?? 0;
  return { year, entitled_days: entitled, used_days: used, remaining_days: Math.max(entitled - used, 0) };
}

export const listAbsenceTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "hr", { action: "read" });
    const { data, error } = await context.supabase
      .from("ref_absence_types" as never)
      .select("id, code, name_ru, name_kk, color, deducts_balance, requires_approval, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyLeaveBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "hr", { action: "read" });
    const year = new Date().getFullYear();
    const { data, error } = await context.supabase
      .from("leave_balances" as never)
      .select("year, entitled_days, used_days")
      .eq("user_id", context.userId)
      .eq("year", year)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return parseLeaveBalance(data as { entitled_days?: number; used_days?: number } | null, year);
  });

export const getMyHrSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "hr", { action: "read" });
    const year = new Date().getFullYear();
    const { data: balanceRow, error: balanceErr } = await context.supabase
      .from("leave_balances" as never)
      .select("year, entitled_days, used_days")
      .eq("user_id", context.userId)
      .eq("year", year)
      .maybeSingle();
    if (balanceErr) throw new Error(balanceErr.message);
    const balance = parseLeaveBalance(
      balanceRow as { entitled_days?: number; used_days?: number } | null,
      year,
    );

    const { count: pendingApprovals, error: pendingErr } = await context.supabase
      .from("leave_requests" as never)
      .select("id", { count: "exact", head: true })
      .eq("approver_id", context.userId)
      .eq("status", "pending");
    if (pendingErr) throw new Error(pendingErr.message);

    const { data: managerId, error: mgrRpcErr } = await context.supabase.rpc(
      "user_manager" as never,
      { _user: context.userId } as never,
    );
    if (mgrRpcErr) throw new Error(mgrRpcErr.message);

    let manager: { id: string; full_name_ru?: string; full_name_kk?: string; email?: string } | null =
      null;
    if (managerId) {
      const mgr = await fetchProfileById(managerId as string);
      if (mgr) {
        manager = {
          id: managerId as string,
          full_name_ru: mgr.full_name_ru as string | undefined,
          full_name_kk: mgr.full_name_kk as string | undefined,
          email: mgr.email as string | undefined,
        };
      }
    }

    const today = new Date().toISOString().slice(0, 10);

    const { data: nextLeave, error: nextLeaveErr } = await context.supabase
      .from("leave_requests" as never)
      .select(
        "id, date_from, date_to, status, ref_absence_types!leave_requests_absence_type_id_fkey(name_ru, name_kk)",
      )
      .eq("user_id", context.userId)
      .in("status", ["approved", "pending"])
      .gte("date_to", today)
      .order("date_from", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (nextLeaveErr) throw new Error(nextLeaveErr.message);

    const { data: nextDuty, error: nextDutyErr } = await context.supabase
      .from("duty_assignments" as never)
      .select(
        `id, starts_at, ends_at, status,
         ref_duty_roles!duty_assignments_duty_role_id_fkey(name_ru, name_kk),
         departments!duty_assignments_department_id_fkey(code, name_ru, name_kk)`,
      )
      .or(`assignee_id.eq.${context.userId},substitute_id.eq.${context.userId}`)
      .neq("status", "cancelled")
      .gte("ends_at", `${today}T00:00:00Z`)
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (nextDutyErr) throw new Error(nextDutyErr.message);

    return {
      balance,
      manager,
      pending_approvals: pendingApprovals ?? 0,
      next_leave: nextLeave ?? null,
      next_duty: nextDuty ?? null,
    };
  });

export const listMyLeaveRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "hr", { action: "read" });
    const { data, error } = await context.supabase
      .from("leave_requests" as never)
      .select(leaveSelect)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listPendingLeaveApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "hr", { action: "read" });
    const { data, error } = await supabaseAdmin
      .from("leave_requests" as never)
      .select(leaveSelect)
      .eq("approver_id", context.userId)
      .eq("status", "pending")
      .order("date_from", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listOrgLeaveRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "hr", { action: "manage" });
    const { data, error } = await supabaseAdmin
      .from("leave_requests" as never)
      .select(leaveSelect)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      absence_type_id: z.string().uuid(),
      date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reason: z.string().max(2000).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "hr", { action: "write" });
    if (data.date_to < data.date_from) {
      throw new Error("Дата окончания не может быть раньше даты начала");
    }

    const { data: bizDays, error: rpcErr } = await context.supabase.rpc(
      "count_business_days_between" as never,
      { _from: data.date_from, _to: data.date_to } as never,
    );
    if (rpcErr) throw new Error(rpcErr.message);

    const { data: row, error } = await context.supabase
      .from("leave_requests" as never)
      .insert({
        user_id: context.userId,
        absence_type_id: data.absence_type_id,
        date_from: data.date_from,
        date_to: data.date_to,
        business_days: (bizDays as number) ?? 0,
        reason: data.reason?.trim() ?? "",
        status: "pending",
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const decideLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      decision: z.enum(["approved", "rejected", "cancelled"]),
      decision_note: z.string().max(1000).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "hr", { action: "read" });

    const { data: existing, error: loadErr } = await context.supabase
      .from("leave_requests" as never)
      .select("id, user_id, approver_id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!existing) throw new Error("Заявка не найдена");

    const row = existing as { user_id: string; approver_id: string | null; status: string };
    if (row.status !== "pending") {
      throw new Error("Заявка уже обработана");
    }

    const isOwner = row.user_id === context.userId;
    const isApprover = row.approver_id === context.userId;

    if (data.decision === "cancelled") {
      if (!isOwner) throw new Error("Отменить может только автор заявки");
    } else if (!isApprover) {
      await requireAnyPermission(supabaseAdmin, context.userId, ["manage_hr"]);
    }

    const { error } = await context.supabase
      .from("leave_requests" as never)
      .update({
        status: data.decision,
        decided_at: new Date().toISOString(),
        decision_note: data.decision_note?.trim() ?? null,
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyLeaveCalendar = createServerFn({ method: "POST" })
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
      .from("leave_requests" as never)
      .select(leaveSelect)
      .eq("user_id", context.userId)
      .in("status", ["approved", "pending"])
      .lte("date_from", data.to)
      .gte("date_to", data.from)
      .order("date_from", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listDepartmentLeaveCalendar = createServerFn({ method: "POST" })
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

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("department_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);

    let canSeeAll = false;
    try {
      await requireAnyPermission(supabaseAdmin, context.userId, ["manage_hr"]);
      canSeeAll = true;
    } catch {
      canSeeAll = false;
    }

    const deptId = data.department_id ?? (profile?.department_id as string | null | undefined);
    if (!deptId && !canSeeAll) {
      return [];
    }

    let userIds: string[] | null = null;
    if (deptId) {
      const { data: staff, error: staffErr } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("department_id", deptId);
      if (staffErr) throw new Error(staffErr.message);
      userIds = (staff ?? []).map((s) => (s as { id: string }).id);
      if (!userIds.length) return [];
    }

    let q = supabaseAdmin
      .from("leave_requests" as never)
      .select(leaveSelect)
      .eq("status", "approved")
      .lte("date_from", data.to)
      .gte("date_to", data.from)
      .order("date_from", { ascending: true });

    if (userIds) q = q.in("user_id", userIds);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listStaffDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ department_id: z.string().uuid().optional() }).optional())
  .handler(async ({ data, context }) => {
    await requireModuleAccess(supabaseAdmin, context.userId, "hr", { action: "read" });

    let q = supabaseAdmin
      .from("profiles")
      .select(
        `id, email, full_name_ru, full_name_kk, department_id, position_id,
         departments!profiles_department_id_fkey(id, code, name_ru, name_kk, head_user_id),
         positions!profiles_position_id_fkey(id, code, title_ru, title_kk)`,
      )
      .order("full_name_ru", { ascending: true });

    if (data?.department_id) {
      q = q.eq("department_id", data.department_id);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const userIds = (rows ?? []).map((r) => (r as { id: string }).id);
    if (!userIds.length) return [];

    const { data: assignments } = await supabaseAdmin
      .from("profile_assignments" as never)
      .select("user_id, manager_user_id, start_date")
      .in("user_id", userIds)
      .is("end_date", null)
      .eq("is_primary", true);

    const assignmentMap = new Map(
      (assignments ?? []).map((a) => [(a as { user_id: string }).user_id, a]),
    );

    const managerIds = [
      ...new Set(
        (rows ?? []).flatMap((profile) => {
          const p = profile as Record<string, unknown>;
          const a = assignmentMap.get(p.id as string) as
            | { manager_user_id?: string | null }
            | undefined;
          const dept = p.departments as { head_user_id?: string | null } | null;
          const id =
            a?.manager_user_id ??
            (dept?.head_user_id && dept.head_user_id !== p.id ? dept.head_user_id : null);
          return id ? [id] : [];
        }),
      ),
    ];

    const { data: managers } = managerIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, full_name_ru, full_name_kk")
          .in("id", managerIds)
      : { data: [] };

    const managerMap = new Map((managers ?? []).map((m) => [(m as { id: string }).id, m]));

    return (rows ?? []).map((profile) => {
      const p = profile as Record<string, unknown>;
      const a = assignmentMap.get(p.id as string) as { manager_user_id?: string | null } | undefined;
      const dept = p.departments as { head_user_id?: string | null } | null;
      const managerId =
        a?.manager_user_id ??
        (dept?.head_user_id && dept.head_user_id !== p.id ? dept.head_user_id : null);
      return {
        ...p,
        manager: managerId ? (managerMap.get(managerId) ?? null) : null,
      };
    });
  });
