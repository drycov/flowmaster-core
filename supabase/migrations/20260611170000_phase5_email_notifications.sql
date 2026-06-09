-- Phase 5: email notifications (outbox + user preferences)

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  email_task_assigned boolean NOT NULL DEFAULT true,
  email_workflow_events boolean NOT NULL DEFAULT true,
  email_document_returned boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  body_text text,
  body_html text,
  app_link text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_pending
  ON public.email_outbox(status, created_at)
  WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE ON public.user_notification_preferences TO authenticated;
GRANT ALL ON public.user_notification_preferences TO service_role;
GRANT SELECT ON public.email_outbox TO authenticated;
GRANT ALL ON public.email_outbox TO service_role;

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unp_select_own" ON public.user_notification_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "unp_upsert_own" ON public.user_notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "email_outbox_admin_read" ON public.email_outbox
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_unp_updated ON public.user_notification_preferences;
CREATE TRIGGER trg_unp_updated
  BEFORE UPDATE ON public.user_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.should_send_notification_email(
  _user_id uuid,
  _type text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.user_notification_preferences pref ON pref.user_id = p.id
    WHERE p.id = _user_id
      AND p.email IS NOT NULL
      AND btrim(p.email) <> ''
      AND p.email NOT LIKE 'eds.%@esedo.local'
      AND COALESCE(pref.email_enabled, true) = true
      AND (
        (_type = 'task' AND COALESCE(pref.email_task_assigned, true))
        OR (_type = 'return' AND COALESCE(pref.email_document_returned, true))
        OR (_type IN ('workflow', 'sla', 'system') AND COALESCE(pref.email_workflow_events, true))
        OR (_type NOT IN ('task', 'return', 'workflow', 'sla', 'system'))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.queue_notification_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_html text;
BEGIN
  IF NOT public.should_send_notification_email(NEW.user_id, NEW.type) THEN
    RETURN NEW;
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = NEW.user_id;
  IF v_email IS NULL OR btrim(v_email) = '' THEN
    RETURN NEW;
  END IF;

  v_html := '<p><strong>' || replace(NEW.title, '<', '&lt;') || '</strong></p>'
    || CASE WHEN NEW.body IS NOT NULL AND btrim(NEW.body) <> '' THEN
         '<p>' || replace(NEW.body, '<', '&lt;') || '</p>' ELSE '' END;

  INSERT INTO public.email_outbox (
    notification_id, user_id, to_email, subject, body_text, body_html, app_link, status
  ) VALUES (
    NEW.id,
    NEW.user_id,
    v_email,
    NEW.title,
    COALESCE(NEW.body, ''),
    v_html,
    NEW.link,
    'pending'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_email_queue ON public.notifications;
CREATE TRIGGER trg_notifications_email_queue
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.queue_notification_email();

GRANT EXECUTE ON FUNCTION public.should_send_notification_email(uuid, text) TO authenticated, service_role;
