import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceLicense, requirePermission } from "./_helpers";

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
    await requirePermission(context.supabase, context.userId, "manage_nomenclature");
    await enforceLicense(context.supabase, { writable: true, feature: "nomenclature" });
    const { supabase } = context;
    if (data.id) {
      const { error } = await supabase
        .from("nomenclature_items")
        .update(data as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { id: _id, ...insert } = data;
    void _id;
    const { data: row, error } = await supabase
      .from("nomenclature_items")
      .insert(insert as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteNomenclature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await requirePermission(context.supabase, context.userId, "manage_nomenclature");
    await enforceLicense(context.supabase, { writable: true, feature: "nomenclature" });
    const { error } = await context.supabase.from("nomenclature_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
