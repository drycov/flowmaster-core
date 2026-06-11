-- Supabase database linter: auth_rls_initplan + multiple_permissive_policies
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- =============================================================================
-- 1. Wrap auth.*() / current_setting() for single evaluation per query (initplan)
-- =============================================================================

CREATE OR REPLACE FUNCTION public._rls_wrap_auth_calls(_expr text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result text := _expr;
  func text;
  auth_funcs text[] := ARRAY['uid', 'jwt', 'role', 'email', 'phone'];
BEGIN
  IF result IS NULL THEN
    RETURN NULL;
  END IF;

  FOREACH func IN ARRAY auth_funcs
  LOOP
    result := replace(result, '(select auth.' || func || '())', '__AUTH_' || upper(func) || '_WRAPPED__');
    result := replace(result, 'auth.' || func || '()', '(select auth.' || func || '())');
    result := replace(result, '__AUTH_' || upper(func) || '_WRAPPED__', '(select auth.' || func || '())');
  END LOOP;

  result := replace(result, '(select current_setting(', '__CURRENT_SETTING_WRAPPED__(');
  result := replace(result, 'current_setting(', '(select current_setting(');
  result := replace(result, '__CURRENT_SETTING_WRAPPED__(', '(select current_setting(');

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public._rls_policy_roles_clause(_polroles oid[])
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(string_agg(quote_ident(r.rolname), ', '), 'PUBLIC')
  FROM pg_roles r
  WHERE r.oid = ANY(_polroles);
$$;

CREATE OR REPLACE FUNCTION public._rls_roles_overlap(_a oid[], _b oid[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _a && _b;
$$;

-- =============================================================================
-- 2. Explicit merges / splits (before automated FOR ALL handling)
-- =============================================================================

-- profiles: one SELECT, one UPDATE
DROP POLICY IF EXISTS "profiles_select_directory" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_tenant" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_merged" ON public.profiles;
CREATE POLICY "profiles_select_merged" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = (select auth.uid())
    OR (
      public.user_has_permission((select auth.uid()), 'manage_users')
      AND (
        public.user_has_permission((select auth.uid()), 'manage_platform')
        OR public.tenant_matches(organization_id)
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE public.can_view_document(d.id, (select auth.uid()))
        AND (d.created_by = profiles.id OR d.assigned_to = profiles.id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.workflow_tasks t
      WHERE t.assignee_id = profiles.id
        AND public.can_view_document(t.document_id, (select auth.uid()))
    )
    OR EXISTS (
      SELECT 1
      FROM public.workflow_tasks t_me
      JOIN public.workflow_tasks t_peer ON t_me.document_id = t_peer.document_id
      WHERE t_me.assignee_id = (select auth.uid())
        AND t_peer.assignee_id = profiles.id
    )
  );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_tenant" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_merged" ON public.profiles;
CREATE POLICY "profiles_update_merged" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = (select auth.uid())
    OR (
      public.user_has_permission((select auth.uid()), 'manage_users')
      AND (
        public.user_has_permission((select auth.uid()), 'manage_platform')
        OR public.tenant_matches(organization_id)
      )
    )
  )
  WITH CHECK (
    id = (select auth.uid())
    OR (
      public.user_has_permission((select auth.uid()), 'manage_users')
      AND (
        public.user_has_permission((select auth.uid()), 'manage_platform')
        OR public.tenant_matches(organization_id)
      )
    )
  );

-- organization: single UPDATE; platform INSERT/DELETE (SELECT stays "org read all auth")
DROP POLICY IF EXISTS "org_platform_manage" ON public.organization;
DROP POLICY IF EXISTS "org_tenant_update" ON public.organization;
DROP POLICY IF EXISTS "org_platform_insert" ON public.organization;
DROP POLICY IF EXISTS "org_platform_delete" ON public.organization;
DROP POLICY IF EXISTS "org_update_merged" ON public.organization;

CREATE POLICY "org_platform_insert" ON public.organization
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_permission((select auth.uid()), 'manage_platform'));

CREATE POLICY "org_platform_delete" ON public.organization
  FOR DELETE TO authenticated
  USING (public.user_has_permission((select auth.uid()), 'manage_platform'));

CREATE POLICY "org_update_merged" ON public.organization
  FOR UPDATE TO authenticated
  USING (
    public.user_has_permission((select auth.uid()), 'manage_platform')
    OR (
      public.user_has_permission((select auth.uid()), 'manage_org')
      AND public.tenant_matches(id)
    )
  )
  WITH CHECK (
    public.user_has_permission((select auth.uid()), 'manage_platform')
    OR (
      public.user_has_permission((select auth.uid()), 'manage_org')
      AND public.tenant_matches(id)
    )
  );

-- user_notification_preferences: split upsert away from SELECT
DROP POLICY IF EXISTS "unp_upsert_own" ON public.user_notification_preferences;
DROP POLICY IF EXISTS "unp_insert_own" ON public.user_notification_preferences;
DROP POLICY IF EXISTS "unp_update_own" ON public.user_notification_preferences;
CREATE POLICY "unp_insert_own" ON public.user_notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "unp_update_own" ON public.user_notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- user_roles: split manage away from SELECT
DROP POLICY IF EXISTS "user_roles_manage_tenant" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_manage_tenant_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_manage_tenant_update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_manage_tenant_delete" ON public.user_roles;
CREATE POLICY "user_roles_manage_tenant_insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_permission((select auth.uid()), 'manage_users')
    AND (
      public.user_has_permission((select auth.uid()), 'manage_platform')
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = user_roles.user_id
          AND public.tenant_matches(p.organization_id)
      )
    )
  );
