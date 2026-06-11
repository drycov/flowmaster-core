-- Phase 1 (continued): HR/scheduling tenant columns, notifications scope,
-- RBAC canonical path, freeze legacy role_definitions writes, safer org fallback.

-- =============================================================================
-- 1. organization_id — notifications, duty_assignments, work_time_entries
-- =============================================================================

DO $do$
DECLARE
  v_org uuid;
BEGIN
  SELECT id INTO v_org FROM public.organization ORDER BY created_at LIMIT 1;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'organization row required';
  END IF;

  -- notifications
  IF to_regclass('public.notifications') IS NOT NULL THEN
    ALTER TABLE public.notifications
      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organization(id) ON DELETE RESTRICT;

    UPDATE public.notifications n
    SET organization_id = p.organization_id
    FROM public.profiles p
    WHERE n.user_id = p.id
      AND n.organization_id IS NULL
      AND p.organization_id IS NOT NULL;

    UPDATE public.notifications SET organization_id = v_org WHERE organization_id IS NULL;

    CREATE INDEX IF NOT EXISTS idx_notifications_organization_id
      ON public.notifications (organization_id);
  END IF;

  -- duty_assignments
  IF to_regclass('public.duty_assignments') IS NOT NULL THEN
    ALTER TABLE public.duty_assignments
      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organization(id) ON DELETE RESTRICT;

    UPDATE public.duty_assignments da
    SET organization_id = d.organization_id
    FROM public.departments d
    WHERE da.department_id = d.id
      AND da.organization_id IS NULL
      AND d.organization_id IS NOT NULL;

    UPDATE public.duty_assignments da
    SET organization_id = p.organization_id
    FROM public.profiles p
    WHERE da.assignee_id = p.id
      AND da.organization_id IS NULL
      AND p.organization_id IS NOT NULL;

    UPDATE public.duty_assignments SET organization_id = v_org WHERE organization_id IS NULL;

    CREATE INDEX IF NOT EXISTS idx_duty_assignments_organization_id
      ON public.duty_assignments (organization_id);

    DROP TRIGGER IF EXISTS trg_duty_assignments_set_org ON public.duty_assignments;
    CREATE TRIGGER trg_duty_assignments_set_org
      BEFORE INSERT ON public.duty_assignments
      FOR EACH ROW EXECUTE FUNCTION public.set_row_organization_id();
  END IF;

  -- work_time_entries
  IF to_regclass('public.work_time_entries') IS NOT NULL THEN
    ALTER TABLE public.work_time_entries
      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organization(id) ON DELETE RESTRICT;

    UPDATE public.work_time_entries w
    SET organization_id = p.organization_id
    FROM public.profiles p
    WHERE w.user_id = p.id
      AND w.organization_id IS NULL
      AND p.organization_id IS NOT NULL;

    UPDATE public.work_time_entries SET organization_id = v_org WHERE organization_id IS NULL;

    CREATE INDEX IF NOT EXISTS idx_work_time_entries_organization_id
      ON public.work_time_entries (organization_id);

    DROP TRIGGER IF EXISTS trg_work_time_entries_set_org ON public.work_time_entries;
    CREATE TRIGGER trg_work_time_entries_set_org
      BEFORE INSERT ON public.work_time_entries
      FOR EACH ROW EXECUTE FUNCTION public.set_row_organization_id();
  END IF;
END $do$;

CREATE OR REPLACE FUNCTION public.stamp_notification_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT p.organization_id INTO NEW.organization_id
    FROM public.profiles p
    WHERE p.id = NEW.user_id;
  END IF;
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.effective_organization_id();
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_notifications_stamp_org ON public.notifications;
CREATE TRIGGER trg_notifications_stamp_org
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.stamp_notification_organization();

-- =============================================================================
-- 2. RLS — tenant boundary on scheduling + notifications
-- =============================================================================

DROP POLICY IF EXISTS "duty_assignments_read" ON public.duty_assignments;
CREATE POLICY "duty_assignments_read" ON public.duty_assignments
  FOR SELECT TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (
      assignee_id = auth.uid()
      OR substitute_id = auth.uid()
      OR public.is_admin(auth.uid())
      OR public.user_has_permission(auth.uid(), 'manage_schedules')
      OR public.user_has_permission(auth.uid(), 'manage_hr')
    )
  );

DROP POLICY IF EXISTS "duty_assignments_write" ON public.duty_assignments;
CREATE POLICY "duty_assignments_write" ON public.duty_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tenant_matches(organization_id)
    AND (
      public.is_admin(auth.uid())
      OR public.user_has_permission(auth.uid(), 'manage_schedules')
      OR public.user_has_permission(auth.uid(), 'manage_hr')
    )
  );

