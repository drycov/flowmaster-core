-- Telegram login and password reset tokens

CREATE TABLE IF NOT EXISTS public.telegram_auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  purpose text NOT NULL CHECK (purpose IN ('login', 'password_reset')),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  chat_id text,
  code text,
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_auth_tokens_token
  ON public.telegram_auth_tokens(token)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_telegram_auth_tokens_user_reset
  ON public.telegram_auth_tokens(user_id, purpose, created_at DESC)
  WHERE purpose = 'password_reset' AND consumed_at IS NULL;

GRANT ALL ON public.telegram_auth_tokens TO service_role;

ALTER TABLE public.telegram_auth_tokens ENABLE ROW LEVEL SECURITY;

UPDATE public.organization
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
  'telegram', COALESCE(settings->'telegram', '{}'::jsonb) || jsonb_build_object(
    'allow_telegram_login', COALESCE((settings->'telegram'->>'allow_telegram_login')::boolean, true),
    'allow_telegram_password_reset', COALESCE((settings->'telegram'->>'allow_telegram_password_reset')::boolean, true)
  )
)
WHERE settings IS NULL OR NOT (settings ? 'telegram')
   OR NOT (settings->'telegram' ? 'allow_telegram_login');
