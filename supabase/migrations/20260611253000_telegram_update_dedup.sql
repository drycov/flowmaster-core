-- Deduplicate Telegram bot updates across webhook retries and parallel pollers

CREATE TABLE IF NOT EXISTS public.telegram_processed_updates (
  update_id bigint PRIMARY KEY,
  chat_id text,
  message_id bigint,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_processed_updates_at
  ON public.telegram_processed_updates(processed_at);

GRANT ALL ON public.telegram_processed_updates TO service_role;
