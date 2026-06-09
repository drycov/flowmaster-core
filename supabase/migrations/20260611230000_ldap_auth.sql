-- LDAP / Active Directory authentication support

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'profiles'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%auth_method%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_auth_method_check
  CHECK (auth_method IN ('email', 'eds', 'both', 'ldap'));

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

UPDATE public.organization
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
  'ldap', COALESCE(settings->'ldap', '{}'::jsonb) || jsonb_build_object(
    'enabled', COALESCE((settings->'ldap'->>'enabled')::boolean, false),
    'url', COALESCE(settings->'ldap'->>'url', ''),
    'base_dn', COALESCE(settings->'ldap'->>'base_dn', ''),
    'bind_dn', COALESCE(settings->'ldap'->>'bind_dn', ''),
    'user_filter', COALESCE(settings->'ldap'->>'user_filter', '(&(objectClass=user)(sAMAccountName={{username}}))'),
    'email_attr', COALESCE(settings->'ldap'->>'email_attr', 'mail'),
    'display_name_attr', COALESCE(settings->'ldap'->>'display_name_attr', 'displayName'),
    'auto_provision', COALESCE((settings->'ldap'->>'auto_provision')::boolean, true),
    'default_role', COALESCE(settings->'ldap'->>'default_role', 'viewer'),
    'reject_unauthorized', COALESCE((settings->'ldap'->>'reject_unauthorized')::boolean, true)
  )
)
WHERE settings IS NULL OR NOT (settings ? 'ldap');

NOTIFY pgrst, 'reload schema';
