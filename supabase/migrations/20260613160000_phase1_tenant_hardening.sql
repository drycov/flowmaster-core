-- Phase 1 (Roadmap): tenant hardening — organization_id propagation, scoped uniqueness,
-- remove is_admin cross-tenant bypass from tenant_matches / document content checks.

-- =============================================================================
-- 1. organization_id on workflow + document child tables (backfill from documents)
-- =============================================================================

DO $do$
DECLARE
  v_org uuid;
  spec record;
BEGIN
  SELECT id INTO v_org FROM public.organization ORDER BY created_at LIMIT 1;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'organization row required';
  END IF;

  FOR spec IN
    SELECT *
    FROM (VALUES
      ('workflow_runs',        'document_id'),
      ('workflow_tasks',       'document_id'),
      ('workflow_events',      'document_id'),
      ('document_versions',    'document_id'),
      ('document_signatures',  'document_id'),
      ('document_comments',    'document_id'),
      ('document_access_grants','document_id'),
      ('document_correspondents','document_id'),
      ('contract_details',     'document_id'),
      ('document_links',       'source_document_id')
    ) AS t(table_name, doc_col)
  LOOP
    IF to_regclass('public.' || spec.table_name) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organization(id) ON DELETE RESTRICT',
      spec.table_name
    );

    EXECUTE format(
      'UPDATE public.%I child
       SET organization_id = d.organization_id
       FROM public.documents d
       WHERE child.%I = d.id
         AND child.organization_id IS NULL
         AND d.organization_id IS NOT NULL',
      spec.table_name,
      spec.doc_col
    );

    EXECUTE format(
      'UPDATE public.%I SET organization_id = $1 WHERE organization_id IS NULL',
      spec.table_name
    ) USING v_org;

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (organization_id)',
      'idx_' || spec.table_name || '_organization_id',
      spec.table_name
    );

    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_set_org ON public.%I', spec.table_name, spec.table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_set_org BEFORE INSERT ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_row_organization_id()',
      spec.table_name,
      spec.table_name
    );
  END LOOP;
END $do$;

-- positions: inherit from department (or default org)
ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organization(id) ON DELETE RESTRICT;

UPDATE public.positions p
SET organization_id = d.organization_id
FROM public.departments d
WHERE p.department_id = d.id
  AND p.organization_id IS NULL
  AND d.organization_id IS NOT NULL;

UPDATE public.positions
SET organization_id = (SELECT id FROM public.organization ORDER BY created_at LIMIT 1)
WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_positions_organization_id ON public.positions (organization_id);

DROP TRIGGER IF EXISTS trg_positions_set_org ON public.positions;
CREATE TRIGGER trg_positions_set_org
  BEFORE INSERT ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.set_row_organization_id();

-- schedule_plan_items: inherit from parent plan
ALTER TABLE public.schedule_plan_items
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organization(id) ON DELETE RESTRICT;

UPDATE public.schedule_plan_items spi
SET organization_id = sp.organization_id
FROM public.schedule_plans sp
WHERE spi.plan_id = sp.id
  AND spi.organization_id IS NULL
  AND sp.organization_id IS NOT NULL;

UPDATE public.schedule_plan_items
SET organization_id = (SELECT id FROM public.organization ORDER BY created_at LIMIT 1)
WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_plan_items_organization_id
  ON public.schedule_plan_items (organization_id);

DROP TRIGGER IF EXISTS trg_schedule_plan_items_set_org ON public.schedule_plan_items;
CREATE TRIGGER trg_schedule_plan_items_set_org
  BEFORE INSERT ON public.schedule_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.set_row_organization_id();

-- =============================================================================
-- 2. Stamp organization_id from parent document on INSERT (workflow / doc children)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.stamp_organization_from_document()
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

  IF TG_TABLE_NAME = 'document_links' AND v_row ? 'source_document_id' THEN
    v_doc_id := NULLIF(trim(v_row->>'source_document_id'), '')::uuid;
  ELSIF v_row ? 'document_id' THEN
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
    'workflow_runs',
    'workflow_tasks',
    'workflow_events',
    'document_versions',
    'document_signatures',
    'document_comments',
    'document_access_grants',
    'document_correspondents',
    'contract_details',
    'document_links'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_set_org ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_stamp_org BEFORE INSERT ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.stamp_organization_from_document()',
      t,
      t
    );
  END LOOP;
END $do$;

-- =============================================================================
-- 3. Tenant helpers — platform admin instead of is_admin bypass
-- =============================================================================

CREATE OR REPLACE FUNCTION private.tenant_matches(_row_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _row_org IS NOT DISTINCT FROM public.effective_organization_id()
    OR public.user_has_permission(auth.uid(), 'manage_platform');
$$;

CREATE OR REPLACE FUNCTION private.can_view_document_content(_doc_id uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.id = _doc_id
      AND (
        d.organization_id IS NULL
        OR d.organization_id IS NOT DISTINCT FROM public.user_organization_id(_user)
        OR public.user_has_permission(_user, 'manage_platform')
      )
      AND (
        public.is_admin(_user)
        OR d.created_by = _user
        OR d.assigned_to = _user
        OR EXISTS (
          SELECT 1
          FROM public.workflow_tasks t
          WHERE t.document_id = _doc_id
            AND t.assignee_id = _user
        )
        OR EXISTS (
          SELECT 1
          FROM public.document_access_grants g
          WHERE g.document_id = _doc_id
            AND g.user_id = _user
            AND g.status = 'approved'
            AND (g.expires_at IS NULL OR g.expires_at > now())
        )
        OR public.user_access_level_order(_user) >= public.document_access_level_order(_doc_id)
      )
  );
$$;

-- =============================================================================
-- 4. Per-tenant uniqueness (replace global UNIQUE constraints)
-- =============================================================================

DO $do$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT *
    FROM (VALUES
      ('documents',         'documents_reg_number_key',         'documents_org_reg_number_key',         ARRAY['organization_id', 'reg_number']),
      ('departments',       'departments_code_key',             'departments_org_code_key',             ARRAY['organization_id', 'code']),
      ('positions',         'positions_code_key',               'positions_org_code_key',               ARRAY['organization_id', 'code']),
      ('kb_articles',       'kb_articles_slug_key',             'kb_articles_org_slug_key',             ARRAY['organization_id', 'slug']),
      ('kb_categories',     'kb_categories_code_key',           'kb_categories_org_code_key',           ARRAY['organization_id', 'code']),
      ('document_projects', 'document_projects_code_key',       'document_projects_org_code_key',       ARRAY['organization_id', 'code']),
      ('schedule_plans',    'schedule_plans_code_key',          'schedule_plans_org_code_key',          ARRAY['organization_id', 'code'])
    ) AS u(tbl, old_con, new_con, cols)
  LOOP
    IF to_regclass('public.' || r.tbl) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.tbl, r.old_con);

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public'
        AND rel.relname = r.tbl
        AND c.conname = r.new_con
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (%s)',
        r.tbl,
        r.new_con,
        array_to_string(r.cols, ', ')
      );
    END IF;
  END LOOP;
END $do$;

NOTIFY pgrst, 'reload schema';
