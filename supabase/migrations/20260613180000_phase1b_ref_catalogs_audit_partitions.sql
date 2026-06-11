-- Phase 1b: hybrid tenant scope for ref_* catalogs + monthly audit_logs partitioning.

-- =============================================================================
-- 1. ref_catalog_policies — global seeds (org NULL) + tenant overrides
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ref_catalog_policies(
  _table text,
  _permission text DEFAULT 'manage_references',
  _tenant_scoped boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', _table);

  EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', _table, _table);
  IF _tenant_scoped THEN
    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated
         USING (organization_id IS NULL OR public.tenant_matches(organization_id))',
      _table,
      _table
    );
  ELSE
    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (true)',
      _table,
      _table
    );
  END IF;

  EXECUTE format('DROP POLICY IF EXISTS %I_manage ON public.%I', _table, _table);
  IF _tenant_scoped THEN
    EXECUTE format(
      'CREATE POLICY %I_manage ON public.%I FOR ALL TO authenticated
         USING (
           public.user_has_permission(auth.uid(), %L)
           AND (
             (organization_id IS NULL AND public.user_has_permission(auth.uid(), ''manage_platform''))
             OR public.tenant_matches(organization_id)
           )
         )
         WITH CHECK (
           public.user_has_permission(auth.uid(), %L)
           AND (
             (organization_id IS NULL AND public.user_has_permission(auth.uid(), ''manage_platform''))
             OR public.tenant_matches(organization_id)
           )
         )',
      _table,
      _table,
      _permission,
      _permission
    );
  ELSE
    EXECUTE format(
      'CREATE POLICY %I_manage ON public.%I FOR ALL TO authenticated
         USING (public.user_has_permission(auth.uid(), %L))
         WITH CHECK (public.user_has_permission(auth.uid(), %L))',
      _table,
      _table,
      _permission,
      _permission
    );
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.ref_catalog_unique_indexes(_table text, _tenant_scoped boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  old_con text;
BEGIN
  SELECT c.conname INTO old_con
  FROM pg_constraint c
  JOIN pg_class rel ON rel.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  WHERE n.nspname = 'public'
    AND rel.relname = _table
    AND c.contype = 'u'
    AND array_length(c.conkey, 1) = 1
    AND EXISTS (
      SELECT 1
      FROM pg_attribute a
      WHERE a.attrelid = rel.oid
        AND a.attnum = c.conkey[1]
        AND a.attname = 'code'
    )
  LIMIT 1;

  IF old_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', _table, old_con);
  END IF;

  IF _tenant_scoped THEN
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (code) WHERE organization_id IS NULL',
      _table || '_code_global_uq',
      _table
    );
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (organization_id, code) WHERE organization_id IS NOT NULL',
      _table || '_org_code_uq',
      _table
    );
  END IF;
END;
$fn$;

DO $do$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'ref_document_types',
    'ref_template_categories',
    'ref_correspondents',
    'ref_delivery_methods',
    'ref_priorities',
    'ref_retention_periods',
    'ref_registration_journals',
    'ref_archive_locations',
    'ref_rejection_reasons',
    'ref_document_link_types',
    'ref_absence_types',
    'ref_duty_roles'
  ];
  global_tables text[] := ARRAY[
    'ref_access_levels',
    'ref_department_kinds'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organization(id) ON DELETE RESTRICT',
      t
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (organization_id)',
      'idx_' || t || '_organization_id',
      t
    );

    -- Drop legacy policy names (HR / scheduling modules)
    IF t = 'ref_absence_types' THEN
      EXECUTE 'DROP POLICY IF EXISTS absence_types_read ON public.ref_absence_types';
      EXECUTE 'DROP POLICY IF EXISTS absence_types_admin ON public.ref_absence_types';
    ELSIF t = 'ref_duty_roles' THEN
      EXECUTE 'DROP POLICY IF EXISTS duty_roles_read ON public.ref_duty_roles';
      EXECUTE 'DROP POLICY IF EXISTS duty_roles_admin ON public.ref_duty_roles';
    END IF;

    PERFORM public.ref_catalog_unique_indexes(t, true);
    PERFORM public.ref_catalog_policies(t, 'manage_references', true);

    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_set_org ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_set_org BEFORE INSERT ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_row_organization_id()',
      t,
      t
    );
  END LOOP;

  FOREACH t IN ARRAY global_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    PERFORM public.ref_catalog_policies(t, 'manage_references', false);
  END LOOP;
