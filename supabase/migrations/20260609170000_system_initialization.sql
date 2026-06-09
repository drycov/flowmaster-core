-- Primary system initialization (idempotent — safe on fresh DB and repaired remotes)

-- =============================================================================
-- 1. Permissions catalog (must match src/lib/auth/permissions.ts)
-- =============================================================================
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

-- =============================================================================
-- 2. Legacy role_definitions (UI + user_has_permission fallback)
-- =============================================================================
INSERT INTO public.role_definitions (role, title_ru, title_kk, description_ru, description_kk, permissions) VALUES
  ('admin','Администратор','Әкімші','Полный доступ ко всем функциям и настройкам','Барлық функциялар мен баптауларға толық қол жеткізу',
   '{"manage_users":true,"manage_org":true,"manage_workflows":true,"manage_templates":true,"manage_nomenclature":true,"manage_roles":true,"view_audit":true,"sign_documents":true,"register_documents":true,"approve_documents":true,"archive_documents":true,"create_documents":true,"view_all_documents":true}'::jsonb),
  ('registrar','Регистратор','Тіркеуші','Регистрация входящих и исходящих документов','Кіріс және шығыс құжаттарды тіркеу',
   '{"register_documents":true,"manage_templates":true,"manage_nomenclature":true,"manage_workflows":true,"create_documents":true,"view_all_documents":true}'::jsonb),
  ('approver','Согласующий','Келісуші','Согласование документов в маршрутах','Бағыттарда құжаттарды келісу',
   '{"approve_documents":true,"create_documents":true}'::jsonb),
  ('signer','Подписант','Қол қоюшы','Подписание документов ЭЦП','Құжаттарға ЭЦҚ қою',
   '{"sign_documents":true,"approve_documents":true,"create_documents":true}'::jsonb),
  ('archivist','Архивариус','Мұрағатшы','Управление архивом и номенклатурой','Мұрағат пен номенклатураны басқару',
   '{"archive_documents":true,"manage_nomenclature":true,"view_all_documents":true,"create_documents":true}'::jsonb),
  ('viewer','Наблюдатель','Байқаушы','Просмотр документов','Құжаттарды қарау',
   '{"create_documents":true}'::jsonb)
ON CONFLICT (role) DO UPDATE SET
  title_ru = EXCLUDED.title_ru,
  title_kk = EXCLUDED.title_kk,
  description_ru = EXCLUDED.description_ru,
  description_kk = EXCLUDED.description_kk,
  permissions = EXCLUDED.permissions,
  updated_at = now();

-- =============================================================================
-- 3. RBAC v2 roles + role_permissions (sync from role_definitions)
-- =============================================================================
INSERT INTO public.roles (code, name_ru, name_kk, description, kind, is_active, is_system)
SELECT rd.role::text,
       COALESCE(NULLIF(rd.title_ru,''), rd.role::text),
       COALESCE(NULLIF(rd.title_kk,''), rd.role::text),
       COALESCE(rd.description_ru,''),
       'system',
       true,
       true
FROM public.role_definitions rd
ON CONFLICT (code) DO UPDATE SET
  name_ru = EXCLUDED.name_ru,
  name_kk = EXCLUDED.name_kk,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = now();

INSERT INTO public.role_permissions (role_id, permission_code)
SELECT r.id, perm.key
FROM public.role_definitions rd
JOIN public.roles r ON r.code = rd.role::text
JOIN LATERAL jsonb_each_text(rd.permissions) AS perm(key, value) ON perm.value = 'true'
JOIN public.permissions p ON p.code = perm.key
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 4. Organization singleton + root department
-- =============================================================================
INSERT INTO public.organization (name_ru, name_kk, short_name_ru, short_name_kk, reg_number_prefix)
SELECT 'Моя организация', 'Менің ұйымым', 'Организация', 'Ұйым', 'DOC'
WHERE NOT EXISTS (SELECT 1 FROM public.organization);

INSERT INTO public.departments (code, name_ru, name_kk, kind, parent_id)
SELECT 'ORG', o.name_ru, o.name_kk, 'company', NULL
FROM public.organization o
WHERE NOT EXISTS (SELECT 1 FROM public.departments)
LIMIT 1;

