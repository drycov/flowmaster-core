-- Backfill profiles for auth.users without a profile row (fixes REST 406 on .single())

INSERT INTO public.profiles (id, email, full_name_ru, full_name_kk, locale, iin)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name_ru', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  COALESCE(u.raw_user_meta_data->>'full_name_kk', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  COALESCE(u.raw_user_meta_data->>'locale', 'ru'),
  NULLIF(u.raw_user_meta_data->>'iin', '')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- Default roles for users without any role
DO $grant$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT u.id
      FROM auth.users u
     WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
      PERFORM public.grant_app_role(r.id, 'admin', 'profile_backfill_first_admin');
    ELSE
      PERFORM public.grant_app_role(r.id, 'viewer', 'profile_backfill_default');
    END IF;
  END LOOP;
END $grant$;

-- Callable on demand when a session exists but profile row is missing
CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user auth.users%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  IF FOUND THEN
    RETURN v_profile;
  END IF;

  SELECT * INTO v_user FROM auth.users WHERE id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auth user not found';
  END IF;

  INSERT INTO public.profiles (id, email, full_name_ru, full_name_kk, locale, iin)
  VALUES (
    v_user.id,
    v_user.email,
    COALESCE(v_user.raw_user_meta_data->>'full_name_ru', v_user.raw_user_meta_data->>'full_name', split_part(v_user.email, '@', 1)),
    COALESCE(v_user.raw_user_meta_data->>'full_name_kk', v_user.raw_user_meta_data->>'full_name', split_part(v_user.email, '@', 1)),
    COALESCE(v_user.raw_user_meta_data->>'locale', 'ru'),
    NULLIF(v_user.raw_user_meta_data->>'iin', '')
  )
  RETURNING * INTO v_profile;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    PERFORM public.grant_app_role(v_user.id, 'admin', 'ensure_profile_first_admin');
  ELSIF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user.id) THEN
    PERFORM public.grant_app_role(v_user.id, 'viewer', 'ensure_profile_default');
  END IF;

  RETURN v_profile;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_my_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;