CREATE POLICY "user_roles_manage_tenant_update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (
    public.user_has_permission((select auth.uid()), 'manage_users')
    AND (
      public.user_has_permission((select auth.uid()), 'manage_platform')
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = user_roles.user_id
          AND public.tenant_matches(p.organization_id)
      )
    )
  )
  WITH CHECK (
    public.user_has_permission((select auth.uid()), 'manage_users')
    AND (
      public.user_has_permission((select auth.uid()), 'manage_platform')
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = user_roles.user_id
          AND public.tenant_matches(p.organization_id)
      )
    )
  );
CREATE POLICY "user_roles_manage_tenant_delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    public.user_has_permission((select auth.uid()), 'manage_users')
    AND (
      public.user_has_permission((select auth.uid()), 'manage_platform')
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = user_roles.user_id
          AND public.tenant_matches(p.organization_id)
      )
    )
  );

-- =============================================================================
-- 3. Split remaining FOR ALL policies that overlap dedicated SELECT/UPDATE
-- =============================================================================

DO $split_all$
DECLARE
  pol record;
  roles text;
  qual text;
  with_check text;
  skip_cmds text[];
  cmd text;
  suffix text;
  new_name text;
BEGIN
  FOR pol IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      p.polname AS policy_name,
      p.polrelid,
      p.polroles,
      p.polpermissive,
      pg_get_expr(p.polqual, p.polrelid) AS qual,
      pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND p.polcmd = '*'
      AND p.polpermissive
  LOOP
    skip_cmds := ARRAY[]::text[];

    IF EXISTS (
      SELECT 1
      FROM pg_policy p2
      WHERE p2.polrelid = pol.polrelid
        AND p2.polname <> pol.policy_name
        AND p2.polpermissive
        AND p2.polcmd = 'r'
        AND public._rls_roles_overlap(p2.polroles, pol.polroles)
    ) THEN
      skip_cmds := skip_cmds || 'SELECT';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_policy p2
      WHERE p2.polrelid = pol.polrelid
        AND p2.polname <> pol.policy_name
        AND p2.polpermissive
        AND p2.polcmd = 'w'
        AND public._rls_roles_overlap(p2.polroles, pol.polroles)
    ) THEN
      skip_cmds := skip_cmds || 'UPDATE';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_policy p2
      WHERE p2.polrelid = pol.polrelid
        AND p2.polname <> pol.policy_name
        AND p2.polpermissive
        AND p2.polcmd = 'a'
        AND public._rls_roles_overlap(p2.polroles, pol.polroles)
    ) THEN
      skip_cmds := skip_cmds || 'INSERT';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_policy p2
      WHERE p2.polrelid = pol.polrelid
        AND p2.polname <> pol.policy_name
        AND p2.polpermissive
        AND p2.polcmd = 'd'
        AND public._rls_roles_overlap(p2.polroles, pol.polroles)
    ) THEN
      skip_cmds := skip_cmds || 'DELETE';
    END IF;

    IF cardinality(skip_cmds) = 0 THEN
      CONTINUE;
    END IF;

    roles := public._rls_policy_roles_clause(pol.polroles);
    qual := pol.qual;
    with_check := COALESCE(pol.with_check, pol.qual);

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policy_name,
      pol.schema_name,
      pol.table_name
    );

    FOREACH cmd IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'SELECT']
    LOOP
      IF cmd = ANY(skip_cmds) THEN
        CONTINUE;
      END IF;

      suffix := lower(cmd);
      new_name := pol.policy_name || '_' || suffix;

      IF cmd IN ('SELECT', 'UPDATE', 'DELETE') AND qual IS NULL THEN
        CONTINUE;
      END IF;

      IF cmd = 'INSERT' AND with_check IS NULL THEN
        CONTINUE;
      END IF;

      EXECUTE format(
        'CREATE POLICY %I ON %I.%I AS PERMISSIVE FOR %s TO %s%s%s',
        new_name,
        pol.schema_name,
        pol.table_name,
        cmd,
        roles,
        CASE
          WHEN cmd IN ('SELECT', 'UPDATE', 'DELETE') AND qual IS NOT NULL
            THEN format(' USING (%s)', qual)
          ELSE ''
        END,
        CASE
          WHEN cmd IN ('INSERT', 'UPDATE') AND with_check IS NOT NULL
            THEN format(' WITH CHECK (%s)', with_check)
          ELSE ''
        END
      );
    END LOOP;
  END LOOP;
