-- Phase 14: multi-tenant isolation — organization_id on domain tables + RLS helpers

-- =============================================================================
-- 1. Tenant resolution helpers
-- =============================================================================

CREATE OR REPLACE FUNCTION public.jwt_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(trim(current_setting('request.jwt.claim.org_id', true)), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.auth_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id FROM public.organization o ORDER BY o.created_at LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.effective_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.jwt_organization_id(),
    public.auth_user_organization_id(),
    public.current_organization_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.tenant_matches(_row_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _row_org IS NOT DISTINCT FROM public.effective_organization_id()
    OR public.is_admin(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.user_organization_id(_user uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.organization_id FROM public.profiles p WHERE p.id = _user;
$$;

GRANT EXECUTE ON FUNCTION public.jwt_organization_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_user_organization_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.effective_organization_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_matches(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_organization_id(uuid) TO authenticated, service_role;

-- =============================================================================
-- 2. organization_id on tenant-scoped tables (backfill from default org)
-- =============================================================================

DO $$
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
    'ref_correspondents',
    'leave_requests',
    'user_substitutions',
    'schedule_plans',
    'audit_logs',
    'api_keys'
  ];
BEGIN
  SELECT id INTO v_org FROM public.organization ORDER BY created_at LIMIT 1;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'organization row required before tenant isolation migration';
  END IF;

  FOREACH t IN ARRAY tenant_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organization(id) ON DELETE RESTRICT',
      t
    );
    EXECUTE format(
      'UPDATE public.%I SET organization_id = $1 WHERE organization_id IS NULL',
      t
    ) USING v_org;
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (organization_id)',
      'idx_' || t || '_organization_id',
      t
    );
  END LOOP;

  UPDATE public.profiles SET organization_id = v_org WHERE organization_id IS NULL;
END $$;

-- profiles.organization_id required for membership checks
ALTER TABLE public.profiles
  ALTER COLUMN organization_id SET NOT NULL;

-- =============================================================================
-- 3. Auto-stamp organization_id on INSERT (server/API may omit column)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_row_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.effective_organization_id();
  END IF;
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.current_organization_id();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
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
    'ref_correspondents',
    'leave_requests',
    'user_substitutions',
    'schedule_plans',
    'audit_logs',
    'api_keys'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_set_org ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_set_org BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_row_organization_id()',
      t,
      t
    );
  END LOOP;
END $$;

-- =============================================================================
-- 4. Document access — tenant boundary inside clearance checks
-- =============================================================================

CREATE OR REPLACE FUNCTION public.can_view_document_content(_doc_id uuid, _user uuid)
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
        OR public.is_admin(_user)
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
-- 5. RLS — tenant predicate on catalog / workflow tables
-- =============================================================================

DROP POLICY IF EXISTS "departments_select_all_auth" ON public.departments;
CREATE POLICY "departments_select_all_auth" ON public.departments
  FOR SELECT TO authenticated
  USING (public.tenant_matches(organization_id));

DROP POLICY IF EXISTS "departments_admin_manage" ON public.departments;
CREATE POLICY "departments_admin_manage" ON public.departments
  FOR ALL TO authenticated
  USING (public.tenant_matches(organization_id) AND public.is_admin(auth.uid()))
  WITH CHECK (public.tenant_matches(organization_id) AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "nom_select_all" ON public.nomenclature_items;
CREATE POLICY "nom_select_all" ON public.nomenclature_items
  FOR SELECT TO authenticated
  USING (public.tenant_matches(organization_id));

DROP POLICY IF EXISTS "nom_manage_admin_or_registrar" ON public.nomenclature_items;
CREATE POLICY "nom_manage_admin_or_registrar" ON public.nomenclature_items
  FOR ALL TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'registrar'))
  )
  WITH CHECK (
    public.tenant_matches(organization_id)
    AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'registrar'))
  );

DROP POLICY IF EXISTS "tpl_select_all" ON public.document_templates;
CREATE POLICY "tpl_select_all" ON public.document_templates
  FOR SELECT TO authenticated
  USING (public.tenant_matches(organization_id));

