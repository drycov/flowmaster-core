import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DOCUMENT_FULL_BASE_SELECT,
  DOCUMENT_SUMMARY_SELECT,
  type DocumentFtsRow,
  type DocumentListRow,
  type DocumentListRowEnriched,
} from "@/lib/api/documents.shared.server";

export type { DocumentListRow, DocumentListRowEnriched, DocumentFtsRow };

export type DocumentFullRow = Record<string, unknown> & {
  id: string;
  document_type_id?: string | null;
  priority_id?: string | null;
  correspondent_id?: string | null;
  registration_journal_id?: string | null;
  delivery_method_id?: string | null;
  access_level_id?: string | null;
  archive_location_id?: string | null;
  retention_period_id?: string | null;
  nomenclature_id?: string | null;
  workflow_id?: string | null;
  project_id?: string | null;
};

async function loadRef<T extends Record<string, unknown>>(
  client: SupabaseClient,
  table: string,
  id: string | null | undefined,
  select: string,
): Promise<T | null> {
  if (!id) return null;
  const { data, error } = await client.from(table).select(select).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as T | null) ?? null;
}

/** Attach ref_* / workflow / project relations expected by document-detail UI. */
export async function enrichDocumentFromFull(
  client: SupabaseClient,
  row: DocumentFullRow,
): Promise<Record<string, unknown>> {
  const [
    ref_archive_locations,
    ref_retention_periods,
    nomenclature_items,
    ref_document_types,
    ref_priorities,
    ref_correspondents,
    ref_registration_journals,
    ref_delivery_methods,
    ref_access_levels,
    workflows,
    document_projects,
  ] = await Promise.all([
    loadRef(client, "ref_archive_locations", row.archive_location_id, "id, code, name_ru, name_kk"),
    loadRef(
      client,
      "ref_retention_periods",
      row.retention_period_id,
      "id, code, name_ru, name_kk, years, is_permanent",
    ),
    loadRef(
      client,
      "nomenclature_items",
      row.nomenclature_id,
      "id, code, title_ru, title_kk, retention_years",
    ),
    loadRef(client, "ref_document_types", row.document_type_id, "id, code, name_ru, name_kk"),
    loadRef(
      client,
      "ref_priorities",
      row.priority_id,
      "id, code, name_ru, name_kk, color, sla_hours",
    ),
    loadRef(
      client,
      "ref_correspondents",
      row.correspondent_id,
      "id, code, name_ru, name_kk, bin",
    ),
    loadRef(
      client,
      "ref_registration_journals",
      row.registration_journal_id,
      "id, code, name_ru, name_kk, prefix",
    ),
    loadRef(client, "ref_delivery_methods", row.delivery_method_id, "id, code, name_ru, name_kk"),
    loadRef(
      client,
      "ref_access_levels",
      row.access_level_id,
      "id, code, name_ru, name_kk, level_order",
    ),
    loadRef(client, "workflows", row.workflow_id, "name_ru, name_kk, definition"),
    loadRef(client, "document_projects", row.project_id, "id, code, name_ru, name_kk"),
  ]);

  return {
    ...row,
    ref_archive_locations,
    ref_retention_periods,
    nomenclature_items,
    ref_document_types,
    ref_priorities,
    ref_correspondents,
    ref_registration_journals,
    ref_delivery_methods,
    ref_access_levels,
    workflows,
    document_projects,
  };
}

export async function fetchDocumentById(
  client: SupabaseClient,
  documentId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await client
    .from("documents_full" as never)
    .select(DOCUMENT_FULL_BASE_SELECT)
    .eq("id" as never, documentId)
    .single();

  if (error) throw new Error(error.message);
  return enrichDocumentFromFull(client, data as DocumentFullRow);
}

const DOC_TYPE_CODE_SELECT = "id, code";

/** Batch-enrich list rows with ref_document_types.code (PostgREST FK hints unavailable on views). */
export async function enrichDocumentListRows(
  client: SupabaseClient,
  rows: DocumentListRow[],
): Promise<DocumentListRowEnriched[]> {
  const typeIds = [...new Set(rows.map((r) => r.document_type_id).filter(Boolean))] as string[];
  if (typeIds.length === 0) {
    return rows.map((r) => ({ ...r, ref_document_types: r.doc_type ? { code: r.doc_type } : null }));
  }

  const { data: types, error } = await client
    .from("ref_document_types")
    .select(DOC_TYPE_CODE_SELECT)
    .in("id", typeIds);

  if (error) throw new Error(error.message);

  const byId = new Map((types ?? []).map((t) => [t.id as string, t as { id: string; code: string }]));

  return rows.map((r) => ({
    ...r,
    ref_document_types: r.document_type_id
      ? (byId.get(r.document_type_id) ?? (r.doc_type ? { code: r.doc_type } : null))
      : r.doc_type
        ? { code: r.doc_type }
        : null,
  }));
}

/** Map FTS rows to list items with ref_document_types from doc_type code. */
export async function enrichFtsSearchRows(
  client: SupabaseClient,
  rows: DocumentFtsRow[],
): Promise<DocumentListRowEnriched[]> {
  const codes = [...new Set(rows.map((r) => r.doc_type).filter(Boolean))];
  const byCode = new Map<string, { id: string; code: string }>();

  if (codes.length > 0) {
    const { data: types, error } = await client
      .from("ref_document_types")
      .select(DOC_TYPE_CODE_SELECT)
      .in("code", codes);
    if (error) throw new Error(error.message);
    for (const t of types ?? []) {
      byCode.set((t as { code: string }).code, t as { id: string; code: string });
    }
  }

  return rows.map((r) => {
    const typeRef = byCode.get(r.doc_type);
    return {
      id: r.id,
      reg_number: r.reg_number,
      title_ru: r.title_ru,
      title_kk: r.title_kk,
      status: r.status,
      doc_type: r.doc_type,
      sla_status: r.sla_status,
      due_at: r.due_at,
      created_at: r.created_at,
      created_by: "",
      assigned_to: null,
      current_version: 0,
      received_at: null,
      sent_at: null,
      external_reg_number: null,
      legal_hold: null,
      retention_due_at: null,
      archived_at: null,
      document_type_id: typeRef?.id ?? null,
      ref_document_types: typeRef ?? (r.doc_type ? { code: r.doc_type } : null),
    };
  });
}

export async function fetchDocumentSummaryById(
  client: SupabaseClient,
  documentId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await client
    .from("documents_full" as never)
    .select(DOCUMENT_SUMMARY_SELECT)
    .eq("id" as never, documentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as Record<string, unknown> & {
    document_type_id?: string | null;
    access_level_id?: string | null;
  };

  const [ref_document_types, ref_access_levels] = await Promise.all([
    loadRef(client, "ref_document_types", row.document_type_id, "id, code, name_ru, name_kk"),
    loadRef(
      client,
      "ref_access_levels",
      row.access_level_id,
      "code, name_ru, name_kk, level_order",
    ),
  ]);

  return { ...row, ref_document_types, ref_access_levels };
}