DROP POLICY IF EXISTS "duty_assignments_update" ON public.duty_assignments;
CREATE POLICY "duty_assignments_update" ON public.duty_assignments
  FOR UPDATE TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (
      public.is_admin(auth.uid())
      OR public.user_has_permission(auth.uid(), 'manage_schedules')
      OR public.user_has_permission(auth.uid(), 'manage_hr')
      OR assignee_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "work_time_read" ON public.work_time_entries;
CREATE POLICY "work_time_read" ON public.work_time_entries
  FOR SELECT TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (
      user_id = auth.uid()
      OR approver_id = auth.uid()
      OR public.is_admin(auth.uid())
      OR public.user_has_permission(auth.uid(), 'manage_schedules')
      OR public.user_has_permission(auth.uid(), 'manage_hr')
    )
  );

DROP POLICY IF EXISTS "work_time_insert" ON public.work_time_entries;
CREATE POLICY "work_time_insert" ON public.work_time_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tenant_matches(organization_id)
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "work_time_update" ON public.work_time_entries;
CREATE POLICY "work_time_update" ON public.work_time_entries
  FOR UPDATE TO authenticated
  USING (
    public.tenant_matches(organization_id)
    AND (
      (user_id = auth.uid() AND status IN ('draft', 'submitted'))
      OR approver_id = auth.uid()
      OR public.is_admin(auth.uid())
      OR public.user_has_permission(auth.uid(), 'manage_schedules')
    )
  );

DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND public.tenant_matches(organization_id)
  );

DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND public.tenant_matches(organization_id)
  );

DROP POLICY IF EXISTS "schedule_plans_read" ON public.schedule_plans;
CREATE POLICY "schedule_plans_read" ON public.schedule_plans
  FOR SELECT TO authenticated
  USING (public.tenant_matches(organization_id));

DROP POLICY IF EXISTS "schedule_items_read" ON public.schedule_plan_items;
CREATE POLICY "schedule_items_read" ON public.schedule_plan_items
  FOR SELECT TO authenticated
  USING (public.tenant_matches(organization_id));

-- =============================================================================
-- 3. RBAC — backfill grants, sync permissions, canonical user_has_permission
-- =============================================================================

INSERT INTO public.user_role_grants (user_id, role_id)
SELECT ur.user_id, r.id
FROM public.user_roles ur
JOIN public.roles r ON r.code = ur.role::text
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_role_grants g
  WHERE g.user_id = ur.user_id
    AND g.role_id = r.id
    AND g.revoked_at IS NULL
);

INSERT INTO public.role_permissions (role_id, permission_code)
SELECT r.id, perm.key
FROM public.role_definitions rd
JOIN public.roles r ON r.code = rd.role::text
JOIN LATERAL jsonb_each_text(rd.permissions) AS perm(key, value) ON true
JOIN public.permissions p ON p.code = perm.key
WHERE perm.value::boolean = true
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION private.user_has_permission(_user uuid, _permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  has_it boolean;
BEGIN
  -- Canonical path: user_role_grants → roles → role_permissions
  SELECT EXISTS (
    WITH RECURSIVE granted AS (
      SELECT r.id
      FROM public.user_role_grants g
      JOIN public.roles r ON r.id = g.role_id AND r.is_active
      WHERE g.user_id = _user
        AND g.revoked_at IS NULL
        AND (g.expires_at IS NULL OR g.expires_at > now())
      UNION
      SELECT r2.id
      FROM public.roles r2
      JOIN granted g2 ON r2.id = (
        SELECT parent_role_id FROM public.roles WHERE id = g2.id
      )
      WHERE r2.is_active
    )
    SELECT 1
    FROM granted g
    JOIN public.role_permissions rp ON rp.role_id = g.id
    WHERE rp.permission_code = _permission
  ) INTO has_it;
  IF has_it THEN
    RETURN true;
  END IF;

  -- Legacy fallback (read-only JSONB mirror; removed in Phase 2)
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_definitions rd ON rd.role = ur.role
    WHERE ur.user_id = _user
      AND COALESCE((rd.permissions ->> _permission)::boolean, false) = true
  ) INTO has_it;

  RETURN has_it;
END;
$fn$;

DROP POLICY IF EXISTS "roledef admin write" ON public.role_definitions;
REVOKE INSERT, UPDATE, DELETE ON public.role_definitions FROM authenticated;

-- =============================================================================
-- 4. Safer current_organization_id fallback (no arbitrary first org in multi-org)
-- =============================================================================

CREATE OR REPLACE FUNCTION private.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN (SELECT count(*)::int FROM public.organization) <= 1 THEN (
      SELECT o.id FROM public.organization o ORDER BY o.created_at LIMIT 1
    )
    ELSE NULL::uuid
  END;
$$;

NOTIFY pgrst, 'reload schema';
