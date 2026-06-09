-- Telegram notifications: user linking, outbox, /start command support

ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS telegram_chat_id text,
  ADD COLUMN IF NOT EXISTS telegram_username text,
  ADD COLUMN IF NOT EXISTS telegram_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS telegram_task_assigned boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS telegram_workflow_events boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS telegram_document_returned boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS telegram_linked_at timestamptz;

CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_token
  ON public.telegram_link_tokens(token)
  WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS public.telegram_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  chat_id text NOT NULL,
  message_text text NOT NULL,
  app_link text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_outbox_pending
  ON public.telegram_outbox(status, created_at)
  WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE ON public.telegram_link_tokens TO authenticated;
GRANT ALL ON public.telegram_link_tokens TO service_role;
GRANT SELECT ON public.telegram_outbox TO authenticated;
GRANT ALL ON public.telegram_outbox TO service_role;

ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "telegram_link_tokens_own" ON public.telegram_link_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "telegram_outbox_admin_read" ON public.telegram_outbox
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

UPDATE public.organization
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
  'telegram', COALESCE(settings->'telegram', '{}'::jsonb) || jsonb_build_object(
    'webhook_secret', COALESCE(settings->'telegram'->>'webhook_secret', '')
  )
)
WHERE settings IS NULL OR NOT (settings ? 'telegram')
   OR NOT (settings->'telegram' ? 'webhook_secret');

CREATE OR REPLACE FUNCTION public.is_approval_notification(_type text, _title text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _type = 'workflow'
    OR COALESCE(_title, '') ILIKE '%соглас%'
    OR COALESCE(_title, '') ILIKE '%келіс%'
    OR COALESCE(_title, '') ILIKE '%approval%';
$$;

CREATE OR REPLACE FUNCTION public.org_telegram_settings()
RETURNS TABLE (
  enabled boolean,
  notify_on_tasks boolean,
  notify_on_approvals boolean,
  default_chat_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((o.settings->'telegram'->>'enabled')::boolean, false),
    COALESCE((o.settings->'telegram'->>'notify_on_tasks')::boolean, true),
    COALESCE((o.settings->'telegram'->>'notify_on_approvals')::boolean, true),
    COALESCE(o.settings->'telegram'->>'default_chat_id', '')
  FROM public.organization o
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.should_send_notification_telegram(
  _user_id uuid,
  _type text,
  _title text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org record;
  v_is_approval boolean;
BEGIN
  SELECT * INTO v_org FROM public.org_telegram_settings();
  IF NOT COALESCE(v_org.enabled, false) THEN
    RETURN false;
  END IF;

  v_is_approval := public.is_approval_notification(_type, _title);
  IF v_is_approval AND NOT COALESCE(v_org.notify_on_approvals, true) THEN
    RETURN false;
  END IF;
  IF NOT v_is_approval AND NOT COALESCE(v_org.notify_on_tasks, true) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_notification_preferences pref
    WHERE pref.user_id = _user_id
      AND COALESCE(pref.telegram_enabled, true) = true
      AND pref.telegram_chat_id IS NOT NULL
      AND btrim(pref.telegram_chat_id) <> ''
      AND (
        (_type = 'task' AND COALESCE(pref.telegram_task_assigned, true))
        OR (_type = 'return' AND COALESCE(pref.telegram_document_returned, true))
        OR (_type IN ('workflow', 'sla', 'system') AND COALESCE(pref.telegram_workflow_events, true))
        OR (_type NOT IN ('task', 'return', 'workflow', 'sla', 'system'))
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_notification_telegram()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id text;
  v_text text;
  v_link text;
BEGIN
  IF NOT public.should_send_notification_telegram(NEW.user_id, NEW.type, NEW.title) THEN
    RETURN NEW;
  END IF;

  SELECT pref.telegram_chat_id INTO v_chat_id
  FROM public.user_notification_preferences pref
  WHERE pref.user_id = NEW.user_id;

  IF v_chat_id IS NULL OR btrim(v_chat_id) = '' THEN
    RETURN NEW;
  END IF;

  v_text := '<b>' || replace(NEW.title, '<', '&lt;') || '</b>';
  IF NEW.body IS NOT NULL AND btrim(NEW.body) <> '' THEN
    v_text := v_text || E'\n' || replace(NEW.body, '<', '&lt;');
  END IF;
  v_link := NEW.link;

  INSERT INTO public.telegram_outbox (
    notification_id, user_id, chat_id, message_text, app_link, status
  ) VALUES (
    NEW.id,
    NEW.user_id,
    v_chat_id,
    v_text,
    v_link,
    'pending'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_telegram_queue ON public.notifications;
CREATE TRIGGER trg_notifications_telegram_queue
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.queue_notification_telegram();

GRANT EXECUTE ON FUNCTION public.is_approval_notification(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.org_telegram_settings() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.should_send_notification_telegram(uuid, text, text) TO authenticated, service_role;
