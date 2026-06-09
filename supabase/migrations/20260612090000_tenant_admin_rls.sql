-- Tenant-scoped admin RLS for profiles, user_roles, organization, departments

-- profiles: admin access limited to same tenant (platform ops see all)
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;

CREATE POLICY "profiles_select_tenant"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (
      public.user_has_permission(auth.uid(), 'manage_users')
      AND (
        public.user_has_permission(auth.uid(), 'manage_platform')
        OR public.tenant_matches(organization_id)
      )
    )
  );

CREATE POLICY "profiles_update_tenant"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR (
      public.user_has_permission(auth.uid(), 'manage_users')
      AND (
        public.user_has_permission(auth.uid(), 'manage_platform')
        OR public.tenant_matches(organization_id)
      )
    )
  )
  WITH CHECK (
    id = auth.uid()
    OR (
      public.user_has_permission(auth.uid(), 'manage_users')
      AND (
        public.user_has_permission(auth.uid(), 'manage_platform')
        OR public.tenant_matches(organization_id)
      )
    )
  );

CREATE POLICY "profiles_delete_tenant"
  ON public.profiles FOR DELETE TO authenticated
  USING (
    public.user_has_permission(auth.uid(), 'manage_users')
    AND (
      public.user_has_permission(auth.uid(), 'manage_platform')
      OR public.tenant_matches(organization_id)
    )
  );

-- user_roles: scoped via target profile organization
DROP POLICY IF EXISTS "user_roles_select_own_or_admin" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_manage" ON public.user_roles;

CREATE POLICY "user_roles_select_tenant"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      public.user_has_permission(auth.uid(), 'manage_users')
      AND (
        public.user_has_permission(auth.uid(), 'manage_platform')
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = user_roles.user_id
            AND public.tenant_matches(p.organization_id)
        )
      )
    )
  );

CREATE POLICY "user_roles_manage_tenant"
  ON public.user_roles FOR ALL TO authenticated
  USING (
    public.user_has_permission(auth.uid(), 'manage_users')
    AND (
      public.user_has_permission(auth.uid(), 'manage_platform')
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = user_roles.user_id
          AND public.tenant_matches(p.organization_id)
      )
    )
  )
  WITH CHECK (
    public.user_has_permission(auth.uid(), 'manage_users')
    AND (
      public.user_has_permission(auth.uid(), 'manage_platform')
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = user_roles.user_id
          AND public.tenant_matches(p.organization_id)
      )
    )
  );

-- organization: tenant admins update own org; platform admins manage all
DROP POLICY IF EXISTS "org admin write" ON public.organization;

CREATE POLICY "org_platform_manage"
  ON public.organization FOR ALL TO authenticated
  USING (public.user_has_permission(auth.uid(), 'manage_platform'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_platform'));

CREATE POLICY "org_tenant_update"
  ON public.organization FOR UPDATE TO authenticated
  USING (
    public.user_has_permission(auth.uid(), 'manage_org')
    AND public.tenant_matches(id)
  )
  WITH CHECK (
    public.user_has_permission(auth.uid(), 'manage_org')
    AND public.tenant_matches(id)
  );

-- departments: org admins (departments are deployment-scoped until org_id column exists)
DROP POLICY IF EXISTS "departments_admin_manage" ON public.departments;

CREATE POLICY "departments_admin_manage"
  ON public.departments FOR ALL TO authenticated
  USING (
    public.user_has_permission(auth.uid(), 'manage_org')
    OR public.user_has_permission(auth.uid(), 'manage_platform')
  )
  WITH CHECK (
    public.user_has_permission(auth.uid(), 'manage_org')
    OR public.user_has_permission(auth.uid(), 'manage_platform')
  );

NOTIFY pgrst, 'reload schema';
