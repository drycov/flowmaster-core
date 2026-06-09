-- Repoint Telegram tables to public.profiles(id) (app-owned auth).
-- Previous migration 52000 missed tables due to regclass::text schema mismatch.

ALTER TABLE public.telegram_link_tokens
  DROP CONSTRAINT IF EXISTS telegram_link_tokens_user_id_fkey;

ALTER TABLE public.telegram_link_tokens
  ADD CONSTRAINT telegram_link_tokens_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.telegram_outbox
  DROP CONSTRAINT IF EXISTS telegram_outbox_user_id_fkey;

ALTER TABLE public.telegram_outbox
  ADD CONSTRAINT telegram_outbox_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.telegram_auth_tokens
  DROP CONSTRAINT IF EXISTS telegram_auth_tokens_user_id_fkey;

ALTER TABLE public.telegram_auth_tokens
  ADD CONSTRAINT telegram_auth_tokens_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.user_notification_preferences
  DROP CONSTRAINT IF EXISTS user_notification_preferences_user_id_fkey;

ALTER TABLE public.user_notification_preferences
  ADD CONSTRAINT user_notification_preferences_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.email_outbox
  DROP CONSTRAINT IF EXISTS email_outbox_user_id_fkey;

ALTER TABLE public.email_outbox
  ADD CONSTRAINT email_outbox_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
