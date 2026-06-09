import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { upsertRow } from "@/lib/api/db.helpers.server";
import { requireModuleAccess } from "./_helpers";

export const listBusinessCalendarDays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ year: z.number().int().min(2020).max(2100) }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("business_calendar_days")
      .select("day_date, is_holiday, name_ru, name_kk")
      .gte("day_date", `${data.year}-01-01`)
      .lte("day_date", `${data.year}-12-31`)
      .order("day_date");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertBusinessCalendarDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      day_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      is_holiday: z.boolean(),
      name_ru: z.string().max(200).default(""),
      name_kk: z.string().max(200).default(""),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "admin_org", { action: "write" });
    await upsertRow({
      supabase: context.supabase,
      table: "business_calendar_days",
      row: {
        day_date: data.day_date,
        is_holiday: data.is_holiday,
        name_ru: data.name_ru,
        name_kk: data.name_kk,
      },
      onConflict: "day_date",
    });
    return { ok: true };
  });

export const deleteBusinessCalendarDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ day_date: z.string() }))
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "admin_org", { action: "write" });
    const { error } = await context.supabase
      .from("business_calendar_days")
      .delete()
      .eq("day_date", data.day_date);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
