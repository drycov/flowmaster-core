-- Phase 13: duty schedules, work time tracking, Gantt plans

INSERT INTO public.permissions (code, category, description_ru, description_kk)
VALUES ('manage_schedules', 'hr', 'Управление графиками и табелями', 'Кестелер мен табельдерді басқару')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_code)
SELECT r.id, 'manage_schedules'
FROM public.roles r
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

UPDATE public.role_definitions
SET permissions = permissions || '{"manage_schedules": true}'::jsonb
WHERE role = 'admin'
  AND COALESCE((permissions ->> 'manage_schedules')::boolean, false) = false;

-- =============================================================================
-- 1. Duty roles & assignments
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ref_duty_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_kk text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.duty_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duty_role_id uuid NOT NULL REFERENCES public.ref_duty_roles(id),
  assignee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')),
  substitute_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT duty_assignments_range CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_duty_assignments_period
  ON public.duty_assignments(assignee_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_duty_assignments_range
  ON public.duty_assignments(starts_at, ends_at);

-- =============================================================================
-- 2. Work time entries (timesheet)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.work_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  duration_minutes int NOT NULL DEFAULT 0
    CHECK (duration_minutes >= 0 AND duration_minutes <= 1440),
  entry_type text NOT NULL DEFAULT 'work'
    CHECK (entry_type IN ('work', 'overtime', 'break', 'remote', 'business_trip')),
  project_id uuid REFERENCES public.document_projects(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  approver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_time_entries_range CHECK (
    started_at IS NULL OR ended_at IS NULL OR ended_at > started_at
  )
);

CREATE INDEX IF NOT EXISTS idx_work_time_user_date
  ON public.work_time_entries(user_id, work_date DESC);

-- =============================================================================
-- 3. Gantt schedule plans
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.schedule_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_kk text NOT NULL,
  plan_type text NOT NULL DEFAULT 'project'
    CHECK (plan_type IN ('project', 'department', 'general')),
  project_id uuid REFERENCES public.document_projects(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  planned_start date,
  planned_end date,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schedule_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.schedule_plans(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.schedule_plan_items(id) ON DELETE SET NULL,
  code text NOT NULL DEFAULT '',
  title_ru text NOT NULL,
  title_kk text NOT NULL,
  item_type text NOT NULL DEFAULT 'task'
    CHECK (item_type IN ('milestone', 'task', 'phase')),
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  planned_start date NOT NULL,
  planned_end date NOT NULL,
  progress_pct smallint NOT NULL DEFAULT 0
    CHECK (progress_pct BETWEEN 0 AND 100),
  color text NOT NULL DEFAULT '#3b82f6',
  depends_on_id uuid REFERENCES public.schedule_plan_items(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'blocked', 'done', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_plan_items_dates CHECK (planned_end >= planned_start)
);

CREATE INDEX IF NOT EXISTS idx_schedule_items_plan
  ON public.schedule_plan_items(plan_id, planned_start, planned_end);

-- =============================================================================
-- 4. Grants & RLS
-- =============================================================================
GRANT SELECT ON public.ref_duty_roles TO authenticated;
GRANT ALL ON public.ref_duty_roles TO service_role;
ALTER TABLE public.ref_duty_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "duty_roles_read" ON public.ref_duty_roles FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "duty_roles_admin" ON public.ref_duty_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.user_has_permission(auth.uid(), 'manage_schedules'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.user_has_permission(auth.uid(), 'manage_schedules'));

GRANT SELECT, INSERT, UPDATE ON public.duty_assignments TO authenticated;
GRANT ALL ON public.duty_assignments TO service_role;
ALTER TABLE public.duty_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "duty_assignments_read" ON public.duty_assignments FOR SELECT TO authenticated
  USING (
    assignee_id = auth.uid()
    OR substitute_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_schedules')
    OR public.user_has_permission(auth.uid(), 'manage_hr')
  );
CREATE POLICY "duty_assignments_write" ON public.duty_assignments FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_schedules')
    OR public.user_has_permission(auth.uid(), 'manage_hr')
  );
CREATE POLICY "duty_assignments_update" ON public.duty_assignments FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_schedules')
    OR public.user_has_permission(auth.uid(), 'manage_hr')
    OR assignee_id = auth.uid()
  );

GRANT SELECT, INSERT, UPDATE ON public.work_time_entries TO authenticated;
GRANT ALL ON public.work_time_entries TO service_role;
ALTER TABLE public.work_time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "work_time_read" ON public.work_time_entries FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR approver_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_schedules')
    OR public.user_has_permission(auth.uid(), 'manage_hr')
  );
CREATE POLICY "work_time_insert" ON public.work_time_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "work_time_update" ON public.work_time_entries FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND status IN ('draft', 'submitted'))
    OR approver_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_schedules')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_plans TO authenticated;
GRANT ALL ON public.schedule_plans TO service_role;
ALTER TABLE public.schedule_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule_plans_read" ON public.schedule_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "schedule_plans_write" ON public.schedule_plans FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_schedules')
    OR public.user_has_permission(auth.uid(), 'manage_projects')
    OR owner_id = auth.uid()
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_schedules')
    OR public.user_has_permission(auth.uid(), 'manage_projects')
    OR owner_id = auth.uid()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_plan_items TO authenticated;
GRANT ALL ON public.schedule_plan_items TO service_role;
ALTER TABLE public.schedule_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule_items_read" ON public.schedule_plan_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "schedule_items_write" ON public.schedule_plan_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.schedule_plans p
      WHERE p.id = schedule_plan_items.plan_id
        AND (
          public.is_admin(auth.uid())
          OR public.user_has_permission(auth.uid(), 'manage_schedules')
          OR public.user_has_permission(auth.uid(), 'manage_projects')
          OR p.owner_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.schedule_plans p
      WHERE p.id = schedule_plan_items.plan_id
        AND (
          public.is_admin(auth.uid())
          OR public.user_has_permission(auth.uid(), 'manage_schedules')
          OR public.user_has_permission(auth.uid(), 'manage_projects')
          OR p.owner_id = auth.uid()
        )
    )
  );

-- Seeds
INSERT INTO public.ref_duty_roles (code, name_ru, name_kk, color, sort_order)
VALUES
  ('on_call', 'Дежурный по организации', 'Ұйым бойынша кезекші', '#ef4444', 10),
  ('reception', 'Дежурный на ресепшене', 'Қабылдау кезекшісі', '#3b82f6', 20),
  ('security', 'Дежурный охраны', 'Күзет кезекшісі', '#f59e0b', 30)
ON CONFLICT (code) DO NOTHING;

NOTIFY pgrst, 'reload schema';
