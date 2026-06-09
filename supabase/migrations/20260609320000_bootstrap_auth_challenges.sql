-- EDS auth challenges (idempotent bootstrap + PostgREST schema reload)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS iin text,
      ADD COLUMN IF NOT EXISTS cert_subject text,
      ADD COLUMN IF NOT EXISTS cert_serial text;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_iin_unique
      ON public.profiles (iin) WHERE iin IS NOT NULL AND iin <> '';
  END IF;
END $$;

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

GRANT ALL ON public.auth_challenges TO service_role;

NOTIFY pgrst, 'reload schema';
