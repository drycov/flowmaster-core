import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireModuleAccess } from "./_helpers";

const REASON = z.enum([
  "hire",
  "transfer",
  "promotion",
  "temporary",
  "termination",
  "reinstatement",
  "correction",
]);

export const listUserAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ user_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id !== userId) {
      await requireModuleAccess(supabase, userId, "admin_users", { action: "read" });
    }

    const { data: rows, error } = await supabase
      .from("profile_assignments" as never)
      .select("*, departments(id, name_ru, name_kk, code), positions(id, title_ru, title_kk, code)")
      .eq("user_id", data.user_id)
      .order("start_date", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      user_id: z.string().uuid(),
      department_id: z.string().uuid().nullable().optional(),
      position_id: z.string().uuid().nullable().optional(),
      manager_user_id: z.string().uuid().nullable().optional(),
      start_date: z.string().optional(),
      is_primary: z.boolean().default(true),
      is_temporary: z.boolean().default(false),
      reason: REASON.default("hire"),
      notes: z.string().max(1000).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "admin_users", { action: "write" });
    const { data: row, error } = await (
      context.supabase.from("profile_assignments" as never) as any
    )
      .insert({
        user_id: data.user_id,
        department_id: data.department_id ?? null,
        position_id: data.position_id ?? null,
        manager_user_id: data.manager_user_id ?? null,
        start_date: data.start_date ?? new Date().toISOString().slice(0, 10),
        is_primary: data.is_primary,
        is_temporary: data.is_temporary,
        reason: data.reason,
        notes: data.notes ?? "",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// History is immutable. "Terminating" an assignment = inserting a new primary
// termination record. The DB trigger auto-closes the prior primary record.
export const terminateAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      user_id: z.string().uuid(),
      end_date: z.string().optional(),
      reason: REASON.default("termination"),
      notes: z.string().max(1000).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "admin_users", { action: "write" });
    const { error } = await (context.supabase.from("profile_assignments" as never) as any).insert({
      user_id: data.user_id,
      department_id: null,
      position_id: null,
      manager_user_id: null,
      start_date: data.end_date ?? new Date().toISOString().slice(0, 10),
      is_primary: true,
      reason: data.reason,
      notes: data.notes ?? "",
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