-- =============================================================================
-- 5. Audit triggers on reference tables
-- =============================================================================
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organization','departments','positions','role_definitions',
    'roles','role_permissions','user_role_grants','user_roles',
    'profile_assignments','profiles','workflows','document_templates','documents'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$s', t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s
         FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()', t
    );
  END LOOP;
END $do$;

-- =============================================================================
-- 6. Helper: grant legacy + RBAC v2 role together
-- =============================================================================
CREATE OR REPLACE FUNCTION public.grant_app_role(_user uuid, _role public.app_role, _reason text DEFAULT 'system')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_role_grants (user_id, role_id, reason)
  SELECT _user, r.id, _reason
  FROM public.roles r
  WHERE r.code = _role::text
    AND NOT EXISTS (
      SELECT 1 FROM public.user_role_grants g
       WHERE g.user_id = _user AND g.role_id = r.id AND g.revoked_at IS NULL
    );
END $$;

REVOKE EXECUTE ON FUNCTION public.grant_app_role(uuid, public.app_role, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_app_role(uuid, public.app_role, text) TO service_role;

-- =============================================================================
-- 7. Signup: first user = admin, others = viewer (legacy + RBAC v2)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name_ru, full_name_kk, locale)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name_ru', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name_kk', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'locale', 'ru')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name_ru = COALESCE(public.profiles.full_name_ru, EXCLUDED.full_name_ru),
    full_name_kk = COALESCE(public.profiles.full_name_kk, EXCLUDED.full_name_kk);

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    PERFORM public.grant_app_role(NEW.id, 'admin', 'first_user_bootstrap');
  ELSE
    PERFORM public.grant_app_role(NEW.id, 'viewer', 'default_signup');
  END IF;

  RETURN NEW;
END $$;

-- =============================================================================
-- 8. Existing DB: promote oldest user if no admin; sync legacy grants → v2
-- =============================================================================
DO $bootstrap$
DECLARE
  v_first uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    SELECT u.id INTO v_first
      FROM auth.users u
      ORDER BY u.created_at ASC
      LIMIT 1;
    IF v_first IS NOT NULL THEN
      PERFORM public.grant_app_role(v_first, 'admin', 'bootstrap_existing_first_user');
    END IF;
  END IF;

  -- Sync all legacy user_roles into user_role_grants (additive)
  PERFORM public.grant_app_role(ur.user_id, ur.role, 'legacy_sync')
  FROM public.user_roles ur
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_role_grants g
    JOIN public.roles r ON r.id = g.role_id AND r.code = ur.role::text
    WHERE g.user_id = ur.user_id AND g.revoked_at IS NULL
  );
END $bootstrap$;

-- =============================================================================
-- 9. System status RPC (for setup wizard in UI)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_system_init_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org jsonb;
  v_admin_count int;
  v_dept_count int;
  v_perm_count int;
  v_role_count int;
  v_wf_published int;
  v_tpl_published int;
BEGIN
  SELECT to_jsonb(o) INTO v_org FROM public.organization o LIMIT 1;
  SELECT count(*) INTO v_admin_count FROM public.user_roles WHERE role = 'admin';
  SELECT count(*) INTO v_dept_count FROM public.departments;
  SELECT count(*) INTO v_perm_count FROM public.permissions;
  SELECT count(*) INTO v_role_count FROM public.roles WHERE is_active;
  SELECT count(*) INTO v_wf_published FROM public.workflows WHERE status = 'published';
  SELECT count(*) INTO v_tpl_published FROM public.document_templates WHERE status = 'published';

  RETURN jsonb_build_object(
    'has_organization', v_org IS NOT NULL,
    'organization_configured', COALESCE(v_org->>'name_ru','') NOT IN ('', 'Моя организация'),
    'has_admin', v_admin_count > 0,
    'admin_count', v_admin_count,
    'departments_count', v_dept_count,
    'permissions_count', v_perm_count,
    'roles_count', v_role_count,
    'published_workflows', v_wf_published,
    'published_templates', v_tpl_published,
    'needs_setup', (
      v_admin_count = 0
      OR v_dept_count = 0
      OR COALESCE(v_org->>'name_ru','') IN ('', 'Моя организация')
    )
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_system_init_status() TO authenticated;
