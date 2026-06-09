-- License mechanics hardening: grace metrics, fail-closed RPC, RLS, admin suspend

-- =============================================================================
-- 1. Improved status RPC (grace_days_remaining, fail-closed when no row)
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
      'issued_at', null
    );
  END IF;

  v_effective := public.license_effective_status(
    v_license.expires_at, v_license.grace_days, v_license.status
  );
  v_users := public.license_active_user_count();

  IF v_license.expires_at IS NULL THEN
    v_days_until_expiry := null;
    v_grace_remaining := null;
  ELSE
    v_days_until_expiry := GREATEST(
      0,
      ceil(extract(epoch FROM (v_license.expires_at - now())) / 86400)::int
    );
    v_grace_end := v_license.expires_at + make_interval(days => COALESCE(v_license.grace_days, 0));
    IF now() > v_license.expires_at AND v_effective = 'grace' THEN
      v_grace_remaining := GREATEST(
        0,
        ceil(extract(epoch FROM (v_grace_end - now())) / 86400)::int
      );
    ELSE
      v_grace_remaining := 0;
    END IF;
  END IF;

  v_writable := v_effective IN ('active', 'grace');

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
    'issued_at', v_license.issued_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.license_can_add_user()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_license public.installation_license;
  v_status text;
  v_count int;
BEGIN
  v_license := public.license_row();
  IF v_license IS NULL THEN
    RETURN false;
  END IF;

  v_status := public.license_effective_status(
    v_license.expires_at, v_license.grace_days, v_license.status
  );
  IF v_status IN ('expired', 'suspended') THEN
    RETURN false;
  END IF;

  v_count := public.license_active_user_count();
  RETURN v_count < v_license.max_users;
END;
$$;

-- =============================================================================
-- 2. Suspend / resume (service_role or manage_license via server fn)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_license_status(p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_license public.installation_license;
BEGIN
  IF p_status NOT IN ('active', 'suspended') THEN
    RAISE EXCEPTION 'Недопустимый статус лицензии: %', p_status;
  END IF;

  IF NOT public.user_has_permission(auth.uid(), 'manage_license') THEN
    RAISE EXCEPTION 'Forbidden: missing permission manage_license';
  END IF;

  v_license := public.license_row();
  IF v_license IS NULL THEN
    RAISE EXCEPTION 'Лицензия не настроена';
  END IF;

  UPDATE public.installation_license
  SET status = p_status, updated_at = now()
  WHERE id = v_license.id;

  RETURN public.get_license_status();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_license_status(text) TO authenticated, service_role;

-- =============================================================================
-- 3. RLS: read-only for clients; writes only via service_role (activateLicenseKey)
-- =============================================================================
DROP POLICY IF EXISTS "license admin write" ON public.installation_license;

REVOKE INSERT, UPDATE, DELETE ON public.installation_license FROM authenticated;
GRANT SELECT ON public.installation_license TO authenticated;

NOTIFY pgrst, 'reload schema';