END $do$;

-- duty_roles: backfill organization_id from department
UPDATE public.ref_duty_roles dr
SET organization_id = d.organization_id
FROM public.departments d
WHERE dr.department_id = d.id
  AND dr.organization_id IS NULL
  AND d.organization_id IS NOT NULL;

-- =============================================================================
-- 2. audit_logs — RANGE partition by month (created_at)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ensure_audit_log_partitions(
  _parent regclass DEFAULT 'public.audit_logs'::regclass,
  _from_month date DEFAULT NULL,
  _months_ahead int DEFAULT 3
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  parent_name text;
  start_month date;
  end_month date;
  m date;
  part_name text;
BEGIN
  IF _parent IS NULL OR to_regclass(_parent::text) IS NULL THEN
    RETURN;
  END IF;

  parent_name := _parent::text;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    WHERE c.oid = _parent
      AND c.relkind = 'p'
  ) THEN
    RETURN;
  END IF;

  IF _from_month IS NULL THEN
    EXECUTE format(
      'SELECT COALESCE(date_trunc(''month'', min(created_at))::date, date_trunc(''month'', now())::date)
       FROM %s',
      parent_name
    ) INTO start_month;
  ELSE
    start_month := _from_month;
  END IF;

  end_month := (date_trunc('month', now()) + make_interval(months => _months_ahead))::date;

  m := start_month;
  WHILE m <= end_month LOOP
    part_name := format('audit_logs_y%sm%s', to_char(m, 'YYYY'), to_char(m, 'MM'));
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF %s
       FOR VALUES FROM (%L) TO (%L)',
      part_name,
      parent_name,
      m,
      (m + interval '1 month')::date
    );
    m := (m + interval '1 month')::date;
  END LOOP;
END;
$fn$;

DO $do$
BEGIN
  -- Recover from a failed prior partition attempt (idempotent).
  IF to_regclass('public.audit_logs_pre_partition') IS NOT NULL
     AND to_regclass('public.audit_logs') IS NULL THEN
    ALTER TABLE public.audit_logs_pre_partition RENAME TO audit_logs;
  END IF;

  DROP TABLE IF EXISTS public.audit_logs_pre_partition;
  DROP TABLE IF EXISTS public.audit_logs_partitioned;

  IF to_regclass('public.audit_logs') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'audit_logs'
      AND c.relkind = 'p'
  ) THEN
    -- Failed swap may leave the old heap as audit_logs_pre_partition.
    DROP TABLE IF EXISTS public.audit_logs_pre_partition CASCADE;
    PERFORM public.ensure_audit_log_partitions('public.audit_logs'::regclass, NULL, 3);
    RETURN;
  END IF;

  ALTER TABLE public.audit_logs ALTER COLUMN id DROP DEFAULT;
  ALTER SEQUENCE public.audit_logs_id_seq OWNED BY NONE;

  CREATE TABLE public.audit_logs_partitioned (
    id bigint NOT NULL DEFAULT nextval('public.audit_logs_id_seq'::regclass),
    actor_id uuid,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    action text NOT NULL,
    before jsonb,
    after jsonb,
    ip text,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now(),
    correlation_id uuid,
    organization_id uuid REFERENCES public.organization(id) ON DELETE SET NULL,
    PRIMARY KEY (id, created_at)
  ) PARTITION BY RANGE (created_at);

  PERFORM public.ensure_audit_log_partitions(
    'public.audit_logs_partitioned'::regclass,
    COALESCE(
      (SELECT date_trunc('month', min(created_at))::date FROM public.audit_logs),
      date_trunc('month', now())::date
    ),
    GREATEST(
      3,
      COALESCE(
        (
          EXTRACT(YEAR FROM age(
            date_trunc('month', COALESCE((SELECT max(created_at) FROM public.audit_logs), now())),
            date_trunc('month', COALESCE((SELECT min(created_at) FROM public.audit_logs), now()))
          )) * 12
          + EXTRACT(MONTH FROM age(
            date_trunc('month', COALESCE((SELECT max(created_at) FROM public.audit_logs), now())),
            date_trunc('month', COALESCE((SELECT min(created_at) FROM public.audit_logs), now()))
          ))
        )::int + 1,
        3
      )
    )
  );

  CREATE TABLE IF NOT EXISTS public.audit_logs_default
    PARTITION OF public.audit_logs_partitioned DEFAULT;

  INSERT INTO public.audit_logs_partitioned (
    id, actor_id, entity_type, entity_id, action, before, after,
    ip, user_agent, created_at, correlation_id, organization_id
  )
  SELECT
    id, actor_id, entity_type, entity_id, action, before, after,
    ip, user_agent, created_at, correlation_id, organization_id
  FROM public.audit_logs;

  PERFORM setval(
    'public.audit_logs_id_seq',
    COALESCE((SELECT max(id) FROM public.audit_logs_partitioned), 1),
    true
  );

  ALTER TABLE public.audit_logs RENAME TO audit_logs_pre_partition;
  ALTER TABLE public.audit_logs_partitioned RENAME TO audit_logs;

  ALTER TABLE public.audit_logs_pre_partition ALTER COLUMN id DROP DEFAULT;
  ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs_default.id;

  DROP TABLE public.audit_logs_pre_partition CASCADE;
