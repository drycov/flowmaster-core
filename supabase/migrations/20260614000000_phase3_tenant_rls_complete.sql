-- Phase 3: Multi-tenant completion — org_id on integrations, per-tenant identity,
-- tenant RLS sweep, document access boundary, NOT NULL enforcement.

-- =============================================================================
-- 1. organization_id on integration + HR balance tables
-- =============================================================================

DO $do$
DECLARE
  v_org uuid;
BEGIN
  SELECT id INTO v_org FROM public.organization ORDER BY created_at LIMIT 1;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'organization row required before phase3 tenant migration';
  END IF;

  -- webhook_subscriptions
  IF to_regclass('public.webhook_subscriptions') IS NOT NULL THEN
    ALTER TABLE public.webhook_subscriptions
      ADD COLUMN IF NOT EXISTS organization_id uuid
      REFERENCES public.organization(id) ON DELETE RESTRICT;

    UPDATE public.webhook_subscriptions ws
    SET organization_id = p.organization_id
    FROM public.profiles p
    WHERE ws.created_by = p.id
      AND ws.organization_id IS NULL
      AND p.organization_id IS NOT NULL;

    UPDATE public.webhook_subscriptions
    SET organization_id = v_org
    WHERE organization_id IS NULL;

    CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_organization_id
      ON public.webhook_subscriptions (organization_id);

    DROP TRIGGER IF EXISTS trg_webhook_subscriptions_set_org ON public.webhook_subscriptions;
    CREATE TRIGGER trg_webhook_subscriptions_set_org
      BEFORE INSERT ON public.webhook_subscriptions
      FOR EACH ROW EXECUTE FUNCTION public.set_row_organization_id();
  END IF;

  -- webhook_outbox
  IF to_regclass('public.webhook_outbox') IS NOT NULL THEN
    ALTER TABLE public.webhook_outbox
      ADD COLUMN IF NOT EXISTS organization_id uuid
      REFERENCES public.organization(id) ON DELETE RESTRICT;

    UPDATE public.webhook_outbox wo
    SET organization_id = ws.organization_id
    FROM public.webhook_subscriptions ws
    WHERE wo.subscription_id = ws.id
      AND wo.organization_id IS NULL
      AND ws.organization_id IS NOT NULL;

    UPDATE public.webhook_outbox SET organization_id = v_org WHERE organization_id IS NULL;

    CREATE INDEX IF NOT EXISTS idx_webhook_outbox_organization_id
      ON public.webhook_outbox (organization_id);
  END IF;

  -- import_jobs
  IF to_regclass('public.import_jobs') IS NOT NULL THEN
    ALTER TABLE public.import_jobs
      ADD COLUMN IF NOT EXISTS organization_id uuid
      REFERENCES public.organization(id) ON DELETE RESTRICT;

    UPDATE public.import_jobs ij
    SET organization_id = p.organization_id
    FROM public.profiles p
    WHERE ij.created_by = p.id
      AND ij.organization_id IS NULL
      AND p.organization_id IS NOT NULL;

    UPDATE public.import_jobs ij
    SET organization_id = ak.organization_id
    FROM public.api_keys ak
    WHERE ij.api_key_id = ak.id
      AND ij.organization_id IS NULL
      AND ak.organization_id IS NOT NULL;

    UPDATE public.import_jobs SET organization_id = v_org WHERE organization_id IS NULL;

    CREATE INDEX IF NOT EXISTS idx_import_jobs_organization_id
      ON public.import_jobs (organization_id);

    DROP TRIGGER IF EXISTS trg_import_jobs_set_org ON public.import_jobs;
    CREATE TRIGGER trg_import_jobs_set_org
      BEFORE INSERT ON public.import_jobs
      FOR EACH ROW EXECUTE FUNCTION public.set_row_organization_id();
  END IF;

  -- leave_balances
  IF to_regclass('public.leave_balances') IS NOT NULL THEN
    ALTER TABLE public.leave_balances
      ADD COLUMN IF NOT EXISTS organization_id uuid
      REFERENCES public.organization(id) ON DELETE RESTRICT;

    UPDATE public.leave_balances lb
    SET organization_id = p.organization_id
    FROM public.profiles p
    WHERE lb.user_id = p.id
      AND lb.organization_id IS NULL
      AND p.organization_id IS NOT NULL;

    UPDATE public.leave_balances SET organization_id = v_org WHERE organization_id IS NULL;

    CREATE INDEX IF NOT EXISTS idx_leave_balances_organization_id
      ON public.leave_balances (organization_id);

    ALTER TABLE public.leave_balances
      DROP CONSTRAINT IF EXISTS leave_balances_user_id_year_key;

    CREATE UNIQUE INDEX IF NOT EXISTS leave_balances_org_user_year_key
      ON public.leave_balances (organization_id, user_id, year);
  END IF;
