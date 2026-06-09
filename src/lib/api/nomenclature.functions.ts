import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { upsertRow } from "@/lib/api/db.helpers.server";
import { requireModuleAccess } from "./_helpers";

export const listNomenclature = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("nomenclature_items")
      .select("*")
      .order("code", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertNomenclature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      parent_id: z.string().uuid().nullable().optional(),
      code: z.string().min(1).max(64),
      title_ru: z.string().min(1).max(500),
      title_kk: z.string().min(1).max(500),
      retention_years: z.number().min(0).max(75).default(5),
      archive_rule: z.string().default("standard"),
      department_id: z.string().uuid().nullable().optional(),
      sort_order: z.number().int().min(0).max(9999).default(0),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "nomenclature", {
      action: "manage",
    });
    const { supabase } = context;
    const row = await upsertRow({
      supabase,
      table: "nomenclature_items",
      row: data,
      id: data.id,
    });
    return { id: String(row.id) };
  });

export const deleteNomenclature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "nomenclature", {
      action: "manage",
    });
    const { error } = await context.supabase.from("nomenclature_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
