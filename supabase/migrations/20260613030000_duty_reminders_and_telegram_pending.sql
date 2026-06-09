-- Duty reminders log + Telegram pending actions for leave decisions with comment

CREATE TABLE IF NOT EXISTS public.duty_reminder_log (
  duty_assignment_id uuid NOT NULL REFERENCES public.duty_assignments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reminded_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (duty_assignment_id, user_id, reminded_on)
);

GRANT ALL ON public.duty_reminder_log TO service_role;

CREATE TABLE IF NOT EXISTS public.telegram_pending_actions (
  chat_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  message_id int,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_pending_actions_expires
  ON public.telegram_pending_actions(expires_at);

GRANT ALL ON public.telegram_pending_actions TO service_role;

NOTIFY pgrst, 'reload schema';
