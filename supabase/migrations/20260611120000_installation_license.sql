-- Installation licensing (singleton per deployment)

-- =============================================================================
-- 1. Permission
-- =============================================================================
INSERT INTO public.permissions(code, category, description_ru, description_kk) VALUES
  ('manage_license', 'admin', 'Управление лицензией', 'Лицензияны басқару')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_code)
SELECT r.id, 'manage_license'
FROM public.roles r
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

UPDATE public.role_definitions
SET permissions = permissions || '{"manage_license":true}'::jsonb
WHERE role = 'admin';

-- =============================================================================
-- 2. License table (singleton)
-- =============================================================================
CREATE TABLE public.installation_license (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan text NOT NULL DEFAULT 'trial'
    CHECK (plan IN ('trial', 'standard', 'professional', 'enterprise')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'grace', 'expired', 'suspended')),
  license_key_hash text,
  installation_id text,
  max_users int NOT NULL DEFAULT 10 CHECK (max_users > 0),
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  customer_name text NOT NULL DEFAULT '',
  issued_at timestamptz,
  expires_at timestamptz,
  grace_days int NOT NULL DEFAULT 14 CHECK (grace_days >= 0),
  activated_at timestamptz,
  activated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.installation_license TO authenticated;
GRANT ALL ON public.installation_license TO service_role;

ALTER TABLE public.installation_license ENABLE ROW LEVEL SECURITY;

CREATE POLICY "license read all auth"
  ON public.installation_license FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "license admin write"
  ON public.installation_license FOR ALL TO authenticated
  USING (public.user_has_permission(auth.uid(), 'manage_license'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_license'));

CREATE TRIGGER installation_license_updated
  BEFORE UPDATE ON public.installation_license
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Default trial license (30 days, all features)
INSERT INTO public.installation_license (
  plan, status, max_users, features, customer_name, issued_at, expires_at, grace_days, activated_at
)
SELECT
  'trial',
  'active',
  10,
  '{
    "workflows": true,
    "templates": true,
    "eds_signing": true,
    "archive": true,
    "references": true,
    "nomenclature": true,
    "audit": true
  }'::jsonb,
  '',
  now(),
  now() + interval '30 days',
  14,
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.installation_license);

-- =============================================================================
-- 3. Helpers
-- =============================================================================
CREATE OR REPLACE FUNCTION public.license_row()
RETURNS public.installation_license
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.* FROM public.installation_license l ORDER BY l.created_at LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.license_effective_status(
  p_expires_at timestamptz,
  p_grace_days int,
  p_status text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_status = 'suspended' THEN
    RETURN 'suspended';
  END IF;
  IF p_expires_at IS NULL THEN
    RETURN 'active';
  END IF;
  IF now() <= p_expires_at THEN
    RETURN 'active';
  END IF;
  IF now() <= p_expires_at + make_interval(days => COALESCE(p_grace_days, 0)) THEN
    RETURN 'grace';
  END IF;
  RETURN 'expired';
END;
$$;

CREATE OR REPLACE FUNCTION public.license_active_user_count()
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM public.profiles;
$$;

CREATE OR REPLACE FUNCTION public.license_can_add_user()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_license public.installation_license;
  v_status text;
  v_count int;
BEGIN
  v_license := public.license_row();
  IF v_license IS NULL THEN
    RETURN true;
  END IF;

  v_status := public.license_effective_status(
    v_license.expires_at, v_license.grace_days, v_license.status
  );
  IF v_status IN ('expired', 'suspended') THEN
    RETURN false;
  END IF;

  v_count := public.license_active_user_count();
  RETURN v_count < v_license.max_users;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_license_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_license public.installation_license;
  v_effective text;
  v_users int;
  v_days int;
  v_writable boolean;
BEGIN
  v_license := public.license_row();
  IF v_license IS NULL THEN
    RETURN jsonb_build_object(
      'has_license', false,
      'plan', 'trial',
      'status', 'active',
      'max_users', 10,
      'active_users', public.license_active_user_count(),
      'features', '{}'::jsonb,
      'is_writable', true,
      'days_remaining', null,
      'expires_at', null,
      'customer_name', '',
      'installation_id', null,
      'grace_days', 14,
      'activated_at', null
    );
  END IF;

  v_effective := public.license_effective_status(
    v_license.expires_at, v_license.grace_days, v_license.status
  );
  v_users := public.license_active_user_count();

  IF v_license.expires_at IS NULL THEN
    v_days := null;
  ELSE
    v_days := GREATEST(0, ceil(extract(epoch FROM (v_license.expires_at - now())) / 86400)::int);
  END IF;

  v_writable := v_effective IN ('active', 'grace');

  RETURN jsonb_build_object(
    'has_license', true,
    'plan', v_license.plan,
    'status', v_effective,
    'max_users', v_license.max_users,
    'active_users', v_users,
    'seats_available', GREATEST(0, v_license.max_users - v_users),
    'features', v_license.features,
    'is_writable', v_writable,
    'days_remaining', v_days,
    'expires_at', v_license.expires_at,
    'customer_name', v_license.customer_name,
    'installation_id', v_license.installation_id,
    'grace_days', v_license.grace_days,
    'activated_at', v_license.activated_at,
    'issued_at', v_license.issued_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_license_status() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.license_can_add_user() TO service_role;

-- =============================================================================
-- 4. Seat limit on user registration
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
BEGIN
  IF NOT public.license_can_add_user() THEN
    RAISE EXCEPTION 'Достигнут лимит пользователей по лицензии';
  END IF;

  v_auth_method := lower(trim(COALESCE(p_auth_method, 'email')));
  IF v_auth_method NOT IN ('email', 'eds', 'both') THEN
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
    id, email, full_name_ru, full_name_kk, locale, iin, password_hash, auth_method
  ) VALUES (
    v_id,
    lower(trim(p_email)),
    NULLIF(trim(p_full_name_ru), ''),
    NULLIF(trim(p_full_name_kk), ''),
    COALESCE(NULLIF(trim(p_locale), ''), 'ru'),
    NULLIF(trim(p_iin), ''),
    public.hash_password(p_password),
    v_auth_method
  );

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (v_id, 'viewer');
  END IF;

  RETURN v_id;
END;
$$;

-- Audit trigger
DROP TRIGGER IF EXISTS trg_audit_installation_license ON public.installation_license;
CREATE TRIGGER trg_audit_installation_license
  AFTER INSERT OR UPDATE OR DELETE ON public.installation_license
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

NOTIFY pgrst, 'reload schema';
