
-- ============================================================
-- PHASE 1: Extend enums
-- ============================================================
ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'submitted';
ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'returned_for_revision';

-- ============================================================
-- PHASE 2: Permissions catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS public.permissions (
  code text PRIMARY KEY,
  category text NOT NULL DEFAULT 'general',
  description_ru text NOT NULL DEFAULT '',
  description_kk text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissions_read_all" ON public.permissions FOR SELECT TO authenticated USING (true);

-- ============================================================
-- PHASE 3: Roles (new model alongside legacy app_role enum)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_kk text NOT NULL,
  description text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'system' CHECK (kind IN ('system','org','department','temporary')),
  scope_department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  parent_role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_read_all" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_admin_manage" ON public.roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_roles_uat BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES public.permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_code)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_permissions_read_all" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions_admin_manage" ON public.role_permissions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- PHASE 4: User role grants (with scope, expiry, history)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_role_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  scope_department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id),
  reason text DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_urg_user_active ON public.user_role_grants(user_id)
  WHERE revoked_at IS NULL;
GRANT SELECT ON public.user_role_grants TO authenticated;
GRANT ALL ON public.user_role_grants TO service_role;
ALTER TABLE public.user_role_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "urg_read_self_or_admin" ON public.user_role_grants FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "urg_admin_manage" ON public.user_role_grants FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- PHASE 5: HR — profile_assignments (immutable history)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profile_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  manager_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  is_primary boolean NOT NULL DEFAULT true,
  is_temporary boolean NOT NULL DEFAULT false,
  reason text NOT NULL DEFAULT 'hire'
    CHECK (reason IN ('hire','transfer','promotion','temporary','termination','reinstatement','correction')),
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pa_user ON public.profile_assignments(user_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_pa_user_current ON public.profile_assignments(user_id)
  WHERE end_date IS NULL AND is_primary;
GRANT SELECT, INSERT ON public.profile_assignments TO authenticated;
GRANT ALL ON public.profile_assignments TO service_role;
ALTER TABLE public.profile_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa_read_self_or_admin" ON public.profile_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "pa_admin_insert" ON public.profile_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
-- no update / delete policy → immutable for everyone except service_role

-- Trigger: closing previous primary + updating profiles cache
CREATE OR REPLACE FUNCTION public.profile_assignments_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_primary AND NEW.end_date IS NULL THEN
    -- close previous primary
    UPDATE public.profile_assignments
       SET end_date = GREATEST(NEW.start_date - INTERVAL '1 day', start_date)::date
     WHERE user_id = NEW.user_id
       AND id <> NEW.id
       AND is_primary
       AND end_date IS NULL;
    -- refresh profile cache
    UPDATE public.profiles
       SET department_id = NEW.department_id,
           position_id = NEW.position_id
     WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_pa_after_insert ON public.profile_assignments;
CREATE TRIGGER trg_pa_after_insert AFTER INSERT ON public.profile_assignments
  FOR EACH ROW EXECUTE FUNCTION public.profile_assignments_after_insert();

-- ============================================================
-- PHASE 6: Extend departments / templates / documents / audit
-- ============================================================
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deputy_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS default_workflow_id uuid REFERENCES public.workflows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS allow_custom_route boolean NOT NULL DEFAULT true;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS workflow_id uuid REFERENCES public.workflows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custom_route jsonb;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS correlation_id uuid;
CREATE INDEX IF NOT EXISTS idx_audit_correlation ON public.audit_logs(correlation_id)
  WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_logs(actor_id, created_at DESC);

-- ============================================================
-- PHASE 7: Helper functions
-- ============================================================

-- has-permission across legacy role_definitions + new roles
CREATE OR REPLACE FUNCTION public.user_has_permission(_user uuid, _permission text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE has_it boolean;
BEGIN
  IF public.is_admin(_user) THEN RETURN true; END IF;

  -- 1) legacy: user_roles.role -> role_definitions.permissions JSONB
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_definitions rd ON rd.role = ur.role
    WHERE ur.user_id = _user
      AND COALESCE((rd.permissions ->> _permission)::boolean, false) = true
  ) INTO has_it;
  IF has_it THEN RETURN true; END IF;

  -- 2) new model: user_role_grants -> role_permissions (with parent_role chain)
  SELECT EXISTS (
    WITH RECURSIVE granted AS (
      SELECT r.id FROM public.user_role_grants g
      JOIN public.roles r ON r.id = g.role_id AND r.is_active
      WHERE g.user_id = _user
        AND g.revoked_at IS NULL
        AND (g.expires_at IS NULL OR g.expires_at > now())
      UNION
      SELECT r2.id FROM public.roles r2
      JOIN granted g2 ON r2.id = (SELECT parent_role_id FROM public.roles WHERE id = g2.id)
      WHERE r2.is_active
    )
    SELECT 1 FROM granted g
    JOIN public.role_permissions rp ON rp.role_id = g.id
    WHERE rp.permission_code = _permission
  ) INTO has_it;
  RETURN has_it;
