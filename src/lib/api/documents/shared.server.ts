export const CONTENT_MASK = "[Гриф доступа: содержимое скрыто]";

/** Row shape from documents_full list projection. */
export type DocumentListRow = {
  id: string;
  reg_number: string;
  title_ru: string;
  title_kk: string | null;
  status: string;
  doc_type: string;
  sla_status: string | null;
  due_at: string | null;
  created_at: string;
  created_by: string;
  assigned_to: string | null;
  current_version: number;
  received_at: string | null;
  sent_at: string | null;
  external_reg_number: string | null;
  legal_hold: boolean | null;
  retention_due_at: string | null;
  archived_at: string | null;
  document_type_id: string | null;
};

export type DocumentListRowEnriched = DocumentListRow & {
  ref_document_types: { code: string } | null;
};

/** FTS search_documents_fts result (subset of list columns). */
export type DocumentFtsRow = {
  id: string;
  reg_number: string;
  title_ru: string;
  title_kk: string | null;
  status: string;
  doc_type: string;
  sla_status: string | null;
  due_at: string | null;
  created_at: string;
  rank?: number;
};

/** Summary projection for access grants / API v1. */
export const DOCUMENT_SUMMARY_SELECT =
  "id, reg_number, title_ru, title_kk, status, created_by, access_level_id, document_type_id, doc_type, summary, body, due_at, updated_at, priority_id, correspondent_id";

/** Flat columns from documents_full (Phase 2 read model). */
export const DOCUMENT_FULL_BASE_SELECT = `
  id, reg_number, doc_type, status, title_ru, title_kk, summary, body,
  nomenclature_id, template_id, current_version, created_by, assigned_to,
  department_id, due_at, sla_status, archived_at, legal_hold, legal_hold_note, legal_hold_at, legal_hold_by,
  retention_period_id, retention_due_at,
  created_at, updated_at, workflow_id, custom_route,
  document_type_id, priority_id, correspondent_id,
  registration_journal_id, delivery_method_id, access_level_id, archive_location_id,
  received_at, sent_at, pages_count, copies_count, external_reg_number,
  project_id
`;

/** List projection from documents_full. */
export const DOCUMENT_FULL_LIST_SELECT =
  "id, reg_number, title_ru, title_kk, status, doc_type, sla_status, due_at, created_at, created_by, assigned_to, current_version, received_at, sent_at, external_reg_number, legal_hold, retention_due_at, archived_at, document_type_id";
