-- App-owned authentication (no supabase.auth / auth.users dependency)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles: credentials + standalone user ids
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS auth_method TEXT NOT NULL DEFAULT 'email'
    CHECK (auth_method IN ('email', 'eds'));

ALTER TABLE public.profiles
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DO $$
DECLARE
  r RECORD;
  col_name TEXT;
  on_delete TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_id_fkey' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
  END IF;

  FOR r IN
    SELECT
      c.conname,
      c.conrelid::regclass AS child_table,
      c.conkey,
      pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND c.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    SELECT a.attname INTO col_name
    FROM pg_attribute a
    WHERE a.attrelid = r.child_table
      AND a.attnum = r.conkey[1];

    on_delete := CASE
      WHEN r.def LIKE '%ON DELETE CASCADE%' THEN 'CASCADE'
      WHEN r.def LIKE '%ON DELETE SET NULL%' THEN 'SET NULL'
      ELSE 'NO ACTION'
    END;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.child_table, r.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE %s',
      r.child_table, r.conname, col_name, on_delete
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.app_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_user ON public.app_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expires ON public.app_sessions(expires_at);

GRANT ALL ON public.app_sessions TO service_role;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.hash_password(p_password TEXT)
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT extensions.crypt(p_password, extensions.gen_salt('bf'::text, 10));
$$;

CREATE OR REPLACE FUNCTION public.verify_password(p_password TEXT, p_hash TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT p_hash IS NOT NULL AND p_hash = extensions.crypt(p_password, p_hash);
$$;

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
BEGIN
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
    COALESCE(NULLIF(trim(p_auth_method), ''), 'email')
  );

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (v_id, 'viewer');
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.authenticate_app_user(
  p_email TEXT,
  p_password TEXT
)
RETURNS TABLE (user_id UUID, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
BEGIN
  SELECT p.id, p.email
  INTO v_user_id, v_email
  FROM public.profiles p
  WHERE lower(p.email) = lower(trim(p_email))
    AND p.password_hash IS NOT NULL
    AND public.verify_password(p_password, p.password_hash)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Неверный email или пароль';
  END IF;

  RETURN QUERY SELECT v_user_id, v_email;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_app_user_password(
  p_user_id UUID,
  p_new_password TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_new_password IS NULL OR length(p_new_password) < 8 THEN
    RAISE EXCEPTION 'Пароль должен быть не короче 8 символов';
  END IF;

  UPDATE public.profiles
  SET password_hash = public.hash_password(p_new_password),
      updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Пользователь не найден';
  END IF;

  DELETE FROM public.app_sessions WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.hash_password(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_password(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_app_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.authenticate_app_user(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.change_app_user_password(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.register_app_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.authenticate_app_user(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.change_app_user_password(UUID, TEXT) TO service_role;

-- ensure_my_profile: use session user id only (no auth.users)
CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  IF FOUND THEN
    RETURN v_profile;
  END IF;

  RAISE EXCEPTION 'Профиль пользователя не найден';
END;
$$;
