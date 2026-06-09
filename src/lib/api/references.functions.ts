import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireModuleAccess } from "./_helpers";
import {
  getCatalogById,
  REFERENCE_CATALOGS,
  REFERENCE_TABLES,
} from "@/lib/references/catalogs";
import { queryActiveReferenceBrief } from "@/lib/api/reference-brief.server";
import { upsertRow } from "@/lib/api/db.helpers.server";

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
    await requireModuleAccess(context.supabase, context.userId, "references", { action: "manage" });
    const catalog = assertCatalog(data.catalogId);
    const row = { ...data.row } as Record<string, unknown>;

    if (typeof row.code === "string") {
      row.code = row.code.trim();
    }

    const id = typeof row.id === "string" ? row.id : undefined;
    const result = await upsertRow({
      supabase: context.supabase,
      table: catalog.table,
      row,
      id,
    });
    return { id: String(result.id) };
  });

export const deleteReferenceRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(deleteSchema)
  .handler(async ({ data, context }) => {
    await requireModuleAccess(context.supabase, context.userId, "references", { action: "manage" });
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

const defaultBriefOrder = [{ column: "sort_order" }, { column: "code" }] as const;

/** Brief lists for selects in forms */
export const listDocumentTypesBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    queryActiveReferenceBrief(
      context.supabase,
      "ref_document_types",
      "id, code, name_ru, name_kk",
      [...defaultBriefOrder],
    ),
  );

export const listPrioritiesBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    queryActiveReferenceBrief(
      context.supabase,
      "ref_priorities",
      "id, code, name_ru, name_kk, sla_hours, color",
      [...defaultBriefOrder],
    ),
  );

export const listTemplateCategoriesBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    queryActiveReferenceBrief(
      context.supabase,
      "ref_template_categories",
      "id, code, name_ru, name_kk",
      [...defaultBriefOrder],
    ),
  );

export const listRegistrationJournalsBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    queryActiveReferenceBrief(
      context.supabase,
      "ref_registration_journals",
      "id, code, name_ru, name_kk, prefix, document_type_id",
      [...defaultBriefOrder],
    ),
  );

export const listDocumentLinkTypesBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    queryActiveReferenceBrief(
      context.supabase,
      "ref_document_link_types",
      "id, code, name_ru, name_kk",
      [...defaultBriefOrder],
    ),
  );

export const listAccessLevelsBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    queryActiveReferenceBrief(
      context.supabase,
      "ref_access_levels",
      "id, code, name_ru, name_kk, level_order",
      [{ column: "level_order" }, { column: "sort_order" }],
    ),
  );

export const listDeliveryMethodsBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    queryActiveReferenceBrief(
      context.supabase,
      "ref_delivery_methods",
      "id, code, name_ru, name_kk",
      [...defaultBriefOrder],
    ),
  );

export const listCorrespondentsBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    queryActiveReferenceBrief(
      context.supabase,
      "ref_correspondents",
      "id, code, name_ru, name_kk, bin",
      [{ column: "name_ru" }, { column: "code" }],
    ),
  );

export const listRetentionPeriodsBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    queryActiveReferenceBrief(
      context.supabase,
      "ref_retention_periods",
      "id, code, name_ru, name_kk, years, is_permanent",
      [...defaultBriefOrder],
    ),
  );

export const listArchiveLocationsBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    queryActiveReferenceBrief(
      context.supabase,
      "ref_archive_locations",
      "id, code, name_ru, name_kk, parent_id",
      [...defaultBriefOrder],
    ),
  );
