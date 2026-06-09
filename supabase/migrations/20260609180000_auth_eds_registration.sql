-- EDS (NCALayer) authentication: IIN on profile + one-time auth challenges

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS iin text,
  ADD COLUMN IF NOT EXISTS cert_subject text,
  ADD COLUMN IF NOT EXISTS cert_serial text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_iin_unique
  ON public.profiles (iin) WHERE iin IS NOT NULL AND iin <> '';

CREATE TABLE IF NOT EXISTS public.auth_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('login', 'register')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires
  ON public.auth_challenges (expires_at) WHERE used_at IS NULL;

ALTER TABLE public.auth_challenges ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role / SECURITY DEFINER functions access this table

GRANT ALL ON public.auth_challenges TO service_role;

-- Persist IIN from EDS signup metadata on profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name_ru, full_name_kk, locale, iin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name_ru', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name_kk', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'locale', 'ru'),
    NULLIF(NEW.raw_user_meta_data->>'iin', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name_ru = COALESCE(public.profiles.full_name_ru, EXCLUDED.full_name_ru),
    full_name_kk = COALESCE(public.profiles.full_name_kk, EXCLUDED.full_name_kk),
    iin = COALESCE(public.profiles.iin, EXCLUDED.iin);

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    PERFORM public.grant_app_role(NEW.id, 'admin', 'first_user_bootstrap');
  ELSE
    PERFORM public.grant_app_role(NEW.id, 'viewer', 'default_signup');
  END IF;

  RETURN NEW;
END $$;
