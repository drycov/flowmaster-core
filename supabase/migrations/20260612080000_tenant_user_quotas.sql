-- Per-tenant user quotas (optional cap per organization)

ALTER TABLE public.organization
  ADD COLUMN IF NOT EXISTS max_users integer CHECK (max_users IS NULL OR max_users > 0);

COMMENT ON COLUMN public.organization.max_users IS
  'Optional per-organization user seat cap. NULL = no org-specific limit (installation license only).';

CREATE OR REPLACE FUNCTION public.organization_user_count(p_org_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM public.profiles WHERE organization_id = p_org_id;
$$;

CREATE OR REPLACE FUNCTION public.organization_can_add_user(p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max integer;
  v_count integer;
BEGIN
  IF p_org_id IS NULL THEN
    RETURN true;
  END IF;

  SELECT o.max_users INTO v_max
  FROM public.organization o
  WHERE o.id = p_org_id;

  IF v_max IS NULL THEN
    RETURN true;
  END IF;

  v_count := public.organization_user_count(p_org_id);
  RETURN v_count < v_max;
END;
$$;

GRANT EXECUTE ON FUNCTION public.organization_user_count(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.organization_can_add_user(uuid) TO authenticated, service_role;

-- register_app_user: enforce org quota after org resolution
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
