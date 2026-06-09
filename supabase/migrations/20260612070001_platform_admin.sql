-- Platform operator role: permissions, role definition, grants to primary org admins

INSERT INTO public.permissions (code, category, description_ru, description_kk) VALUES
  (
    'manage_platform',
    'admin',
    'Управление организациями платформы (multi-tenant)',
    'Платформа ұйымдарын басқaru (multi-tenant)'
  )
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_definitions (role, title_ru, title_kk, description_ru, description_kk, permissions)
VALUES (
  'platform_admin',
  'Администратор платформы',
  'Платформа әкімшісі',
  'Создание и управление организациями (multi-tenant)',
  'Ұйымдарды құру және басқaru (multi-tenant)',
  '{"manage_platform":true,"manage_license":true,"view_audit":true}'::jsonb
)
ON CONFLICT (role) DO UPDATE SET
  title_ru = EXCLUDED.title_ru,
  title_kk = EXCLUDED.title_kk,
  description_ru = EXCLUDED.description_ru,
  description_kk = EXCLUDED.description_kk,
  permissions = EXCLUDED.permissions,
  updated_at = now();

INSERT INTO public.roles (code, name_ru, name_kk, description, kind, is_active, is_system)
VALUES (
  'platform_admin',
  'Администратор платформы',
  'Платформа әкімшісі',
  'Создание и управление организациями (multi-tenant)',
  'system',
  true,
  true
)
ON CONFLICT (code) DO UPDATE SET
  name_ru = EXCLUDED.name_ru,
  name_kk = EXCLUDED.name_kk,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = now();

INSERT INTO public.role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM public.roles r
CROSS JOIN (VALUES ('manage_platform'), ('manage_license'), ('view_audit')) AS p(code)
WHERE r.code = 'platform_admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT ur.user_id, 'platform_admin'::public.app_role
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.role = 'admin'
  AND p.organization_id = (
    SELECT o.id FROM public.organization o ORDER BY o.created_at ASC LIMIT 1
  )
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
