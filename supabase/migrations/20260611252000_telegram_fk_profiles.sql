-- App auth uses public.profiles(id), not auth.users. Repoint Telegram/notification FKs.

DO $$
DECLARE
  r RECORD;
  on_delete TEXT;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass AS tbl, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND c.confrelid = 'auth.users'::regclass
      AND c.conrelid::regclass::text IN (
        'public.telegram_link_tokens',
        'public.telegram_outbox',
        'public.telegram_auth_tokens',
        'public.user_notification_preferences',
        'public.email_outbox'
      )
  LOOP
    on_delete := CASE
      WHEN r.def LIKE '%ON DELETE CASCADE%' THEN 'CASCADE'
      WHEN r.def LIKE '%ON DELETE SET NULL%' THEN 'SET NULL'
      ELSE 'NO ACTION'
    END;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE %s',
      r.tbl, r.conname, on_delete
    );
  END LOOP;
END $$;
