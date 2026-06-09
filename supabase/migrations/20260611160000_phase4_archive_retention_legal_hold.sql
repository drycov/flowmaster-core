-- Phase 4: legal hold, retention automation, archive disposition

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS retention_period_id uuid
    REFERENCES public.ref_retention_periods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retention_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS legal_hold_note text,
  ADD COLUMN IF NOT EXISTS legal_hold_at timestamptz,
  ADD COLUMN IF NOT EXISTS legal_hold_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_retention_due_at
  ON public.documents(retention_due_at)
  WHERE retention_due_at IS NOT NULL AND legal_hold = false;
CREATE INDEX IF NOT EXISTS idx_documents_legal_hold ON public.documents(legal_hold) WHERE legal_hold;

CREATE OR REPLACE FUNCTION public.resolve_document_retention_due(
  _nomenclature_id uuid,
  _retention_period_id uuid,
  _base_at timestamptz DEFAULT now()
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_years int;
  v_permanent boolean := false;
BEGIN
  IF _retention_period_id IS NOT NULL THEN
    SELECT years, is_permanent
      INTO v_years, v_permanent
    FROM public.ref_retention_periods
    WHERE id = _retention_period_id AND is_active;
    IF v_permanent THEN RETURN NULL; END IF;
    IF v_years IS NOT NULL AND v_years > 0 THEN
      RETURN _base_at + make_interval(years => v_years);
    END IF;
  END IF;

  IF _nomenclature_id IS NOT NULL THEN
    SELECT retention_years INTO v_years
    FROM public.nomenclature_items
    WHERE id = _nomenclature_id;
    IF v_years IS NOT NULL AND v_years > 0 THEN
      RETURN _base_at + make_interval(years => v_years);
    END IF;
  END IF;

  RETURN _base_at + make_interval(years => 5);
END;
$$;

CREATE OR REPLACE FUNCTION public.documents_retention_before_ins_upd()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base timestamptz;
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.nomenclature_id IS DISTINCT FROM OLD.nomenclature_id
     OR NEW.retention_period_id IS DISTINCT FROM OLD.retention_period_id THEN
    v_base := COALESCE(NEW.created_at, now());
    NEW.retention_due_at := public.resolve_document_retention_due(
      NEW.nomenclature_id,
      NEW.retention_period_id,
      v_base
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

DROP TRIGGER IF EXISTS trg_documents_retention ON public.documents;
CREATE TRIGGER trg_documents_retention
  BEFORE INSERT OR UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.documents_retention_before_ins_upd();

-- Backfill retention_due_at for existing rows
UPDATE public.documents d
SET retention_due_at = public.resolve_document_retention_due(
  d.nomenclature_id,
  d.retention_period_id,
  COALESCE(d.archived_at, d.created_at, now())
)
WHERE d.retention_due_at IS NULL
  AND d.status NOT IN ('archived', 'cancelled');

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

  WITH moved AS (
    UPDATE public.documents d
       SET status = 'archived'::document_status,
           archived_at = COALESCE(d.archived_at, now())
     WHERE d.legal_hold = false
       AND d.status IN ('approved', 'signed')
       AND d.retention_due_at IS NOT NULL
       AND d.retention_due_at <= now()
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

GRANT EXECUTE ON FUNCTION public.resolve_document_retention_due(uuid, uuid, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_retention_tick() TO authenticated, service_role;
