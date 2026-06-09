import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceLicense, requirePermission } from "./_helpers";
import {
  getCatalogById,
  REFERENCE_CATALOGS,
  REFERENCE_TABLES,
} from "@/lib/references/catalogs";

const catalogIdSchema = z.object({
  catalogId: z.string().min(1),
});

const upsertSchema = z.object({
  catalogId: z.string().min(1),
  row: z.record(z.unknown()),
});

const deleteSchema = z.object({
  catalogId: z.string().min(1),
  id: z.string().uuid(),
});

function assertCatalog(catalogId: string) {
  const catalog = getCatalogById(catalogId);
  if (!catalog || !REFERENCE_TABLES.includes(catalog.table)) {
    throw new Error("Unknown catalog");
  }
  return catalog;
}

function buildSelectQuery(table: string, catalogId: string) {
  if (table === "ref_registration_journals") {
    return `*, ref_document_types(id, code, name_ru, name_kk), departments(id, code, name_ru, name_kk)`;
  }
  if (table === "ref_archive_locations") {
    return `*, parent:ref_archive_locations!ref_archive_locations_parent_id_fkey(id, code, name_ru, name_kk)`;
  }
  void catalogId;
  return "*";
}

export const listReferenceCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(catalogIdSchema)
  .handler(async ({ data, context }) => {
    const catalog = assertCatalog(data.catalogId);
    let query = context.supabase
      .from(catalog.table as "ref_document_types")
      .select(buildSelectQuery(catalog.table, catalog.id));

    for (const order of catalog.orderBy ?? [{ column: "code" }]) {
      query = query.order(order.column, { ascending: order.ascending ?? true });
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertReferenceRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(upsertSchema)
  .handler(async ({ data, context }) => {
    await requirePermission(context.supabase, context.userId, "manage_references");
    await enforceLicense(context.supabase, { writable: true, feature: "references" });
    const catalog = assertCatalog(data.catalogId);
    const row = { ...data.row } as Record<string, unknown>;

    if (typeof row.code === "string") {
      row.code = row.code.trim();
    }

    const id = typeof row.id === "string" ? row.id : undefined;
    if (id) {
      const { id: _id, ...patch } = row;
      void _id;
      const { error } = await context.supabase
        .from(catalog.table as "ref_document_types")
        .update(patch as never)
        .eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }

    const { id: _omit, ...insert } = row;
    void _omit;
    const { data: created, error } = await context.supabase
      .from(catalog.table as "ref_document_types")
      .insert(insert as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const deleteReferenceRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(deleteSchema)
  .handler(async ({ data, context }) => {
    await requirePermission(context.supabase, context.userId, "manage_references");
    await enforceLicense(context.supabase, { writable: true, feature: "references" });
    const catalog = assertCatalog(data.catalogId);
    const { error } = await context.supabase
      .from(catalog.table as "ref_document_types")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listReferenceCatalogsMeta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return REFERENCE_CATALOGS.map((c) => ({
      id: c.id,
      titleKey: c.titleKey,
      descriptionKey: c.descriptionKey,
      icon: c.icon,
    }));
  });

/** Brief lists for selects in forms */
export const listDocumentTypesBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ref_document_types")
      .select("id, code, name_ru, name_kk")
      .eq("is_active", true)
      .order("sort_order")
      .order("code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listPrioritiesBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ref_priorities")
      .select("id, code, name_ru, name_kk, sla_hours, color")
      .eq("is_active", true)
      .order("sort_order")
      .order("code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listTemplateCategoriesBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ref_template_categories")
      .select("id, code, name_ru, name_kk")
      .eq("is_active", true)
      .order("sort_order")
      .order("code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listRegistrationJournalsBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ref_registration_journals")
      .select("id, code, name_ru, name_kk, prefix, document_type_id")
      .eq("is_active", true)
      .order("sort_order")
      .order("code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listDocumentLinkTypesBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ref_document_link_types")
      .select("id, code, name_ru, name_kk")
      .eq("is_active", true)
      .order("sort_order")
      .order("code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listDeliveryMethodsBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ref_delivery_methods")
      .select("id, code, name_ru, name_kk")
      .eq("is_active", true)
      .order("sort_order")
      .order("code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listCorrespondentsBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ref_correspondents")
      .select("id, code, name_ru, name_kk, bin")
      .eq("is_active", true)
      .order("name_ru")
      .order("code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listRetentionPeriodsBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ref_retention_periods")
      .select("id, code, name_ru, name_kk, years, is_permanent")
      .eq("is_active", true)
      .order("sort_order")
      .order("code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listArchiveLocationsBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ref_archive_locations")
      .select("id, code, name_ru, name_kk, parent_id")
      .eq("is_active", true)
      .order("sort_order")
      .order("code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
