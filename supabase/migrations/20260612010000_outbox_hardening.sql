-- Outbox hardening: retry scheduling, row claiming (SKIP LOCKED), stale claim recovery

-- =============================================================================
-- 1. email_outbox
-- =============================================================================

ALTER TABLE public.email_outbox
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

ALTER TABLE public.email_outbox DROP CONSTRAINT IF EXISTS email_outbox_status_check;
ALTER TABLE public.email_outbox ADD CONSTRAINT email_outbox_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped'));

DROP INDEX IF EXISTS idx_email_outbox_pending;
CREATE INDEX IF NOT EXISTS idx_email_outbox_pending
  ON public.email_outbox (status, next_retry_at, created_at)
  WHERE status IN ('pending', 'processing');

-- =============================================================================
-- 2. telegram_outbox
-- =============================================================================

ALTER TABLE public.telegram_outbox
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

ALTER TABLE public.telegram_outbox DROP CONSTRAINT IF EXISTS telegram_outbox_status_check;
ALTER TABLE public.telegram_outbox ADD CONSTRAINT telegram_outbox_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped'));

DROP INDEX IF EXISTS idx_telegram_outbox_pending;
CREATE INDEX IF NOT EXISTS idx_telegram_outbox_pending
  ON public.telegram_outbox (status, next_retry_at, created_at)
  WHERE status IN ('pending', 'processing');

-- =============================================================================
-- 3. webhook_outbox — processing + claimed_at for SKIP LOCKED claims
-- =============================================================================

ALTER TABLE public.webhook_outbox
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

ALTER TABLE public.webhook_outbox DROP CONSTRAINT IF EXISTS webhook_outbox_status_check;
ALTER TABLE public.webhook_outbox ADD CONSTRAINT webhook_outbox_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'failed'));

DROP INDEX IF EXISTS idx_webhook_outbox_pending;
CREATE INDEX IF NOT EXISTS idx_webhook_outbox_pending
  ON public.webhook_outbox (status, next_retry_at, created_at)
  WHERE status IN ('pending', 'processing');

-- =============================================================================
-- 4. Stale claim recovery (worker crash safety)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.release_stale_outbox_claims(_stale_minutes int DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email int := 0;
  v_telegram int := 0;
  v_webhook int := 0;
  v_cutoff timestamptz := now() - make_interval(mins => GREATEST(_stale_minutes, 1));
BEGIN
  UPDATE public.email_outbox
  SET status = 'pending', claimed_at = NULL
  WHERE status = 'processing' AND claimed_at IS NOT NULL AND claimed_at < v_cutoff;
  GET DIAGNOSTICS v_email = ROW_COUNT;

  UPDATE public.telegram_outbox
  SET status = 'pending', claimed_at = NULL
  WHERE status = 'processing' AND claimed_at IS NOT NULL AND claimed_at < v_cutoff;
  GET DIAGNOSTICS v_telegram = ROW_COUNT;

  UPDATE public.webhook_outbox
  SET status = 'pending', claimed_at = NULL
  WHERE status = 'processing' AND claimed_at IS NOT NULL AND claimed_at < v_cutoff;
  GET DIAGNOSTICS v_webhook = ROW_COUNT;

  RETURN jsonb_build_object(
    'email', v_email,
    'telegram', v_telegram,
    'webhook', v_webhook
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_stale_outbox_claims(int) TO service_role;

-- =============================================================================
-- 5. Claim batch functions (FOR UPDATE SKIP LOCKED)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.claim_email_outbox_batch(_limit int DEFAULT 25)
RETURNS SETOF public.email_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT o.id
    FROM public.email_outbox o
    WHERE o.status = 'pending'
      AND o.next_retry_at <= now()
    ORDER BY o.created_at
    LIMIT GREATEST(_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.email_outbox e
  SET status = 'processing', claimed_at = now()
  FROM picked p
  WHERE e.id = p.id
  RETURNING e.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_telegram_outbox_batch(_limit int DEFAULT 25)
RETURNS SETOF public.telegram_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT o.id
    FROM public.telegram_outbox o
    WHERE o.status = 'pending'
      AND o.next_retry_at <= now()
    ORDER BY o.created_at
    LIMIT GREATEST(_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.telegram_outbox e
  SET status = 'processing', claimed_at = now()
  FROM picked p
  WHERE e.id = p.id
  RETURNING e.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_webhook_outbox_batch(_limit int DEFAULT 50)
RETURNS TABLE (
  id uuid,
  subscription_id uuid,
  event text,
  payload jsonb,
  attempts int,
  url text,
  secret text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT o.id
    FROM public.webhook_outbox o
    WHERE o.status = 'pending'
      AND o.next_retry_at <= now()
    ORDER BY o.created_at
    LIMIT GREATEST(_limit, 1)
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.webhook_outbox w
    SET status = 'processing', claimed_at = now()
    FROM picked p
    WHERE w.id = p.id
    RETURNING w.*
  )
  SELECT
    c.id,
    c.subscription_id,
    c.event,
    c.payload,
    c.attempts,
    s.url,
    s.secret,
    s.is_active
  FROM claimed c
  JOIN public.webhook_subscriptions s ON s.id = c.subscription_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_email_outbox_batch(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_telegram_outbox_batch(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_webhook_outbox_batch(int) TO service_role;