END $do$;

-- =============================================================================
-- 2. Webhook queue — deliver only within tenant boundary
-- =============================================================================

DROP FUNCTION IF EXISTS public.queue_webhook_event(text, jsonb);

CREATE OR REPLACE FUNCTION public.queue_webhook_event(
  _event text,
  _payload jsonb,
  _organization_id uuid DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  INSERT INTO public.webhook_outbox (subscription_id, event, payload, organization_id)
  SELECT s.id, _event, _payload, COALESCE(_organization_id, s.organization_id)
  FROM public.webhook_subscriptions s
  WHERE s.is_active
    AND _event = ANY(s.events)
    AND (
      _organization_id IS NULL
      OR s.organization_id IS NULL
      OR s.organization_id = _organization_id
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.queue_webhook_event(text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_webhook_event(text, jsonb, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_webhook_task_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT d.organization_id INTO v_org
  FROM public.documents d
  WHERE d.id = NEW.document_id;

  PERFORM public.queue_webhook_event(
    'task.created',
    jsonb_build_object(
      'task_id', NEW.id,
      'document_id', NEW.document_id,
      'assignee_id', NEW.assignee_id,
      'node_type', NEW.node_type,
      'status', NEW.status,
      'due_at', NEW.due_at
    ),
    v_org
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_webhook_document_signed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NEW.status = 'signed' THEN
    SELECT d.organization_id INTO v_org
    FROM public.documents d
    WHERE d.id = NEW.document_id;

    PERFORM public.queue_webhook_event(
      'document.signed',
      jsonb_build_object(
        'signature_id', NEW.id,
        'document_id', NEW.document_id,
        'signer_id', NEW.signer_id,
        'signed_at', NEW.signed_at
      ),
      v_org
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_webhook_document_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.queue_webhook_event(
      'document.status_changed',
      jsonb_build_object(
        'document_id', NEW.id,
        'reg_number', NEW.reg_number,
        'old_status', OLD.status,
        'new_status', NEW.status
      ),
      NEW.organization_id
    );
  END IF;
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 3. Per-tenant email / IIN uniqueness
-- =============================================================================

DROP INDEX IF EXISTS public.idx_profiles_iin_unique;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_org_email_uq
  ON public.profiles (organization_id, lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_org_iin_uq
  ON public.profiles (organization_id, iin)
  WHERE iin IS NOT NULL AND iin <> '';

CREATE OR REPLACE FUNCTION public.register_app_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name_ru TEXT,
  p_full_name_kk TEXT,
  p_locale TEXT DEFAULT 'ru',
  p_iin TEXT DEFAULT NULL,
  p_auth_method TEXT DEFAULT 'email',
  p_organization_id uuid DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := gen_random_uuid();
  v_auth_method TEXT;
  v_org_id UUID;
BEGIN
  IF NOT public.license_can_add_user() THEN
    RAISE EXCEPTION 'Достигнут лимит пользователей по лицензии';
  END IF;

  v_org_id := COALESCE(
    p_organization_id,
    public.effective_organization_id(),
    public.current_organization_id()
  );
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Организация не найдена';
  END IF;

  IF NOT public.organization_can_add_user(v_org_id) THEN
    RAISE EXCEPTION 'Достигнут лимит пользователей организации';
  END IF;

  v_auth_method := lower(trim(COALESCE(p_auth_method, 'email')));
  IF v_auth_method NOT IN ('email', 'eds', 'both', 'ldap') THEN
    v_auth_method := 'email';
  END IF;

  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'Email обязателен';
  END IF;

  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'Пароль должен быть не короче 8 символов';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE organization_id = v_org_id
      AND lower(email) = lower(trim(p_email))
  ) THEN
    RAISE EXCEPTION 'Пользователь с таким email уже зарегистрирован в этой организации';
  END IF;

  IF p_iin IS NOT NULL AND p_iin <> '' AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE organization_id = v_org_id
      AND iin = p_iin
  ) THEN
    RAISE EXCEPTION 'Пользователь с таким ИИН уже зарегистрирован в этой организации';
  END IF;

  INSERT INTO public.profiles (
    id, email, full_name_ru, full_name_kk, locale, iin, password_hash, auth_method, organization_id
  ) VALUES (
    v_id,
    lower(trim(p_email)),
    NULLIF(trim(p_full_name_ru), ''),
    NULLIF(trim(p_full_name_kk), ''),
    COALESCE(NULLIF(trim(p_locale), ''), 'ru'),
    NULLIF(trim(p_iin), ''),
    public.hash_password(p_password),
    v_auth_method,
    v_org_id
  );

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (v_id, 'viewer');
  END IF;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_app_user(text, text, text, text, text, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_app_user(text, text, text, text, text, text, text, uuid)
  TO service_role;

-- =============================================================================
-- 4. Document visibility — tenant boundary on metadata paths
-- =============================================================================

CREATE OR REPLACE FUNCTION private.can_view_document(_doc_id uuid, _user uuid)
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
        private.can_view_document_content(_doc_id, _user)
        OR (
          public.user_has_permission(_user, 'view_all_documents')
          AND d.organization_id IS NOT DISTINCT FROM public.user_organization_id(_user)
        )
        OR (
          public.has_role(_user, 'archivist')
          AND d.organization_id IS NOT DISTINCT FROM public.user_organization_id(_user)
        )
      )
  );
$$;

-- =============================================================================
-- 5. RLS — departments admin (fix regression from 20260612090000)
-- =============================================================================

DROP POLICY IF EXISTS "departments_admin_manage" ON public.departments;
CREATE POLICY "departments_admin_manage"
  ON public.departments FOR ALL TO authenticated
  USING (
    public.user_has_permission(auth.uid(), 'manage_platform')
    OR (
      public.user_has_permission(auth.uid(), 'manage_org')
      AND public.tenant_matches(organization_id)
    )
  )
  WITH CHECK (
    public.user_has_permission(auth.uid(), 'manage_platform')
    OR (
      public.user_has_permission(auth.uid(), 'manage_org')
      AND public.tenant_matches(organization_id)
    )
  );

-- =============================================================================
-- 6. RLS — documents write paths
-- =============================================================================

DROP POLICY IF EXISTS "doc_insert_auth" ON public.documents;
CREATE POLICY "doc_insert_auth" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.tenant_matches(organization_id)
  );

DROP POLICY IF EXISTS "doc_update_owner_or_admin" ON public.documents;
CREATE POLICY "doc_update_owner_or_admin" ON public.documents
  FOR UPDATE TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (
      created_by = auth.uid()
      OR assigned_to = auth.uid()
      OR public.is_admin(auth.uid())
      OR public.user_has_permission(auth.uid(), 'manage_documents')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  )
  WITH CHECK (
    public.tenant_matches(organization_id)
    AND (
      created_by = auth.uid()
      OR assigned_to = auth.uid()
      OR public.is_admin(auth.uid())
      OR public.user_has_permission(auth.uid(), 'manage_documents')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  );

DROP POLICY IF EXISTS "doc_delete_admin" ON public.documents;
CREATE POLICY "doc_delete_admin" ON public.documents
  FOR DELETE TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (
      public.is_admin(auth.uid())
      OR public.user_has_permission(auth.uid(), 'manage_documents')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  );

-- =============================================================================
-- 7. RLS — document projects + templates
-- =============================================================================

DROP POLICY IF EXISTS document_projects_select ON public.document_projects;
CREATE POLICY document_projects_select ON public.document_projects
  FOR SELECT TO authenticated
  USING (public.tenant_matches(organization_id));

DROP POLICY IF EXISTS document_projects_write ON public.document_projects;
CREATE POLICY document_projects_write ON public.document_projects
  FOR ALL TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (
      public.user_has_permission(auth.uid(), 'manage_projects')
      OR public.user_has_permission(auth.uid(), 'manage_documents')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  )
  WITH CHECK (
    public.tenant_matches(organization_id)
    AND (
      public.user_has_permission(auth.uid(), 'manage_projects')
      OR public.user_has_permission(auth.uid(), 'manage_documents')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  );

DROP POLICY IF EXISTS document_project_templates_select ON public.document_project_templates;
CREATE POLICY document_project_templates_select ON public.document_project_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.document_projects p
      WHERE p.id = document_project_templates.project_id
        AND public.tenant_matches(p.organization_id)
    )
  );

DROP POLICY IF EXISTS document_project_templates_write ON public.document_project_templates;
CREATE POLICY document_project_templates_write ON public.document_project_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.document_projects p
      WHERE p.id = document_project_templates.project_id
        AND public.tenant_matches(p.organization_id)
    )
    AND (
      public.user_has_permission(auth.uid(), 'manage_projects')
      OR public.user_has_permission(auth.uid(), 'manage_documents')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.document_projects p
      WHERE p.id = document_project_templates.project_id
        AND public.tenant_matches(p.organization_id)
    )
    AND (
      public.user_has_permission(auth.uid(), 'manage_projects')
      OR public.user_has_permission(auth.uid(), 'manage_documents')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  );

-- =============================================================================
-- 8. RLS — HR (leave requests + balances)
-- =============================================================================

DROP POLICY IF EXISTS "leave_read" ON public.leave_requests;
CREATE POLICY "leave_read" ON public.leave_requests
  FOR SELECT TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (
      user_id = auth.uid()
      OR approver_id = auth.uid()
      OR public.user_has_permission(auth.uid(), 'manage_hr')
      OR public.user_has_permission(auth.uid(), 'manage_users')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  );

DROP POLICY IF EXISTS "leave_insert_self" ON public.leave_requests;
CREATE POLICY "leave_insert_self" ON public.leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.tenant_matches(organization_id)
  );

DROP POLICY IF EXISTS "leave_update" ON public.leave_requests;
CREATE POLICY "leave_update" ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (
      (user_id = auth.uid() AND status = 'pending')
      OR (approver_id = auth.uid() AND status = 'pending')
      OR public.user_has_permission(auth.uid(), 'manage_hr')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  )
  WITH CHECK (
    public.tenant_matches(organization_id)
    AND (
      (
        user_id = auth.uid()
        AND status IN ('pending', 'cancelled')
      )
      OR (
        approver_id = auth.uid()
        AND status IN ('pending', 'approved', 'rejected', 'cancelled')
      )
      OR public.user_has_permission(auth.uid(), 'manage_hr')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  );

DROP POLICY IF EXISTS "leave_balances_read" ON public.leave_balances;
CREATE POLICY "leave_balances_read" ON public.leave_balances
  FOR SELECT TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (
      user_id = auth.uid()
      OR public.user_has_permission(auth.uid(), 'manage_hr')
      OR public.user_has_permission(auth.uid(), 'manage_users')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  );

DROP POLICY IF EXISTS "leave_balances_admin" ON public.leave_balances;
CREATE POLICY "leave_balances_admin" ON public.leave_balances
  FOR ALL TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (
      public.user_has_permission(auth.uid(), 'manage_hr')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  )
  WITH CHECK (
    public.tenant_matches(organization_id)
    AND (
      public.user_has_permission(auth.uid(), 'manage_hr')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  );

-- =============================================================================
-- 9. RLS — user substitutions
-- =============================================================================

DROP POLICY IF EXISTS "us_select_own" ON public.user_substitutions;
CREATE POLICY "us_select_own" ON public.user_substitutions
  FOR SELECT TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (
      principal_id = auth.uid()
      OR substitute_id = auth.uid()
      OR public.user_has_permission(auth.uid(), 'manage_users')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  );

DROP POLICY IF EXISTS "us_insert_own_or_admin" ON public.user_substitutions;
CREATE POLICY "us_insert_own_or_admin" ON public.user_substitutions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tenant_matches(organization_id)
    AND created_by = auth.uid()
    AND (
      principal_id = auth.uid()
      OR public.user_has_permission(auth.uid(), 'manage_users')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  );

DROP POLICY IF EXISTS "us_update_own_or_admin" ON public.user_substitutions;
CREATE POLICY "us_update_own_or_admin" ON public.user_substitutions
  FOR UPDATE TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (
      principal_id = auth.uid()
      OR public.user_has_permission(auth.uid(), 'manage_users')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  )
  WITH CHECK (
    public.tenant_matches(organization_id)
    AND (
      principal_id = auth.uid()
      OR public.user_has_permission(auth.uid(), 'manage_users')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  );

-- =============================================================================
-- 10. RLS — integrations (api keys, webhooks, import jobs)
-- =============================================================================

DROP POLICY IF EXISTS "api_keys_admin" ON public.api_keys;
CREATE POLICY "api_keys_admin" ON public.api_keys
  FOR ALL TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (
      created_by = auth.uid()
      OR public.user_has_permission(auth.uid(), 'manage_license')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  )
  WITH CHECK (
    public.tenant_matches(organization_id)
    AND (
      created_by = auth.uid()
      OR public.user_has_permission(auth.uid(), 'manage_license')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  );

DROP POLICY IF EXISTS "webhook_subs_admin" ON public.webhook_subscriptions;
CREATE POLICY "webhook_subs_admin" ON public.webhook_subscriptions
  FOR ALL TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (
      created_by = auth.uid()
      OR public.user_has_permission(auth.uid(), 'manage_license')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  )
  WITH CHECK (
    public.tenant_matches(organization_id)
    AND (
      created_by = auth.uid()
      OR public.user_has_permission(auth.uid(), 'manage_license')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  );

DROP POLICY IF EXISTS "webhook_outbox_admin_read" ON public.webhook_outbox;
CREATE POLICY "webhook_outbox_admin_read" ON public.webhook_outbox
  FOR SELECT TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (
      public.user_has_permission(auth.uid(), 'manage_license')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  );

DROP POLICY IF EXISTS "import_jobs_admin" ON public.import_jobs;
CREATE POLICY "import_jobs_admin" ON public.import_jobs
  FOR ALL TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (
      created_by = auth.uid()
      OR public.user_has_permission(auth.uid(), 'manage_license')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  )
  WITH CHECK (
    public.tenant_matches(organization_id)
    AND (
      created_by = auth.uid()
      OR public.user_has_permission(auth.uid(), 'manage_license')
      OR public.user_has_permission(auth.uid(), 'manage_platform')
    )
  );

-- =============================================================================
-- 11. NOT NULL enforcement on tenant-scoped tables
-- =============================================================================

DO $do$
DECLARE
  v_org uuid;
  t text;
  tenant_tables text[] := ARRAY[
    'departments',
    'documents',
    'nomenclature_items',
    'document_templates',
    'workflows',
    'kb_categories',
    'kb_articles',
    'document_projects',
    'leave_requests',
    'user_substitutions',
    'schedule_plans',
    'schedule_plan_items',
    'positions',
    'api_keys',
    'notifications',
    'duty_assignments',
    'work_time_entries',
    'workflow_runs',
    'workflow_tasks',
    'workflow_events',
    'document_versions',
    'document_signatures',
    'document_comments',
    'document_access_grants',
    'document_correspondents',
    'contract_details',
    'document_links',
    'webhook_subscriptions',
    'webhook_outbox',
    'import_jobs',
    'leave_balances'
  ];
BEGIN
  SELECT id INTO v_org FROM public.organization ORDER BY created_at LIMIT 1;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'organization row required';
  END IF;

  FOREACH t IN ARRAY tenant_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'UPDATE public.%I SET organization_id = $1 WHERE organization_id IS NULL',
      t
    ) USING v_org;

    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL',
      t
    );
  END LOOP;
END $do$;

NOTIFY pgrst, 'reload schema';