END $$;

-- current primary assignment
CREATE OR REPLACE FUNCTION public.current_assignment(_user uuid)
RETURNS public.profile_assignments LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.profile_assignments
   WHERE user_id = _user AND is_primary AND end_date IS NULL
   ORDER BY start_date DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.user_manager(_user uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT manager_user_id FROM public.current_assignment(_user)),
    (SELECT d.head_user_id FROM public.profile_assignments pa
       JOIN public.departments d ON d.id = pa.department_id
      WHERE pa.user_id = _user AND pa.is_primary AND pa.end_date IS NULL
      LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION public.department_head(_department uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT head_user_id FROM public.departments WHERE id = _department
$$;

CREATE OR REPLACE FUNCTION public.department_parent_head(_department uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d2.head_user_id
    FROM public.departments d1
    JOIN public.departments d2 ON d2.id = d1.parent_id
   WHERE d1.id = _department
$$;

-- resolve assignees for a workflow node (returns array of user uuids)
CREATE OR REPLACE FUNCTION public.resolve_workflow_assignees(_node jsonb, _document uuid)
RETURNS uuid[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  mode text := COALESCE(_node->'data'->>'assignee_mode', _node->>'assignee_mode', 'user');
  ref text := COALESCE(_node->'data'->>'assignee_ref', _node->>'assignee_ref',
                       _node->'data'->>'assignee_user_id');
  initiator uuid;
  dept uuid;
  result uuid[] := '{}'::uuid[];
BEGIN
  SELECT created_by, department_id INTO initiator, dept FROM public.documents WHERE id = _document;

  IF mode = 'user' AND ref IS NOT NULL THEN
    result := ARRAY[ref::uuid];
  ELSIF mode = 'position' AND ref IS NOT NULL THEN
    SELECT array_agg(pa.user_id) INTO result
      FROM public.profile_assignments pa
     WHERE pa.position_id = ref::uuid AND pa.is_primary AND pa.end_date IS NULL;
  ELSIF mode = 'department' AND ref IS NOT NULL THEN
    SELECT array_agg(pa.user_id) INTO result
      FROM public.profile_assignments pa
     WHERE pa.department_id = ref::uuid AND pa.is_primary AND pa.end_date IS NULL;
  ELSIF mode = 'department_head' THEN
    result := ARRAY[public.department_head(COALESCE(ref::uuid, dept))];
  ELSIF mode = 'parent_department_head' THEN
    result := ARRAY[public.department_parent_head(COALESCE(ref::uuid, dept))];
  ELSIF mode = 'initiator_manager' THEN
    result := ARRAY[public.user_manager(initiator)];
  ELSIF mode = 'role' AND ref IS NOT NULL THEN
    SELECT array_agg(DISTINCT g.user_id) INTO result
      FROM public.user_role_grants g
      JOIN public.roles r ON r.id = g.role_id
     WHERE r.code = ref AND g.revoked_at IS NULL
       AND (g.expires_at IS NULL OR g.expires_at > now());
  END IF;

  RETURN COALESCE(array_remove(result, NULL), '{}'::uuid[]);
END $$;

-- ============================================================
-- PHASE 8: Universal audit trigger (covers many tables)
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ent_id text;
BEGIN
  ent_id := COALESCE(
    (CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END) ->> 'id',
    ''
  );
  INSERT INTO public.audit_logs(actor_id, entity_type, entity_id, action, before, after)
  VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    ent_id,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END $$;

DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organization','departments','positions','role_definitions',
    'roles','role_permissions','user_role_grants','user_roles',
    'profile_assignments','workflows','document_templates'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$s', t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s
         FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()', t
    );
  END LOOP;
END $do$;

-- ============================================================
-- PHASE 9: Seed permissions + bind to legacy role_definitions
-- ============================================================
INSERT INTO public.permissions(code, category, description_ru, description_kk) VALUES
  ('manage_users',         'admin', 'Управление пользователями',     'Қолданушыларды басқару'),
  ('manage_org',           'admin', 'Управление оргструктурой',      'Ұйым құрылымын басқару'),
  ('manage_workflows',     'admin', 'Управление маршрутами',         'Маршруттарды басқару'),
  ('manage_templates',     'admin', 'Управление шаблонами',          'Үлгілерді басқару'),
  ('manage_nomenclature',  'admin', 'Управление номенклатурой',      'Номенклатураны басқару'),
  ('manage_roles',         'admin', 'Управление ролями и правами',   'Рөлдерді басқару'),
  ('view_audit',           'audit', 'Просмотр журнала аудита',       'Аудитті көру'),
  ('register_documents',   'docs',  'Регистрация документов',        'Құжаттарды тіркеу'),
  ('approve_documents',    'docs',  'Согласование документов',       'Құжаттарды келісу'),
  ('sign_documents',       'docs',  'Подписание документов',         'Құжаттарға қол қою'),
  ('archive_documents',    'docs',  'Помещение в архив',             'Мұрағатқа жіберу'),
  ('create_documents',     'docs',  'Создание документов',           'Құжат жасау'),
  ('view_all_documents',   'docs',  'Просмотр всех документов',      'Барлық құжаттарды көру')
ON CONFLICT (code) DO NOTHING;

-- Ensure role_definitions rows have these new permissions in JSONB
UPDATE public.role_definitions SET permissions = COALESCE(permissions,'{}'::jsonb)
  || jsonb_build_object(
       'create_documents', true,
       'approve_documents', CASE WHEN role IN ('admin','approver') THEN true ELSE false END,
       'sign_documents',    CASE WHEN role IN ('admin','signer') THEN true ELSE false END,
       'register_documents',CASE WHEN role IN ('admin','registrar') THEN true ELSE false END,
       'archive_documents', CASE WHEN role IN ('admin','archivist') THEN true ELSE false END,
       'view_all_documents',CASE WHEN role IN ('admin','archivist','registrar') THEN true ELSE false END,
       'view_audit',        CASE WHEN role = 'admin' THEN true ELSE false END,
       'manage_users',      CASE WHEN role = 'admin' THEN true ELSE false END,
       'manage_org',        CASE WHEN role = 'admin' THEN true ELSE false END,
       'manage_workflows',  CASE WHEN role IN ('admin','registrar') THEN true ELSE false END,
       'manage_templates',  CASE WHEN role IN ('admin','registrar') THEN true ELSE false END,
       'manage_nomenclature', CASE WHEN role IN ('admin','registrar') THEN true ELSE false END,
       'manage_roles',      CASE WHEN role = 'admin' THEN true ELSE false END
     );
