-- Service-only tables: explicit RLS deny policies for API roles.
-- Access is via service_role (server workers); authenticated/anon must not read or write.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'app_sessions',
    'auth_challenges',
    'duty_reminder_log',
    'license_server_activations',
    'license_server_keys',
    'telegram_auth_tokens',
    'telegram_pending_actions',
    'telegram_processed_updates'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated, anon', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_service_only', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated, anon USING (false) WITH CHECK (false)',
      t || '_service_only',
      t
    );
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
