-- Tenant provisioning: org lifecycle + register_app_user organization override

ALTER TABLE public.organization
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS organization_slug_unique_active
  ON public.organization (lower(slug))
  WHERE slug IS NOT NULL AND trim(slug) <> '';

-- When a second organization appears, mark platform as multi-tenant capable
CREATE OR REPLACE FUNCTION public.sync_tenant_mode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*)::int INTO v_count FROM public.organization;
  IF v_count > 1 THEN
    UPDATE public.organization SET tenant_mode = 'multi';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organization_sync_tenant_mode ON public.organization;
CREATE TRIGGER trg_organization_sync_tenant_mode
  AFTER INSERT ON public.organization
  FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_mode();

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
