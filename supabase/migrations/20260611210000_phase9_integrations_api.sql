-- Phase 9: REST API keys, webhooks, import jobs

-- =============================================================================
-- 1. API keys
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['documents:read', 'tasks:read']::text[],
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_used_at timestamptz,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON public.api_keys (key_prefix);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_api_keys_updated ON public.api_keys;
CREATE TRIGGER trg_api_keys_updated
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "api_keys_admin" ON public.api_keys;
CREATE POLICY "api_keys_admin" ON public.api_keys
  FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_license')
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_license')
  );

-- =============================================================================
-- 2. Webhook subscriptions + outbox
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  secret text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  events text[] NOT NULL DEFAULT ARRAY['task.created', 'document.signed', 'document.status_changed']::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_outbox_pending
  ON public.webhook_outbox (status, next_retry_at)
  WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_subscriptions TO authenticated;
GRANT SELECT ON public.webhook_outbox TO authenticated;
GRANT ALL ON public.webhook_subscriptions TO service_role;
GRANT ALL ON public.webhook_outbox TO service_role;

ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_outbox ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_webhook_subscriptions_updated ON public.webhook_subscriptions;
CREATE TRIGGER trg_webhook_subscriptions_updated
  BEFORE UPDATE ON public.webhook_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "webhook_subs_admin" ON public.webhook_subscriptions;
CREATE POLICY "webhook_subs_admin" ON public.webhook_subscriptions
  FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_license')
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_license')
  );

DROP POLICY IF EXISTS "webhook_outbox_admin_read" ON public.webhook_outbox;
CREATE POLICY "webhook_outbox_admin_read" ON public.webhook_outbox
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_license')
  );

-- =============================================================================
-- 3. Import jobs
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'incoming' CHECK (kind IN ('incoming', 'outgoing', 'generic')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  source text NOT NULL DEFAULT 'api',
  total_count int NOT NULL DEFAULT 0,
  success_count int NOT NULL DEFAULT 0,
  error_count int NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.import_jobs TO authenticated;
GRANT ALL ON public.import_jobs TO service_role;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_jobs_admin" ON public.import_jobs;
CREATE POLICY "import_jobs_admin" ON public.import_jobs
  FOR ALL TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_license')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_license')
  );

-- =============================================================================
-- 4. Webhook queue function + triggers
-- =============================================================================

CREATE OR REPLACE FUNCTION public.queue_webhook_event(_event text, _payload jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  INSERT INTO public.webhook_outbox (subscription_id, event, payload)
  SELECT s.id, _event, _payload
  FROM public.webhook_subscriptions s
  WHERE s.is_active
    AND _event = ANY(s.events);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.queue_webhook_event(text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_webhook_task_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.queue_webhook_event(
    'task.created',
    jsonb_build_object(
      'task_id', NEW.id,
      'document_id', NEW.document_id,
      'assignee_id', NEW.assignee_id,
      'node_type', NEW.node_type,
      'status', NEW.status,
      'due_at', NEW.due_at
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_webhook_task_created ON public.workflow_tasks;
CREATE TRIGGER trg_webhook_task_created
  AFTER INSERT ON public.workflow_tasks
  FOR EACH ROW EXECUTE FUNCTION public.trg_webhook_task_created();

CREATE OR REPLACE FUNCTION public.trg_webhook_document_signed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'signed' THEN
    PERFORM public.queue_webhook_event(
      'document.signed',
      jsonb_build_object(
        'signature_id', NEW.id,
        'document_id', NEW.document_id,
        'signer_id', NEW.signer_id,
        'signed_at', NEW.signed_at
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_webhook_document_signed ON public.document_signatures;
CREATE TRIGGER trg_webhook_document_signed
  AFTER INSERT ON public.document_signatures
  FOR EACH ROW EXECUTE FUNCTION public.trg_webhook_document_signed();

CREATE OR REPLACE FUNCTION public.trg_webhook_document_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.queue_webhook_event(
      'document.status_changed',
      jsonb_build_object(
        'document_id', NEW.id,
        'reg_number', NEW.reg_number,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_webhook_document_status ON public.documents;
CREATE TRIGGER trg_webhook_document_status
  AFTER UPDATE OF status ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.trg_webhook_document_status();
