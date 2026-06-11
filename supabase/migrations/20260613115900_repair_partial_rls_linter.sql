-- Repair partial apply of 20260613120000 (policy exists but migration not in ledger).
-- Safe when 13120000 already completed: no-op.

DO $repair$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM supabase_migrations.schema_migrations
    WHERE version = '20260613120000_rls_performance_linter_fixes'
  ) THEN
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "profiles_select_merged" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_update_merged" ON public.profiles;
  DROP POLICY IF EXISTS "org_platform_insert" ON public.organization;
  DROP POLICY IF EXISTS "org_platform_delete" ON public.organization;
  DROP POLICY IF EXISTS "org_update_merged" ON public.organization;
  DROP POLICY IF EXISTS "unp_insert_own" ON public.user_notification_preferences;
  DROP POLICY IF EXISTS "unp_update_own" ON public.user_notification_preferences;
  DROP POLICY IF EXISTS "user_roles_manage_tenant_insert" ON public.user_roles;
  DROP POLICY IF EXISTS "user_roles_manage_tenant_update" ON public.user_roles;
  DROP POLICY IF EXISTS "user_roles_manage_tenant_delete" ON public.user_roles;
END $repair$;
