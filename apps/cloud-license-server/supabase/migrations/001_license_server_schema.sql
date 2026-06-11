-- FlowMaster cloud license server — vendor Supabase schema only.
-- Apply to a dedicated Supabase project (not client EDMS DB).

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.license_server_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash text NOT NULL UNIQUE,
  plan text NOT NULL CHECK (plan IN ('trial', 'standard', 'professional', 'enterprise')),
  max_users int NOT NULL CHECK (max_users > 0),
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  customer_name text NOT NULL DEFAULT '',
  installation_id text,
  expires_at timestamptz,
  issued_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  max_activations int NOT NULL DEFAULT 1 CHECK (max_activations >= 1),
  revoked_at timestamptz,
  revoked_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.license_server_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id uuid NOT NULL REFERENCES public.license_server_keys(id) ON DELETE CASCADE,
  installation_id text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  hostname text NOT NULL DEFAULT '',
  app_version text NOT NULL DEFAULT '',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_reason text NOT NULL DEFAULT '',
  UNIQUE (key_id, installation_id)
);

CREATE INDEX IF NOT EXISTS idx_license_server_activations_installation
  ON public.license_server_activations(installation_id);

CREATE TABLE IF NOT EXISTS public.license_server_provisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id text NOT NULL UNIQUE,
  plan text NOT NULL CHECK (plan IN ('trial', 'standard', 'professional', 'enterprise')),
  max_users int NOT NULL CHECK (max_users > 0),
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  customer_name text NOT NULL DEFAULT '',
  expires_at timestamptz,
  issued_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'suspended')),
  revoked_at timestamptz,
  revoked_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_license_server_provisions_status
  ON public.license_server_provisions(status);

GRANT ALL ON public.license_server_keys TO service_role;
GRANT ALL ON public.license_server_activations TO service_role;
GRANT ALL ON public.license_server_provisions TO service_role;

ALTER TABLE public.license_server_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_server_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_server_provisions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS license_server_keys_updated ON public.license_server_keys;
CREATE TRIGGER license_server_keys_updated
  BEFORE UPDATE ON public.license_server_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS license_server_provisions_updated ON public.license_server_provisions;
CREATE TRIGGER license_server_provisions_updated
  BEFORE UPDATE ON public.license_server_provisions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
