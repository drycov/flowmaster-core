-- Phase 0/1: registration journals, correspondence fields, FTS search

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS registration_journal_id uuid
    REFERENCES public.ref_registration_journals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_method_id uuid
    REFERENCES public.ref_delivery_methods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS access_level_id uuid
    REFERENCES public.ref_access_levels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_location_id uuid
    REFERENCES public.ref_archive_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS pages_count int,
  ADD COLUMN IF NOT EXISTS copies_count int,
  ADD COLUMN IF NOT EXISTS external_reg_number text;

CREATE INDEX IF NOT EXISTS idx_documents_registration_journal_id
  ON public.documents(registration_journal_id);
CREATE INDEX IF NOT EXISTS idx_documents_document_type_id
  ON public.documents(document_type_id);
CREATE INDEX IF NOT EXISTS idx_documents_received_at ON public.documents(received_at);
CREATE INDEX IF NOT EXISTS idx_documents_sent_at ON public.documents(sent_at);

CREATE OR REPLACE FUNCTION public.resolve_document_reg_prefix(_journal_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT NULLIF(btrim(j.prefix), '')
      FROM public.ref_registration_journals j
      WHERE j.id = _journal_id AND j.is_active
    ),
    (
      SELECT NULLIF(btrim(o.reg_number_prefix), '')
      FROM public.organization o
      LIMIT 1
    ),
    'DOC'
  );
$$;

CREATE OR REPLACE FUNCTION public.documents_before_ins_upd()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text := 'DOC';
BEGIN
  IF NEW.reg_number IS NULL OR btrim(NEW.reg_number) = '' THEN
    IF TG_OP = 'INSERT'
       OR (TG_OP = 'UPDATE' AND (OLD.reg_number IS NULL OR btrim(OLD.reg_number) = '')) THEN
      v_prefix := public.resolve_document_reg_prefix(NEW.registration_journal_id);
      NEW.reg_number := public.next_document_reg_number(v_prefix);
    END IF;
  END IF;

  NEW.search_tsv :=
    setweight(to_tsvector('simple', coalesce(NEW.reg_number, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.external_reg_number, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.title_ru, '') || ' ' || coalesce(NEW.title_kk, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.summary, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.body, '')), 'C');

  RETURN NEW;
END;
$$;

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
  FROM public.documents d
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

GRANT EXECUTE ON FUNCTION public.resolve_document_reg_prefix(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_documents_fts(text, text, text, uuid, text, int) TO authenticated, service_role;
