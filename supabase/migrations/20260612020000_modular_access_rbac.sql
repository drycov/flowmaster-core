-- Phase 13: modular access — permissions, license features, admin split

-- =============================================================================
-- 1. New RBAC permissions
-- =============================================================================
INSERT INTO public.permissions(code, category, description_ru, description_kk) VALUES
  ('manage_system_settings', 'admin', 'Системные настройки (auth, LDAP, почта)', 'Жүйелік параметрлер'),
  ('manage_integrations', 'admin', 'Интеграции и API-ключи', 'Интеграциялар және API'),
  ('manage_documents', 'docs', 'Управление документами', 'Құжаттарды басқaru')
ON CONFLICT (code) DO NOTHING;

-- Grant to admin role (RBAC v2)
INSERT INTO public.role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM public.roles r
CROSS JOIN (VALUES
  ('manage_system_settings'),
  ('manage_integrations'),
  ('manage_documents')
) AS p(code)
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

-- Legacy role_definitions JSONB
UPDATE public.role_definitions
SET permissions = permissions
  || '{"manage_system_settings":true,"manage_integrations":true,"manage_documents":true}'::jsonb
WHERE role = 'admin';

-- Registrar gets document management
UPDATE public.role_definitions
SET permissions = permissions || '{"manage_documents":true}'::jsonb
WHERE role = 'registrar';

INSERT INTO public.role_permissions (role_id, permission_code)
SELECT r.id, 'manage_documents'
FROM public.roles r
WHERE r.code IN ('admin', 'registrar')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 2. Merge extended license features into existing installations
-- =============================================================================
UPDATE public.installation_license
SET features = features || '{
  "knowledge_base": true,
  "projects": true,
  "contracts": true,
  "counterparties": true,
  "hr": true,
  "substitutions": true,
  "correspondence": true,
  "integrations": true
}'::jsonb
WHERE id = (SELECT id FROM public.installation_license ORDER BY created_at LIMIT 1);

NOTIFY pgrst, 'reload schema';
