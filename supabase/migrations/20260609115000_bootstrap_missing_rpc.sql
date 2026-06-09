-- Idempotent bootstrap for objects from 07050451+ that may be missing on remote
-- (schema created outside supabase migration tracking)

-- Permissions + roles (RBAC v2)
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
DROP POLICY IF EXISTS "permissions_read_all" ON public.permissions;
CREATE POLICY "permissions_read_all" ON public.permissions FOR SELECT TO authenticated USING (true);

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
DROP POLICY IF EXISTS "roles_read_all" ON public.roles;
CREATE POLICY "roles_read_all" ON public.roles FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES public.permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_code)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "role_permissions_read_all" ON public.role_permissions;
CREATE POLICY "role_permissions_read_all" ON public.role_permissions FOR SELECT TO authenticated USING (true);

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
CREATE INDEX IF NOT EXISTS idx_urg_user_active ON public.user_role_grants(user_id) WHERE revoked_at IS NULL;
GRANT SELECT ON public.user_role_grants TO authenticated;
GRANT ALL ON public.user_role_grants TO service_role;
ALTER TABLE public.user_role_grants ENABLE ROW LEVEL SECURITY;

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
  reason text NOT NULL DEFAULT 'hire',
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.profile_assignments TO authenticated;
GRANT ALL ON public.profile_assignments TO service_role;
ALTER TABLE public.profile_assignments ENABLE ROW LEVEL SECURITY;

-- Document / template workflow columns
ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS default_workflow_id uuid REFERENCES public.workflows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS allow_custom_route boolean NOT NULL DEFAULT true;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS workflow_id uuid REFERENCES public.workflows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custom_route jsonb;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS correlation_id uuid;

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS head_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Helper functions
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

CREATE OR REPLACE FUNCTION public.user_has_permission(_user uuid, _permission text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE has_it boolean;
BEGIN
  IF public.is_admin(_user) THEN RETURN true; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_definitions rd ON rd.role = ur.role
    WHERE ur.user_id = _user
      AND COALESCE((rd.permissions ->> _permission)::boolean, false) = true
  ) INTO has_it;
  IF has_it THEN RETURN true; END IF;

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

CREATE OR REPLACE FUNCTION public.resolve_workflow_assignees(_node jsonb, _document uuid)
RETURNS uuid[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  mode text := COALESCE(_node->'data'->>'assignee_mode', _node->>'assignee_mode', 'user');
  ref text := COALESCE(_node->'data'->>'assignee_ref', _node->>'assignee_ref',
                       _node->'data'->>'assignee_user_id', _node->>'assignee_id');
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

-- Seed permissions (no-op if already present)
INSERT INTO public.permissions(code, category, description_ru, description_kk) VALUES
  ('manage_users',         'admin', 'Управление пользователями',     'Қолданушыларды басқару'),
  ('manage_org',           'admin', 'Управление оргструктурой',      'Ұйым құрылымын басқару'),
  ('manage_workflows',     'admin', 'Управление маршрутами',         'Маршруттарды басқару'),
  ('manage_templates',     'admin', 'Управление шаблонами',          'Үлгілерді басқару'),
  ('manage_nomenclature',  'admin', 'Управление номенклатурой',      'Номенклатураны басқару'),
  ('manage_roles',         'admin', 'Управление ролями и правами',   'Рөлдерді басқару'),
  ('view_audit',           'audit', 'Просмотр журнала аудита',       'Аудитті көру'),
  ('manage_documents',     'docs',  'Управление документами',        'Құжаттарды басқару'),
  ('approve_documents',    'docs',  'Согласование документов',       'Құжаттарды келісу'),
  ('sign_documents',       'docs',  'Подписание документов',         'Құжаттарға қол қою')
ON CONFLICT (code) DO NOTHING;

GRANT EXECUTE ON FUNCTION public.user_has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_workflow_assignees(jsonb, uuid) TO authenticated;
