-- Phase 2b: documents_full compatibility view + retention tick via archive sidecar.

-- =============================================================================
-- 1. documents_full — denormalized read model (sidecars override legacy columns)
-- =============================================================================

CREATE OR REPLACE VIEW public.documents_full
WITH (security_invoker = true)
AS
SELECT
  d.id,
  d.status,
  d.title_ru,
  d.title_kk,
  d.summary,
  d.body,
  d.template_id,
  d.current_version,
  d.created_by,
  d.department_id,
  d.organization_id,
  d.project_id,
  d.search_tsv,
  d.created_at,
  d.updated_at,
  COALESCE(r.reg_number, d.reg_number) AS reg_number,
  COALESCE(r.registration_journal_id, d.registration_journal_id) AS registration_journal_id,
  COALESCE(r.delivery_method_id, d.delivery_method_id) AS delivery_method_id,
  COALESCE(r.received_at, d.received_at) AS received_at,
  COALESCE(r.sent_at, d.sent_at) AS sent_at,
  COALESCE(r.pages_count, d.pages_count) AS pages_count,
  COALESCE(r.copies_count, d.copies_count) AS copies_count,
  COALESCE(r.external_reg_number, d.external_reg_number) AS external_reg_number,
  COALESCE(c.doc_type, d.doc_type) AS doc_type,
  COALESCE(c.document_type_id, d.document_type_id) AS document_type_id,
  COALESCE(c.priority_id, d.priority_id) AS priority_id,
  COALESCE(c.correspondent_id, d.correspondent_id) AS correspondent_id,
  COALESCE(c.nomenclature_id, d.nomenclature_id) AS nomenclature_id,
  COALESCE(c.access_level_id, d.access_level_id) AS access_level_id,
  COALESCE(a.archived_at, d.archived_at) AS archived_at,
  COALESCE(a.archive_location_id, d.archive_location_id) AS archive_location_id,
  COALESCE(a.retention_period_id, d.retention_period_id) AS retention_period_id,
  COALESCE(a.retention_due_at, d.retention_due_at) AS retention_due_at,
  COALESCE(a.legal_hold, d.legal_hold) AS legal_hold,
  COALESCE(a.legal_hold_note, d.legal_hold_note) AS legal_hold_note,
  COALESCE(a.legal_hold_at, d.legal_hold_at) AS legal_hold_at,
  COALESCE(a.legal_hold_by, d.legal_hold_by) AS legal_hold_by,
  COALESCE(l.due_at, d.due_at) AS due_at,
  COALESCE(l.sla_status, d.sla_status) AS sla_status,
  COALESCE(l.workflow_id, d.workflow_id) AS workflow_id,
  COALESCE(l.custom_route, d.custom_route) AS custom_route,
  COALESCE(l.assigned_to, d.assigned_to) AS assigned_to
FROM public.documents d
LEFT JOIN public.document_registration r ON r.document_id = d.id
LEFT JOIN public.document_classification c ON c.document_id = d.id
LEFT JOIN public.document_archive a ON a.document_id = d.id
LEFT JOIN public.document_lifecycle l ON l.document_id = d.id;

GRANT SELECT ON public.documents_full TO authenticated, service_role;

COMMENT ON VIEW public.documents_full IS
  'Phase 2 read model: document root + registration/classification/archive/lifecycle sidecars.';

-- =============================================================================
-- 2. Retention cron — source of truth: document_archive
-- =============================================================================

CREATE OR REPLACE FUNCTION public.app_retention_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
  v_count int;
BEGIN
  PERFORM public.enable_document_status_bypass();

  WITH due AS (
    SELECT da.document_id
    FROM public.document_archive da
    JOIN public.documents d ON d.id = da.document_id
    WHERE da.legal_hold = false
      AND d.status IN ('approved', 'signed')
      AND da.retention_due_at IS NOT NULL
      AND da.retention_due_at <= now()
  ),
  moved AS (
    UPDATE public.documents d
       SET status = 'archived'::document_status,
           archived_at = COALESCE(d.archived_at, now())
      FROM due
     WHERE d.id = due.document_id
     RETURNING d.id
  )
  SELECT array_agg(id), count(*)::int INTO v_ids, v_count FROM moved;

  INSERT INTO public.audit_logs(actor_id, entity_type, entity_id, action, after)
  VALUES (
    NULL,
    'system',
    'retention_tick',
    'retention.auto_archive',
    jsonb_build_object('count', COALESCE(v_count, 0), 'document_ids', COALESCE(to_jsonb(v_ids), '[]'::jsonb))
  );

  RETURN jsonb_build_object(
    'ok', true,
    'archived_count', COALESCE(v_count, 0),
    'document_ids', COALESCE(to_jsonb(v_ids), '[]'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.app_retention_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_retention_tick() TO service_role;

-- =============================================================================
-- 3. Trigger-only sync helpers — not callable via PostgREST
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.sync_document_sidecars_from_documents() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_documents_from_registration() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_documents_from_classification() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_documents_from_archive() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_documents_from_lifecycle() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.stamp_document_sidecar_organization() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sync_document_sidecars_from_documents() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_documents_from_registration() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_documents_from_classification() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_documents_from_archive() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_documents_from_lifecycle() TO service_role;
GRANT EXECUTE ON FUNCTION public.stamp_document_sidecar_organization() TO service_role;

NOTIFY pgrst, 'reload schema';
