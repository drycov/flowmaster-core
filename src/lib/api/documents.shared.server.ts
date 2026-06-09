export const DOCUMENT_SELECT = `
  id, reg_number, doc_type, status, title_ru, title_kk, summary, body,
  nomenclature_id, template_id, current_version, created_by, assigned_to,
  department_id, due_at, sla_status, archived_at, legal_hold, legal_hold_note, legal_hold_at,
  retention_period_id, retention_due_at,
  created_at, updated_at, workflow_id, custom_route,
  document_type_id, priority_id, correspondent_id,
  registration_journal_id, delivery_method_id, access_level_id, archive_location_id,
  ref_archive_locations!documents_archive_location_id_fkey(id, code, name_ru, name_kk),
  ref_retention_periods!documents_retention_period_id_fkey(id, code, name_ru, name_kk, years, is_permanent),
  nomenclature_items!documents_nomenclature_id_fkey(id, code, title_ru, title_kk, retention_years),
  received_at, sent_at, pages_count, copies_count, external_reg_number,
  ref_document_types!documents_document_type_id_fkey(id, code, name_ru, name_kk),
  ref_priorities!documents_priority_id_fkey(id, code, name_ru, name_kk, color, sla_hours),
  ref_correspondents!documents_correspondent_id_fkey(id, code, name_ru, name_kk, bin),
  ref_registration_journals!documents_registration_journal_id_fkey(id, code, name_ru, name_kk, prefix),
  ref_delivery_methods!documents_delivery_method_id_fkey(id, code, name_ru, name_kk),
  ref_access_levels!documents_access_level_id_fkey(id, code, name_ru, name_kk, level_order),
  workflows!documents_workflow_id_fkey(name_ru, name_kk, definition),
  project_id,
  document_projects!documents_project_id_fkey(id, code, name_ru, name_kk)
`;

export const CONTENT_MASK = "[Гриф доступа: содержимое скрыто]";
