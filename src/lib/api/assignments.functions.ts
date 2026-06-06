import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission } from "./_helpers";

export const listUserAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ user_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
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
      start_date: z.string().optional(),
      end_date: z.string().nullable().optional(),
      is_primary: z.boolean().default(true),
      note: z.string().max(1000).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requirePermission(context.supabase, context.userId, "manage_users");
    const { data: row, error } = await (context.supabase.from("profile_assignments" as never) as any)
      .insert({
        user_id: data.user_id,
        department_id: data.department_id ?? null,
        position_id: data.position_id ?? null,
        start_date: data.start_date ?? new Date().toISOString().slice(0, 10),
        end_date: data.end_date ?? null,
        is_primary: data.is_primary,
        note: data.note ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const endAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), end_date: z.string().optional() }))
  .handler(async ({ data, context }) => {
    await requirePermission(context.supabase, context.userId, "manage_users");
    const { error } = await (context.supabase.from("profile_assignments" as never) as any)
      .update({ end_date: data.end_date ?? new Date().toISOString().slice(0, 10) })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await requirePermission(context.supabase, context.userId, "manage_users");
    const { error } = await (context.supabase.from("profile_assignments" as never) as any)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
