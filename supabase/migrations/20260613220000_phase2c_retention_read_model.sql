-- Phase 2c: FTS read model via documents_full + retention logic on document_archive.

-- =============================================================================
-- 1. search_documents_fts — read from documents_full
-- =============================================================================

CREATE OR REPLACE FUNCTION public.search_documents_fts(
  _query text,
  _status text DEFAULT NULL,
  _document_type_code text DEFAULT NULL,
  _scope_user uuid DEFAULT NULL,
  _scope text DEFAULT 'all',
  _limit int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  reg_number text,
  title_ru text,
  title_kk text,
  status document_status,
  doc_type text,
  sla_status sla_status,
  due_at timestamptz,
  created_at timestamptz,
  rank real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q tsquery;
  v_clean text;
BEGIN
  v_clean := btrim(coalesce(_query, ''));
  IF length(v_clean) < 2 THEN
    RETURN;
  END IF;

  v_q := plainto_tsquery('simple', v_clean);

  RETURN QUERY
  SELECT
    d.id,
    d.reg_number,
    d.title_ru,
    d.title_kk,
    d.status,
    d.doc_type,
    d.sla_status,
    d.due_at,
    d.created_at,
    ts_rank(d.search_tsv, v_q) AS rank
  FROM public.documents_full d
  LEFT JOIN public.ref_document_types dt ON dt.id = d.document_type_id
  WHERE d.search_tsv @@ v_q
    AND (_status IS NULL OR d.status::text = _status)
    AND (_document_type_code IS NULL OR dt.code = _document_type_code OR d.doc_type = _document_type_code)
    AND (
      _scope = 'all'
      OR (_scope = 'mine' AND d.created_by = _scope_user)
      OR (_scope = 'assigned' AND d.assigned_to = _scope_user)
      OR (_scope = 'archive' AND d.status = 'archived')
    )
  ORDER BY rank DESC, d.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 200));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.search_documents_fts(text, text, text, uuid, text, int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_documents_fts(text, text, text, uuid, text, int)
  TO service_role;

-- =============================================================================
-- 2. Retention + legal hold on document_archive (canonical)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.document_archive_retention_before_ins_upd()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nomenclature_id uuid;
  v_base timestamptz;
BEGIN
  SELECT c.nomenclature_id, d.created_at
    INTO v_nomenclature_id, v_base
  FROM public.documents d
  LEFT JOIN public.document_classification c ON c.document_id = d.id
  WHERE d.id = NEW.document_id;

  IF TG_OP = 'INSERT'
     OR NEW.retention_period_id IS DISTINCT FROM OLD.retention_period_id THEN
    NEW.retention_due_at := public.resolve_document_retention_due(
      v_nomenclature_id,
      NEW.retention_period_id,
      COALESCE(v_base, now())
    );
  END IF;

  IF NEW.legal_hold = true AND (TG_OP = 'INSERT' OR OLD.legal_hold IS DISTINCT FROM true) THEN
    NEW.legal_hold_at := COALESCE(NEW.legal_hold_at, now());
  END IF;

  IF NEW.legal_hold = false AND TG_OP = 'UPDATE' AND OLD.legal_hold = true THEN
    NEW.legal_hold_at := NULL;
    NEW.legal_hold_by := NULL;
    NEW.legal_hold_note := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_archive_retention ON public.document_archive;
CREATE TRIGGER trg_document_archive_retention
  BEFORE INSERT OR UPDATE ON public.document_archive
  FOR EACH ROW EXECUTE FUNCTION public.document_archive_retention_before_ins_upd();

CREATE OR REPLACE FUNCTION public.document_classification_refresh_archive_retention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base timestamptz;
  v_period uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.nomenclature_id IS NOT DISTINCT FROM OLD.nomenclature_id THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.document_archive da WHERE da.document_id = NEW.document_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT d.created_at INTO v_base FROM public.documents d WHERE d.id = NEW.document_id;
  SELECT da.retention_period_id INTO v_period
  FROM public.document_archive da
  WHERE da.document_id = NEW.document_id;

  PERFORM private.begin_sidecar_sync();
  UPDATE public.document_archive da
     SET retention_due_at = public.resolve_document_retention_due(
       NEW.nomenclature_id,
       v_period,
       COALESCE(v_base, now())
     ),
     updated_at = now()
   WHERE da.document_id = NEW.document_id;
  PERFORM private.end_sidecar_sync();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_classification_refresh_retention ON public.document_classification;
CREATE TRIGGER trg_document_classification_refresh_retention
  AFTER INSERT OR UPDATE OF nomenclature_id ON public.document_classification
  FOR EACH ROW EXECUTE FUNCTION public.document_classification_refresh_archive_retention();

REVOKE EXECUTE ON FUNCTION public.document_archive_retention_before_ins_upd() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.document_classification_refresh_archive_retention() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.document_archive_retention_before_ins_upd() TO service_role;
GRANT EXECUTE ON FUNCTION public.document_classification_refresh_archive_retention() TO service_role;

NOTIFY pgrst, 'reload schema';
