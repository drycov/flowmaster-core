-- License server: store non-confidential usage telemetry from client sync/heartbeat.

ALTER TABLE public.license_server_activations
  ADD COLUMN IF NOT EXISTS last_active_users int NOT NULL DEFAULT 0;

ALTER TABLE public.license_server_activations
  ADD COLUMN IF NOT EXISTS telemetry jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.license_server_activations
  ADD COLUMN IF NOT EXISTS telemetry_at timestamptz;

CREATE TABLE IF NOT EXISTS public.license_server_telemetry_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id text NOT NULL,
  activation_id uuid REFERENCES public.license_server_activations(id) ON DELETE SET NULL,
  reported_at timestamptz NOT NULL DEFAULT now(),
  app_version text NOT NULL DEFAULT '',
  total_users int NOT NULL DEFAULT 0 CHECK (total_users >= 0),
  active_users int NOT NULL DEFAULT 0 CHECK (active_users >= 0),
  max_users_allowed int NOT NULL DEFAULT 0 CHECK (max_users_allowed >= 0),
  documents_total int NOT NULL DEFAULT 0 CHECK (documents_total >= 0),
  documents_30d int NOT NULL DEFAULT 0 CHECK (documents_30d >= 0),
  workflows_published int NOT NULL DEFAULT 0 CHECK (workflows_published >= 0),
  environment text NOT NULL DEFAULT '',
  platform text NOT NULL DEFAULT '',
  stats jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_license_server_telemetry_installation
  ON public.license_server_telemetry_snapshots(installation_id, reported_at DESC);

GRANT ALL ON public.license_server_telemetry_snapshots TO service_role;

ALTER TABLE public.license_server_telemetry_snapshots ENABLE ROW LEVEL SECURITY;