END $split_all$;

-- =============================================================================
-- 4. Re-apply initplan-friendly auth wrappers on every public/realtime policy
-- =============================================================================

DO $wrap_auth$
DECLARE
  pol record;
  roles text;
  cmd text;
  qual text;
  with_check text;
  permissive text;
  ddl text;
BEGIN
  FOR pol IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      p.polname AS policy_name,
      p.polrelid,
      p.polroles,
      p.polcmd,
      p.polpermissive,
      pg_get_expr(p.polqual, p.polrelid) AS qual,
      pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'realtime')
  LOOP
    qual := public._rls_wrap_auth_calls(pol.qual);
    with_check := public._rls_wrap_auth_calls(pol.with_check);

    IF qual IS NOT DISTINCT FROM pol.qual
       AND with_check IS NOT DISTINCT FROM pol.with_check THEN
      CONTINUE;
    END IF;

    roles := public._rls_policy_roles_clause(pol.polroles);
    cmd := CASE pol.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      WHEN '*' THEN 'ALL'
    END;
    permissive := CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END;

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policy_name,
      pol.schema_name,
      pol.table_name
    );

    ddl := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      pol.policy_name,
      pol.schema_name,
      pol.table_name,
      permissive,
      cmd,
      roles
    );

    IF cmd IN ('SELECT', 'UPDATE', 'DELETE', 'ALL') AND qual IS NOT NULL THEN
      ddl := ddl || format(' USING (%s)', qual);
    END IF;

    IF cmd IN ('INSERT', 'UPDATE', 'ALL') AND with_check IS NOT NULL THEN
      ddl := ddl || format(' WITH CHECK (%s)', with_check);
    END IF;

    EXECUTE ddl;
  END LOOP;
END $wrap_auth$;

-- =============================================================================
-- 5. Reference catalog helper — avoid future FOR ALL + SELECT overlap
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ref_catalog_policies(_table text, _permission text DEFAULT 'manage_references')
RETURNS void LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', _table);

  EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', _table, _table);
  EXECUTE format(
    'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (true)',
    _table, _table
  );

  EXECUTE format('DROP POLICY IF EXISTS %I_manage ON public.%I', _table, _table);
  EXECUTE format('DROP POLICY IF EXISTS %I_manage_insert ON public.%I', _table, _table);
  EXECUTE format('DROP POLICY IF EXISTS %I_manage_update ON public.%I', _table, _table);
  EXECUTE format('DROP POLICY IF EXISTS %I_manage_delete ON public.%I', _table, _table);

  EXECUTE format(
    'CREATE POLICY %I_manage_insert ON public.%I FOR INSERT TO authenticated
       WITH CHECK (public.user_has_permission((select auth.uid()), %L))',
    _table, _table, _permission
  );
  EXECUTE format(
    'CREATE POLICY %I_manage_update ON public.%I FOR UPDATE TO authenticated
       USING (public.user_has_permission((select auth.uid()), %L))
       WITH CHECK (public.user_has_permission((select auth.uid()), %L))',
    _table, _table, _permission, _permission
  );
  EXECUTE format(
    'CREATE POLICY %I_manage_delete ON public.%I FOR DELETE TO authenticated
       USING (public.user_has_permission((select auth.uid()), %L))',
    _table, _table, _permission
  );
END;
$$;

-- Re-apply to existing reference tables (splits legacy FOR ALL manage policies)
DO $ref_tables$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ref_document_types',
    'ref_template_categories',
    'ref_correspondents',
    'ref_delivery_methods',
    'ref_access_levels',
    'ref_priorities',
    'ref_retention_periods',
    'ref_registration_journals',
    'ref_archive_locations',
    'ref_department_kinds',
    'ref_rejection_reasons',
    'ref_document_link_types'
  ]
  LOOP
    PERFORM public.ref_catalog_policies(t);
  END LOOP;
END $ref_tables$;

-- =============================================================================
-- 6. Cleanup internal helpers
-- =============================================================================

DROP FUNCTION IF EXISTS public._rls_wrap_auth_calls(text);
DROP FUNCTION IF EXISTS public._rls_policy_roles_clause(oid[]);
DROP FUNCTION IF EXISTS public._rls_roles_overlap(oid[], oid[]);

NOTIFY pgrst, 'reload schema';
