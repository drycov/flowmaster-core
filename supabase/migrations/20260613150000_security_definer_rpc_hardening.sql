-- Lint 0029: SECURITY DEFINER functions in exposed public schema callable by API roles.
-- RLS helpers → private schema (not PostgREST-exposed) + public SECURITY INVOKER shims.
-- Server/worker RPCs → revoke PUBLIC/anon/authenticated, service_role only.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, service_role, authenticated;

DO $do$
DECLARE
  r record;
  rls_helpers text[] := ARRAY[
    'is_admin',
    'has_role',
    'can_view_document',
    'can_view_document_content',
    'can_manage_document_workflow',
    'user_has_permission',
    'tenant_matches',
    'current_organization_id',
    'effective_organization_id',
    'auth_user_organization_id',
    'user_organization_id',
    'document_access_level_order',
    'user_access_level_order',
    'user_can_access_document',
    'is_active_substitute_for',
    'can_act_on_workflow_task',
    'jwt_organization_id'
  ];
  argcall text;
  shim_sql text;
  volatility text;
BEGIN
  -- 1. Move RLS-oriented SECURITY DEFINER helpers out of exposed public schema.
  FOR r IN
    SELECT
      p.oid::regprocedure AS func,
      p.proname,
      p.pronargs,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosecdef
      AND p.proname = ANY(rls_helpers)
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET SCHEMA private', r.func);
  END LOOP;

  -- 2. Recreate thin public SECURITY INVOKER shims (RLS + internal callers keep working).
  FOR r IN
    SELECT
      p.proname,
      p.pronargs,
      p.provolatile,
      pg_get_function_identity_arguments(p.oid) AS args,
      pg_get_function_result(p.oid) AS result
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.prokind = 'f'
      AND p.proname = ANY(rls_helpers)
  LOOP
    SELECT string_agg('$' || i::text, ', ' ORDER BY i)
    INTO argcall
    FROM generate_series(1, r.pronargs) AS i;

    volatility := CASE r.provolatile
      WHEN 'i' THEN 'IMMUTABLE'
      WHEN 's' THEN 'STABLE'
      ELSE 'VOLATILE'
    END;

    shim_sql := format(
      'CREATE OR REPLACE FUNCTION public.%I(%s) RETURNS %s LANGUAGE sql %s SECURITY INVOKER SET search_path = public, private AS $shim$ SELECT private.%I(%s); $shim$',
      r.proname,
      r.args,
      r.result,
      volatility,
      r.proname,
      COALESCE(argcall, '')
    );
    EXECUTE shim_sql;

    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION private.%I(%s) FROM PUBLIC, anon',
      r.proname,
      r.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION private.%I(%s) TO authenticated, service_role',
      r.proname,
      r.args
    );

    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon',
      r.proname,
      r.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role',
      r.proname,
      r.args
    );
  END LOOP;

  -- 3. Remaining public SECURITY DEFINER routines are server/worker-only.
  FOR r IN
    SELECT p.oid::regprocedure AS func
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.func);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.func);
  END LOOP;
END $do$;

NOTIFY pgrst, 'reload schema';
