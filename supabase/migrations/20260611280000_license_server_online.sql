-- Phase 14: License server — online activation, phone-home, cloud revocation

-- =============================================================================
-- 1. Vendor registry (license server DB; empty on customer installs)
-- =============================================================================
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

GRANT ALL ON public.license_server_keys TO service_role;
GRANT ALL ON public.license_server_activations TO service_role;

ALTER TABLE public.license_server_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_server_activations ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. Customer installation — online sync fields
-- =============================================================================
ALTER TABLE public.installation_license
  ADD COLUMN IF NOT EXISTS activation_mode text NOT NULL DEFAULT 'offline'
    CHECK (activation_mode IN ('offline', 'online')),
  ADD COLUMN IF NOT EXISTS license_server_token text,
  ADD COLUMN IF NOT EXISTS license_key_id uuid,
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_sync_error text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS server_revoked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sync_interval_hours int NOT NULL DEFAULT 6
    CHECK (sync_interval_hours >= 1),
  ADD COLUMN IF NOT EXISTS offline_grace_hours int NOT NULL DEFAULT 72
    CHECK (offline_grace_hours >= 1);

-- =============================================================================
-- 3. Status RPC — online mode, sync staleness, server revocation
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_license_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_license public.installation_license;
  v_effective text;
  v_users int;
  v_days_until_expiry int;
  v_grace_remaining int;
  v_writable boolean;
  v_grace_end timestamptz;
  v_sync_stale boolean;
  v_hours_since_sync numeric;
BEGIN
  v_license := public.license_row();
  IF v_license IS NULL THEN
    RETURN jsonb_build_object(
      'has_license', false,
      'plan', 'trial',
      'status', 'expired',
      'max_users', 0,
      'active_users', public.license_active_user_count(),
      'seats_available', 0,
      'features', '{}'::jsonb,
      'is_writable', false,
      'days_remaining', 0,
      'grace_days_remaining', 0,
      'expires_at', null,
      'customer_name', '',
      'installation_id', null,
      'grace_days', 14,
      'activated_at', null,
      'issued_at', null,
      'activation_mode', 'offline',
      'last_sync_at', null,
      'last_sync_ok', false,
      'last_sync_error', '',
      'server_revoked', false,
      'sync_stale', false,
      'offline_grace_hours', 72,
      'sync_interval_hours', 6
    );
  END IF;

  v_effective := public.license_effective_status(
    v_license.expires_at, v_license.grace_days, v_license.status
  );
  v_users := public.license_active_user_count();

  IF v_license.server_revoked THEN
    v_effective := 'suspended';
  END IF;

  v_sync_stale := false;
  v_hours_since_sync := null;
  IF v_license.activation_mode = 'online' THEN
    IF v_license.last_sync_at IS NULL THEN
      v_sync_stale := true;
    ELSE
      v_hours_since_sync := extract(epoch FROM (now() - v_license.last_sync_at)) / 3600.0;
      IF v_hours_since_sync > v_license.offline_grace_hours THEN
        v_sync_stale := true;
        v_effective := 'expired';
      ELSIF v_hours_since_sync > v_license.sync_interval_hours * 2 THEN
        v_sync_stale := true;
        IF v_effective = 'active' THEN
          v_effective := 'grace';
        END IF;
      END IF;
    END IF;
  END IF;

  IF v_license.expires_at IS NULL THEN
    v_days_until_expiry := null;
    v_grace_remaining := null;
  ELSE
    v_days_until_expiry := GREATEST(
      0,
      ceil(extract(epoch FROM (v_license.expires_at - now())) / 86400)::int
    );
    v_grace_end := v_license.expires_at + make_interval(days => COALESCE(v_license.grace_days, 0));
    IF now() > v_license.expires_at AND v_effective = 'grace' AND NOT v_sync_stale THEN
      v_grace_remaining := GREATEST(
        0,
        ceil(extract(epoch FROM (v_grace_end - now())) / 86400)::int
      );
    ELSE
      v_grace_remaining := 0;
    END IF;
  END IF;

  v_writable := v_effective IN ('active', 'grace') AND NOT v_license.server_revoked;

  RETURN jsonb_build_object(
    'has_license', true,
    'plan', v_license.plan,
    'status', v_effective,
    'max_users', v_license.max_users,
    'active_users', v_users,
    'seats_available', GREATEST(0, v_license.max_users - v_users),
    'features', v_license.features,
    'is_writable', v_writable,
    'days_remaining', v_days_until_expiry,
    'grace_days_remaining', v_grace_remaining,
    'expires_at', v_license.expires_at,
    'customer_name', v_license.customer_name,
    'installation_id', v_license.installation_id,
    'grace_days', v_license.grace_days,
    'activated_at', v_license.activated_at,
    'issued_at', v_license.issued_at,
    'activation_mode', v_license.activation_mode,
    'last_sync_at', v_license.last_sync_at,
    'last_sync_ok', v_license.last_sync_ok,
    'last_sync_error', v_license.last_sync_error,
    'server_revoked', v_license.server_revoked,
    'sync_stale', v_sync_stale,
    'offline_grace_hours', v_license.offline_grace_hours,
    'sync_interval_hours', v_license.sync_interval_hours
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
