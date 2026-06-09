-- SECURITY DEFINER RPC hardening: authenticated must not call public definer functions
-- via PostgREST. Server uses service_role; RLS policy evaluation uses table-owner rights.

DO $do$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS func
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.func);
  END LOOP;
END $do$;

NOTIFY pgrst, 'reload schema';