DROP POLICY IF EXISTS "tpl_manage_priv" ON public.document_templates;
CREATE POLICY "tpl_manage_priv" ON public.document_templates
  FOR ALL TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND public.user_has_permission(auth.uid(), 'manage_templates')
  )
  WITH CHECK (
    public.tenant_matches(organization_id)
    AND public.user_has_permission(auth.uid(), 'manage_templates')
  );

DROP POLICY IF EXISTS "wf_select_all" ON public.workflows;
CREATE POLICY "wf_select_all" ON public.workflows
  FOR SELECT TO authenticated
  USING (public.tenant_matches(organization_id));

DROP POLICY IF EXISTS "wf_manage_priv" ON public.workflows;
CREATE POLICY "wf_manage_priv" ON public.workflows
  FOR ALL TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND public.user_has_permission(auth.uid(), 'manage_workflows')
  )
  WITH CHECK (
    public.tenant_matches(organization_id)
    AND public.user_has_permission(auth.uid(), 'manage_workflows')
  );

-- KB (if present)
DO $$
BEGIN
  IF to_regclass('public.kb_categories') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "kb_categories_select" ON public.kb_categories';
    EXECUTE 'DROP POLICY IF EXISTS "kb_categories_read" ON public.kb_categories';
    EXECUTE $p$
      CREATE POLICY "kb_categories_select" ON public.kb_categories
        FOR SELECT TO authenticated
        USING (public.tenant_matches(organization_id))
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS "kb_categories_write" ON public.kb_categories';
    EXECUTE 'DROP POLICY IF EXISTS "kb_categories_manage" ON public.kb_categories';
    EXECUTE $p$
      CREATE POLICY "kb_categories_write" ON public.kb_categories
        FOR ALL TO authenticated
        USING (
          public.tenant_matches(organization_id)
          AND public.user_has_permission(auth.uid(), 'manage_knowledge_base')
        )
        WITH CHECK (
          public.tenant_matches(organization_id)
          AND public.user_has_permission(auth.uid(), 'manage_knowledge_base')
        )
    $p$;
  END IF;

  IF to_regclass('public.kb_articles') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "kb_articles_select" ON public.kb_articles';
    EXECUTE 'DROP POLICY IF EXISTS "kb_articles_read" ON public.kb_articles';
    EXECUTE $p$
      CREATE POLICY "kb_articles_select" ON public.kb_articles
        FOR SELECT TO authenticated
        USING (
          public.tenant_matches(organization_id)
          AND (
            status = 'published'
            OR author_id = auth.uid()
            OR public.user_has_permission(auth.uid(), 'manage_knowledge_base')
            OR public.user_has_permission(auth.uid(), 'view_all_documents')
          )
        )
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS "kb_articles_write" ON public.kb_articles';
    EXECUTE 'DROP POLICY IF EXISTS "kb_articles_manage" ON public.kb_articles';
    EXECUTE $p$
      CREATE POLICY "kb_articles_write" ON public.kb_articles
        FOR ALL TO authenticated
        USING (
          public.tenant_matches(organization_id)
          AND (
            author_id = auth.uid()
            OR public.user_has_permission(auth.uid(), 'manage_knowledge_base')
          )
        )
        WITH CHECK (
          public.tenant_matches(organization_id)
          AND (
            author_id = auth.uid()
            OR public.user_has_permission(auth.uid(), 'manage_knowledge_base')
          )
        )
    $p$;
  END IF;
END $$;

-- =============================================================================
-- 6. User registration — bind to default / effective organization
-- =============================================================================

CREATE OR REPLACE FUNCTION public.register_app_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name_ru TEXT,
  p_full_name_kk TEXT,
  p_locale TEXT DEFAULT 'ru',
  p_iin TEXT DEFAULT NULL,
  p_auth_method TEXT DEFAULT 'email'
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

  v_org_id := public.effective_organization_id();
  IF v_org_id IS NULL THEN
    v_org_id := public.current_organization_id();
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

  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(email) = lower(trim(p_email))) THEN
    RAISE EXCEPTION 'Пользователь с таким email уже зарегистрирован';
  END IF;

  IF p_iin IS NOT NULL AND p_iin <> '' AND EXISTS (
    SELECT 1 FROM public.profiles WHERE iin = p_iin
  ) THEN
    RAISE EXCEPTION 'Пользователь с таким ИИН уже зарегистрирован';
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

NOTIFY pgrst, 'reload schema';