END $do$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created
  ON public.audit_logs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_brin
  ON public.audit_logs USING brin (created_at);

CREATE INDEX IF NOT EXISTS idx_audit_entity
  ON public.audit_logs (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_correlation
  ON public.audit_logs (correlation_id)
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_actor
  ON public.audit_logs (actor_id, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_admin" ON public.audit_logs;
CREATE POLICY "audit_select_admin" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    (organization_id IS NULL OR public.tenant_matches(organization_id))
    AND (
      public.user_has_permission(auth.uid(), 'view_audit')
      OR actor_id = auth.uid()
    )
  );

REVOKE INSERT ON public.audit_logs FROM authenticated;
REVOKE USAGE, SELECT ON SEQUENCE public.audit_logs_id_seq FROM authenticated;

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.audit_logs_id_seq TO service_role;

-- Re-assert function + grants (cleanup DROP must not use CASCADE on partitioned stub).
CREATE OR REPLACE FUNCTION public.ensure_audit_log_partitions(
  _parent regclass DEFAULT 'public.audit_logs'::regclass,
  _from_month date DEFAULT NULL,
  _months_ahead int DEFAULT 3
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  parent_name text;
  start_month date;
  end_month date;
  m date;
  part_name text;
BEGIN
  IF _parent IS NULL OR to_regclass(_parent::text) IS NULL THEN
    RETURN;
  END IF;

  parent_name := _parent::text;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    WHERE c.oid = _parent
      AND c.relkind = 'p'
  ) THEN
    RETURN;
  END IF;

  IF _from_month IS NULL THEN
    EXECUTE format(
      'SELECT COALESCE(date_trunc(''month'', min(created_at))::date, date_trunc(''month'', now())::date)
       FROM %s',
      parent_name
    ) INTO start_month;
  ELSE
    start_month := _from_month;
  END IF;

  end_month := (date_trunc('month', now()) + make_interval(months => _months_ahead))::date;

  m := start_month;
  WHILE m <= end_month LOOP
    part_name := format('audit_logs_y%sm%s', to_char(m, 'YYYY'), to_char(m, 'MM'));
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF %s
       FOR VALUES FROM (%L) TO (%L)',
      part_name,
      parent_name,
      m,
      (m + interval '1 month')::date
    );
    m := (m + interval '1 month')::date;
  END LOOP;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.ensure_audit_log_partitions(regclass, date, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_audit_log_partitions(regclass, date, int) TO service_role;

NOTIFY pgrst, 'reload schema';
