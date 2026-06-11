-- Phase 2a: Decompose documents god aggregate into 1:1 sidecars.
-- Columns remain on documents for backward compatibility; sidecars are the
-- canonical store for new module code. AFTER triggers keep both in sync.

-- =============================================================================
-- 1. Sidecar tables (pattern: contract_details)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.document_registration (
  document_id uuid PRIMARY KEY REFERENCES public.documents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organization(id) ON DELETE RESTRICT,
  reg_number text NOT NULL DEFAULT '',
  registration_journal_id uuid REFERENCES public.ref_registration_journals(id) ON DELETE SET NULL,
  delivery_method_id uuid REFERENCES public.ref_delivery_methods(id) ON DELETE SET NULL,
  received_at timestamptz,
  sent_at timestamptz,
  pages_count int,
  copies_count int,
  external_reg_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_classification (
  document_id uuid PRIMARY KEY REFERENCES public.documents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organization(id) ON DELETE RESTRICT,
  doc_type text NOT NULL DEFAULT 'general',
  document_type_id uuid REFERENCES public.ref_document_types(id) ON DELETE SET NULL,
  priority_id uuid REFERENCES public.ref_priorities(id) ON DELETE SET NULL,
  correspondent_id uuid REFERENCES public.ref_correspondents(id) ON DELETE SET NULL,
  nomenclature_id uuid REFERENCES public.nomenclature_items(id) ON DELETE SET NULL,
  access_level_id uuid REFERENCES public.ref_access_levels(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_archive (
  document_id uuid PRIMARY KEY REFERENCES public.documents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organization(id) ON DELETE RESTRICT,
  archived_at timestamptz,
  archive_location_id uuid REFERENCES public.ref_archive_locations(id) ON DELETE SET NULL,
  retention_period_id uuid REFERENCES public.ref_retention_periods(id) ON DELETE SET NULL,
  retention_due_at timestamptz,
  legal_hold boolean NOT NULL DEFAULT false,
  legal_hold_note text,
  legal_hold_at timestamptz,
  legal_hold_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_lifecycle (
  document_id uuid PRIMARY KEY REFERENCES public.documents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organization(id) ON DELETE RESTRICT,
  due_at timestamptz,
  sla_status public.sla_status NOT NULL DEFAULT 'ok',
  workflow_id uuid REFERENCES public.workflows(id) ON DELETE SET NULL,
  custom_route jsonb,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_document_registration_org_reg
  ON public.document_registration (organization_id, reg_number)
  WHERE btrim(reg_number) <> '';
CREATE INDEX IF NOT EXISTS idx_document_registration_journal
  ON public.document_registration (registration_journal_id);
CREATE INDEX IF NOT EXISTS idx_document_registration_received_at
  ON public.document_registration (received_at);
CREATE INDEX IF NOT EXISTS idx_document_registration_sent_at
  ON public.document_registration (sent_at);

CREATE INDEX IF NOT EXISTS idx_document_classification_type
  ON public.document_classification (document_type_id);
CREATE INDEX IF NOT EXISTS idx_document_classification_priority
  ON public.document_classification (priority_id);
CREATE INDEX IF NOT EXISTS idx_document_classification_correspondent
  ON public.document_classification (correspondent_id);
CREATE INDEX IF NOT EXISTS idx_document_classification_nomenclature
  ON public.document_classification (nomenclature_id);
CREATE INDEX IF NOT EXISTS idx_document_classification_access_level
  ON public.document_classification (access_level_id);

CREATE INDEX IF NOT EXISTS idx_document_archive_retention_due
  ON public.document_archive (retention_due_at)
  WHERE retention_due_at IS NOT NULL AND legal_hold = false;
CREATE INDEX IF NOT EXISTS idx_document_archive_legal_hold
  ON public.document_archive (legal_hold) WHERE legal_hold;
CREATE INDEX IF NOT EXISTS idx_document_archive_location
  ON public.document_archive (archive_location_id);

CREATE INDEX IF NOT EXISTS idx_document_lifecycle_due_at
  ON public.document_lifecycle (due_at);
CREATE INDEX IF NOT EXISTS idx_document_lifecycle_sla_status
  ON public.document_lifecycle (sla_status);
CREATE INDEX IF NOT EXISTS idx_document_lifecycle_workflow
  ON public.document_lifecycle (workflow_id);
CREATE INDEX IF NOT EXISTS idx_document_lifecycle_assigned_to
  ON public.document_lifecycle (assigned_to);

CREATE INDEX IF NOT EXISTS idx_document_registration_organization_id
  ON public.document_registration (organization_id);
CREATE INDEX IF NOT EXISTS idx_document_classification_organization_id
  ON public.document_classification (organization_id);
CREATE INDEX IF NOT EXISTS idx_document_archive_organization_id
  ON public.document_archive (organization_id);
CREATE INDEX IF NOT EXISTS idx_document_lifecycle_organization_id
  ON public.document_lifecycle (organization_id);

-- =============================================================================
-- 2. Backfill from documents
-- =============================================================================

INSERT INTO public.document_registration (
  document_id, organization_id, reg_number, registration_journal_id,
  delivery_method_id, received_at, sent_at, pages_count, copies_count,
  external_reg_number, created_at, updated_at
)
SELECT
  d.id,
  COALESCE(d.organization_id, (SELECT id FROM public.organization ORDER BY created_at LIMIT 1)),
  coalesce(d.reg_number, ''),
  d.registration_journal_id,
  d.delivery_method_id,
  d.received_at,
  d.sent_at,
  d.pages_count,
  d.copies_count,
  d.external_reg_number,
  d.created_at,
  d.updated_at
FROM public.documents d
ON CONFLICT (document_id) DO NOTHING;

INSERT INTO public.document_classification (
  document_id, organization_id, doc_type, document_type_id, priority_id,
  correspondent_id, nomenclature_id, access_level_id, created_at, updated_at
)
SELECT
  d.id,
  COALESCE(d.organization_id, (SELECT id FROM public.organization ORDER BY created_at LIMIT 1)),
  coalesce(d.doc_type, 'general'),
  d.document_type_id,
  d.priority_id,
  d.correspondent_id,
  d.nomenclature_id,
  d.access_level_id,
  d.created_at,
  d.updated_at
FROM public.documents d
ON CONFLICT (document_id) DO NOTHING;

INSERT INTO public.document_archive (
  document_id, organization_id, archived_at, archive_location_id,
  retention_period_id, retention_due_at, legal_hold, legal_hold_note,
  legal_hold_at, legal_hold_by, created_at, updated_at
)
SELECT
  d.id,
  COALESCE(d.organization_id, (SELECT id FROM public.organization ORDER BY created_at LIMIT 1)),
  d.archived_at,
  d.archive_location_id,
  d.retention_period_id,
  d.retention_due_at,
  coalesce(d.legal_hold, false),
  d.legal_hold_note,
  d.legal_hold_at,
  d.legal_hold_by,
  d.created_at,
  d.updated_at
FROM public.documents d
ON CONFLICT (document_id) DO NOTHING;

INSERT INTO public.document_lifecycle (
  document_id, organization_id, due_at, sla_status, workflow_id,
  custom_route, assigned_to, created_at, updated_at
)
SELECT
  d.id,
  COALESCE(d.organization_id, (SELECT id FROM public.organization ORDER BY created_at LIMIT 1)),
  d.due_at,
  coalesce(d.sla_status, 'ok'::public.sla_status),
  d.workflow_id,
  d.custom_route,
  d.assigned_to,
  d.created_at,
  d.updated_at
FROM public.documents d
ON CONFLICT (document_id) DO NOTHING;

-- =============================================================================
-- 3. Bidirectional sync (fm.skip_sidecar_sync prevents recursion)
-- =============================================================================

CREATE OR REPLACE FUNCTION private.sidecar_sync_skipped()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('fm.skip_sidecar_sync', true) = '1';
$$;

CREATE OR REPLACE FUNCTION private.begin_sidecar_sync()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('fm.skip_sidecar_sync', '1', true);
END;
$$;

CREATE OR REPLACE FUNCTION private.end_sidecar_sync()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('fm.skip_sidecar_sync', '0', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_document_sidecars_from_documents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_org uuid;
BEGIN
  IF private.sidecar_sync_skipped() THEN
    RETURN NEW;
  END IF;

  v_org := COALESCE(
    NEW.organization_id,
    public.effective_organization_id(),
    public.current_organization_id()
  );

  PERFORM private.begin_sidecar_sync();

  INSERT INTO public.document_registration (
    document_id, organization_id, reg_number, registration_journal_id,
    delivery_method_id, received_at, sent_at, pages_count, copies_count,
    external_reg_number, updated_at
  ) VALUES (
    NEW.id, v_org, coalesce(NEW.reg_number, ''), NEW.registration_journal_id,
    NEW.delivery_method_id, NEW.received_at, NEW.sent_at, NEW.pages_count, NEW.copies_count,
    NEW.external_reg_number, now()
  )
  ON CONFLICT (document_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    reg_number = EXCLUDED.reg_number,
    registration_journal_id = EXCLUDED.registration_journal_id,
    delivery_method_id = EXCLUDED.delivery_method_id,
    received_at = EXCLUDED.received_at,
    sent_at = EXCLUDED.sent_at,
    pages_count = EXCLUDED.pages_count,
    copies_count = EXCLUDED.copies_count,
    external_reg_number = EXCLUDED.external_reg_number,
    updated_at = now();

  INSERT INTO public.document_classification (
    document_id, organization_id, doc_type, document_type_id, priority_id,
    correspondent_id, nomenclature_id, access_level_id, updated_at
  ) VALUES (
    NEW.id, v_org, coalesce(NEW.doc_type, 'general'), NEW.document_type_id,
    NEW.priority_id, NEW.correspondent_id, NEW.nomenclature_id, NEW.access_level_id, now()
  )
  ON CONFLICT (document_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    doc_type = EXCLUDED.doc_type,
    document_type_id = EXCLUDED.document_type_id,
    priority_id = EXCLUDED.priority_id,
    correspondent_id = EXCLUDED.correspondent_id,
    nomenclature_id = EXCLUDED.nomenclature_id,
    access_level_id = EXCLUDED.access_level_id,
    updated_at = now();

  INSERT INTO public.document_archive (
    document_id, organization_id, archived_at, archive_location_id,
    retention_period_id, retention_due_at, legal_hold, legal_hold_note,
    legal_hold_at, legal_hold_by, updated_at
  ) VALUES (
    NEW.id, v_org, NEW.archived_at, NEW.archive_location_id,
    NEW.retention_period_id, NEW.retention_due_at, coalesce(NEW.legal_hold, false),
    NEW.legal_hold_note, NEW.legal_hold_at, NEW.legal_hold_by, now()
  )
  ON CONFLICT (document_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    archived_at = EXCLUDED.archived_at,
    archive_location_id = EXCLUDED.archive_location_id,
    retention_period_id = EXCLUDED.retention_period_id,
    retention_due_at = EXCLUDED.retention_due_at,
    legal_hold = EXCLUDED.legal_hold,
    legal_hold_note = EXCLUDED.legal_hold_note,
    legal_hold_at = EXCLUDED.legal_hold_at,
    legal_hold_by = EXCLUDED.legal_hold_by,
    updated_at = now();

  INSERT INTO public.document_lifecycle (
    document_id, organization_id, due_at, sla_status, workflow_id,
    custom_route, assigned_to, updated_at
  ) VALUES (
    NEW.id, v_org, NEW.due_at, NEW.sla_status, NEW.workflow_id,
    NEW.custom_route, NEW.assigned_to, now()
  )
  ON CONFLICT (document_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    due_at = EXCLUDED.due_at,
    sla_status = EXCLUDED.sla_status,
    workflow_id = EXCLUDED.workflow_id,
    custom_route = EXCLUDED.custom_route,
    assigned_to = EXCLUDED.assigned_to,
    updated_at = now();

  PERFORM private.end_sidecar_sync();
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM private.end_sidecar_sync();
    RAISE;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.sync_documents_from_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF private.sidecar_sync_skipped() THEN
    RETURN NEW;
  END IF;

  PERFORM private.begin_sidecar_sync();
  UPDATE public.documents SET
    reg_number = NEW.reg_number,
    registration_journal_id = NEW.registration_journal_id,
    delivery_method_id = NEW.delivery_method_id,
    received_at = NEW.received_at,
    sent_at = NEW.sent_at,
    pages_count = NEW.pages_count,
    copies_count = NEW.copies_count,
    external_reg_number = NEW.external_reg_number,
    updated_at = now()
  WHERE id = NEW.document_id;
  PERFORM private.end_sidecar_sync();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM private.end_sidecar_sync();
    RAISE;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.sync_documents_from_classification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF private.sidecar_sync_skipped() THEN
    RETURN NEW;
  END IF;

  PERFORM private.begin_sidecar_sync();
  UPDATE public.documents SET
    doc_type = NEW.doc_type,
    document_type_id = NEW.document_type_id,
    priority_id = NEW.priority_id,
    correspondent_id = NEW.correspondent_id,
    nomenclature_id = NEW.nomenclature_id,
    access_level_id = NEW.access_level_id,
    updated_at = now()
  WHERE id = NEW.document_id;
  PERFORM private.end_sidecar_sync();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM private.end_sidecar_sync();
    RAISE;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.sync_documents_from_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF private.sidecar_sync_skipped() THEN
    RETURN NEW;
  END IF;

  PERFORM private.begin_sidecar_sync();
  UPDATE public.documents SET
    archived_at = NEW.archived_at,
    archive_location_id = NEW.archive_location_id,
    retention_period_id = NEW.retention_period_id,
    retention_due_at = NEW.retention_due_at,
    legal_hold = NEW.legal_hold,
    legal_hold_note = NEW.legal_hold_note,
    legal_hold_at = NEW.legal_hold_at,
    legal_hold_by = NEW.legal_hold_by,
    updated_at = now()
  WHERE id = NEW.document_id;
  PERFORM private.end_sidecar_sync();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM private.end_sidecar_sync();
    RAISE;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.sync_documents_from_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF private.sidecar_sync_skipped() THEN
    RETURN NEW;
  END IF;

  PERFORM private.begin_sidecar_sync();
  UPDATE public.documents SET
    due_at = NEW.due_at,
    sla_status = NEW.sla_status,
    workflow_id = NEW.workflow_id,
    custom_route = NEW.custom_route,
    assigned_to = NEW.assigned_to,
    updated_at = now()
  WHERE id = NEW.document_id;
  PERFORM private.end_sidecar_sync();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM private.end_sidecar_sync();
    RAISE;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_documents_sync_sidecars ON public.documents;
CREATE TRIGGER trg_documents_sync_sidecars
  AFTER INSERT OR UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.sync_document_sidecars_from_documents();

DROP TRIGGER IF EXISTS trg_document_registration_sync_root ON public.document_registration;
CREATE TRIGGER trg_document_registration_sync_root
  AFTER INSERT OR UPDATE ON public.document_registration
  FOR EACH ROW EXECUTE FUNCTION public.sync_documents_from_registration();

DROP TRIGGER IF EXISTS trg_document_classification_sync_root ON public.document_classification;
CREATE TRIGGER trg_document_classification_sync_root
  AFTER INSERT OR UPDATE ON public.document_classification
  FOR EACH ROW EXECUTE FUNCTION public.sync_documents_from_classification();

DROP TRIGGER IF EXISTS trg_document_archive_sync_root ON public.document_archive;
CREATE TRIGGER trg_document_archive_sync_root
  AFTER INSERT OR UPDATE ON public.document_archive
  FOR EACH ROW EXECUTE FUNCTION public.sync_documents_from_archive();

DROP TRIGGER IF EXISTS trg_document_lifecycle_sync_root ON public.document_lifecycle;
CREATE TRIGGER trg_document_lifecycle_sync_root
  AFTER INSERT OR UPDATE ON public.document_lifecycle
  FOR EACH ROW EXECUTE FUNCTION public.sync_documents_from_lifecycle();

-- updated_at on sidecars
DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'document_registration',
    'document_classification',
    'document_archive',
    'document_lifecycle'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_uat ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_uat BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END $do$;

-- Stamp organization_id from parent document on INSERT
CREATE OR REPLACE FUNCTION public.stamp_document_sidecar_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_doc_id uuid;
  v_row jsonb;
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_row := to_jsonb(NEW);
  IF v_row ? 'document_id' THEN
    v_doc_id := NULLIF(trim(v_row->>'document_id'), '')::uuid;
  END IF;

  IF v_doc_id IS NOT NULL THEN
    SELECT d.organization_id INTO NEW.organization_id
    FROM public.documents d
    WHERE d.id = v_doc_id;
  END IF;

  NEW.organization_id := COALESCE(
    NEW.organization_id,
    public.effective_organization_id(),
    public.current_organization_id()
  );

  RETURN NEW;
END;
$fn$;

DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'document_registration',
    'document_classification',
    'document_archive',
    'document_lifecycle'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_set_org ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_set_org BEFORE INSERT ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.stamp_document_sidecar_organization()',
      t, t
    );
  END LOOP;
END $do$;

-- =============================================================================
-- 4. RLS (inherit document access)
-- =============================================================================

ALTER TABLE public.document_registration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_classification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_lifecycle ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_registration TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_classification TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_archive TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_lifecycle TO authenticated;

GRANT ALL ON public.document_registration TO service_role;
GRANT ALL ON public.document_classification TO service_role;
GRANT ALL ON public.document_archive TO service_role;
GRANT ALL ON public.document_lifecycle TO service_role;

-- SELECT: tenant + document visibility
DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'document_registration',
    'document_classification',
    'document_archive',
    'document_lifecycle'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated
         USING (
           public.tenant_matches(organization_id)
           AND (
             public.user_has_permission(auth.uid(), ''view_all_documents'')
             OR EXISTS (
               SELECT 1 FROM public.documents d
               WHERE d.id = %I.document_id
                 AND (d.created_by = auth.uid() OR d.assigned_to = auth.uid())
             )
             OR public.can_view_document(%I.document_id, auth.uid())
           )
         )',
      t, t, t, t
    );
  END LOOP;
END $do$;

-- WRITE: manage_documents / domain permissions / author
DROP POLICY IF EXISTS document_registration_write ON public.document_registration;
CREATE POLICY document_registration_write ON public.document_registration FOR ALL TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (
      public.user_has_permission(auth.uid(), 'register_documents')
      OR public.user_has_permission(auth.uid(), 'manage_documents')
      OR EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = document_registration.document_id AND d.created_by = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.tenant_matches(organization_id)
    AND (
      public.user_has_permission(auth.uid(), 'register_documents')
      OR public.user_has_permission(auth.uid(), 'manage_documents')
      OR EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = document_registration.document_id AND d.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS document_classification_write ON public.document_classification;
CREATE POLICY document_classification_write ON public.document_classification FOR ALL TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (
      public.user_has_permission(auth.uid(), 'manage_documents')
      OR EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = document_classification.document_id AND d.created_by = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.tenant_matches(organization_id)
    AND (
      public.user_has_permission(auth.uid(), 'manage_documents')
      OR EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = document_classification.document_id AND d.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS document_archive_write ON public.document_archive;
CREATE POLICY document_archive_write ON public.document_archive FOR ALL TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (
      public.user_has_permission(auth.uid(), 'archive_documents')
      OR public.user_has_permission(auth.uid(), 'manage_documents')
      OR EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = document_archive.document_id AND d.created_by = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.tenant_matches(organization_id)
    AND (
      public.user_has_permission(auth.uid(), 'archive_documents')
      OR public.user_has_permission(auth.uid(), 'manage_documents')
      OR EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = document_archive.document_id AND d.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS document_lifecycle_write ON public.document_lifecycle;
CREATE POLICY document_lifecycle_write ON public.document_lifecycle FOR ALL TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (
      public.user_has_permission(auth.uid(), 'manage_documents')
      OR public.user_has_permission(auth.uid(), 'approve_documents')
      OR EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = document_lifecycle.document_id
          AND (d.created_by = auth.uid() OR d.assigned_to = auth.uid())
      )
    )
  )
  WITH CHECK (
    public.tenant_matches(organization_id)
    AND (
      public.user_has_permission(auth.uid(), 'manage_documents')
      OR public.user_has_permission(auth.uid(), 'approve_documents')
      OR EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = document_lifecycle.document_id
          AND (d.created_by = auth.uid() OR d.assigned_to = auth.uid())
      )
    )
  );

NOTIFY pgrst, 'reload schema';
