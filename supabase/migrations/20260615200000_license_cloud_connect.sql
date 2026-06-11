-- Cloud license: provision installations without FM1 keys; offline sync must not kill license.

-- =============================================================================
-- 1. Vendor provisions (installation_id → entitlement on cloud license server)
-- =============================================================================
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

GRANT ALL ON public.license_server_provisions TO service_role;
ALTER TABLE public.license_server_provisions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER license_server_provisions_updated
  BEFORE UPDATE ON public.license_server_provisions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 2. get_license_status — sync loss = offline flag, do NOT expire entitlement
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
  v_offline_mode boolean;
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
      'offline_mode', false,
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
  v_offline_mode := false;
  v_hours_since_sync := null;

  IF v_license.activation_mode = 'online' THEN
    IF v_license.last_sync_at IS NULL THEN
      v_sync_stale := true;
      v_offline_mode := true;
    ELSE
      v_hours_since_sync := extract(epoch FROM (now() - v_license.last_sync_at)) / 3600.0;
      IF v_hours_since_sync > v_license.sync_interval_hours * 2 THEN
        v_sync_stale := true;
        v_offline_mode := true;
      END IF;
      IF NOT COALESCE(v_license.last_sync_ok, false) AND v_hours_since_sync > v_license.sync_interval_hours THEN
        v_offline_mode := true;
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
    IF now() > v_license.expires_at AND v_effective = 'grace' AND NOT v_offline_mode THEN
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
    'offline_mode', v_offline_mode,
    'offline_grace_hours', v_license.offline_grace_hours,
    'sync_interval_hours', v_license.sync_interval_hours
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
