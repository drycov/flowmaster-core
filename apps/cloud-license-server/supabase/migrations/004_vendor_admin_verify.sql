-- Cloud Admin step-up verification (Telegram or approval webhook).

CREATE TABLE IF NOT EXISTS public.vendor_admin_verify_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  confirmed_via text CHECK (confirmed_via IN ('telegram', 'webhook')),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_admin_verify_challenges_token
  ON public.vendor_admin_verify_challenges(token);

CREATE INDEX IF NOT EXISTS idx_vendor_admin_verify_challenges_user
  ON public.vendor_admin_verify_challenges(user_id, created_at DESC);

GRANT ALL ON public.vendor_admin_verify_challenges TO service_role;

ALTER TABLE public.vendor_admin_verify_challenges ENABLE ROW LEVEL SECURITY;
