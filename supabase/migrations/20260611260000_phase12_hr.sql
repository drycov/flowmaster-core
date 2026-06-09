-- Phase 12: HR — absence types, leave requests, balances

-- =============================================================================
-- 1. Permission catalog
-- =============================================================================
INSERT INTO public.permissions (code, category, description_ru, description_kk)
VALUES ('manage_hr', 'hr', 'Кадровое администрирование', 'Кадрлық әкімшілеу')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_code)
SELECT r.id, 'manage_hr'
FROM public.roles r
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

-- Legacy role_definitions JSONB
UPDATE public.role_definitions
SET permissions = permissions || '{"manage_hr": true}'::jsonb
WHERE role = 'admin'
  AND COALESCE((permissions ->> 'manage_hr')::boolean, false) = false;

-- =============================================================================
-- 2. Absence types catalog
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ref_absence_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_kk text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  deducts_balance boolean NOT NULL DEFAULT true,
  requires_approval boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

GRANT SELECT ON public.ref_absence_types TO authenticated;
GRANT ALL ON public.ref_absence_types TO service_role;
ALTER TABLE public.ref_absence_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "absence_types_read" ON public.ref_absence_types;
CREATE POLICY "absence_types_read" ON public.ref_absence_types
  FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "absence_types_admin" ON public.ref_absence_types;
CREATE POLICY "absence_types_admin" ON public.ref_absence_types
  FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_hr')
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_hr')
  );

INSERT INTO public.ref_absence_types (code, name_ru, name_kk, color, deducts_balance, sort_order)
VALUES
  ('annual', 'Ежегодный отпуск', 'Жыл сайынғы демалыс', '#22c55e', true, 10),
  ('unpaid', 'Отпуск без сохранения зарплаты', 'Жалақысыз демалыс', '#94a3b8', false, 20),
  ('sick', 'Больничный', 'Ауру парағы', '#f59e0b', false, 30),
  ('business_trip', 'Командировка', 'Іссапар', '#3b82f6', false, 40),
  ('other', 'Другой вид отсутствия', 'Басқа түрдегі болмау', '#a855f7', false, 50)
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- 3. Leave requests
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  absence_type_id uuid NOT NULL REFERENCES public.ref_absence_types(id),
  date_from date NOT NULL,
  date_to date NOT NULL,
  business_days int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reason text NOT NULL DEFAULT '',
  approver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_note text,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leave_requests_dates_check CHECK (date_to >= date_from)
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON public.leave_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leave_requests_approver ON public.leave_requests(approver_id, status)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_leave_requests_period ON public.leave_requests(date_from, date_to);

GRANT SELECT, INSERT, UPDATE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_read" ON public.leave_requests;
CREATE POLICY "leave_read" ON public.leave_requests
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR approver_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_hr')
    OR public.user_has_permission(auth.uid(), 'manage_users')
  );

DROP POLICY IF EXISTS "leave_insert_self" ON public.leave_requests;
CREATE POLICY "leave_insert_self" ON public.leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "leave_update" ON public.leave_requests;
CREATE POLICY "leave_update" ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'pending')
    OR (approver_id = auth.uid() AND status = 'pending')
    OR public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_hr')
  )
  WITH CHECK (true);

-- =============================================================================
-- 4. Leave balances (annual entitlement)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year int NOT NULL,
  entitled_days int NOT NULL DEFAULT 24,
  used_days int NOT NULL DEFAULT 0,
  UNIQUE (user_id, year)
);

CREATE INDEX IF NOT EXISTS idx_leave_balances_user_year ON public.leave_balances(user_id, year DESC);

GRANT SELECT ON public.leave_balances TO authenticated;
GRANT ALL ON public.leave_balances TO service_role;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_balances_read" ON public.leave_balances;
CREATE POLICY "leave_balances_read" ON public.leave_balances
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_hr')
    OR public.user_has_permission(auth.uid(), 'manage_users')
  );

DROP POLICY IF EXISTS "leave_balances_admin" ON public.leave_balances;
CREATE POLICY "leave_balances_admin" ON public.leave_balances
  FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_hr')
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_hr')
  );

-- =============================================================================
-- 5. Helpers
-- =============================================================================
CREATE OR REPLACE FUNCTION public.count_business_days_between(_from date, _to date)
RETURNS int
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cursor date;
  v_count int := 0;
BEGIN
  IF _from IS NULL OR _to IS NULL OR _to < _from THEN
    RETURN 0;
  END IF;
  v_cursor := _from;
  WHILE v_cursor <= _to LOOP
    IF public.is_business_day(v_cursor) THEN
      v_count := v_count + 1;
    END IF;
    v_cursor := v_cursor + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_requests_set_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.business_days IS NULL OR NEW.business_days = 0 THEN
    NEW.business_days := public.count_business_days_between(NEW.date_from, NEW.date_to);
  END IF;
  IF NEW.approver_id IS NULL THEN
    NEW.approver_id := public.user_manager(NEW.user_id);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_requests_defaults ON public.leave_requests;
CREATE TRIGGER trg_leave_requests_defaults
  BEFORE INSERT OR UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.leave_requests_set_defaults();

CREATE OR REPLACE FUNCTION public.leave_requests_after_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int;
  v_deducts boolean;
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.status = 'pending'
    AND NEW.status = 'approved'
    AND NEW.business_days > 0
  THEN
    SELECT deducts_balance INTO v_deducts
    FROM public.ref_absence_types
    WHERE id = NEW.absence_type_id;

    IF COALESCE(v_deducts, false) THEN
      v_year := EXTRACT(YEAR FROM NEW.date_from)::int;
      INSERT INTO public.leave_balances (user_id, year, entitled_days, used_days)
      VALUES (NEW.user_id, v_year, 24, NEW.business_days)
      ON CONFLICT (user_id, year)
      DO UPDATE SET used_days = public.leave_balances.used_days + EXCLUDED.used_days;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_requests_after_decision ON public.leave_requests;
CREATE TRIGGER trg_leave_requests_after_decision
  AFTER UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.leave_requests_after_decision();

GRANT EXECUTE ON FUNCTION public.count_business_days_between(date, date) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
