-- Local license server replica: cache upstream (cloud) entitlement + token for relay sync.

CREATE TABLE IF NOT EXISTS public.license_server_upstream_cache (
  installation_id text PRIMARY KEY,
  upstream_token text NOT NULL,
  upstream_key_id text NOT NULL DEFAULT '',
  last_sync_at timestamptz,
  last_sync_ok boolean NOT NULL DEFAULT false,
  last_sync_error text NOT NULL DEFAULT '',
  server_revoked boolean NOT NULL DEFAULT false,
  last_active_users int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.license_server_upstream_cache TO service_role;
ALTER TABLE public.license_server_upstream_cache ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER license_server_upstream_cache_updated
  BEFORE UPDATE ON public.license_server_upstream_cache
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.license_server_activations
  ADD COLUMN IF NOT EXISTS last_active_users int NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
