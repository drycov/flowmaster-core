-- Phase 10: business calendar, saved searches, business-day SLA

-- =============================================================================
-- 1. Business calendar (KZ holidays + overrides)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.business_calendar_days (
  day_date date PRIMARY KEY,
  is_holiday boolean NOT NULL DEFAULT true,
  name_ru text NOT NULL DEFAULT '',
  name_kk text NOT NULL DEFAULT ''
);

GRANT SELECT ON public.business_calendar_days TO authenticated;
GRANT ALL ON public.business_calendar_days TO service_role;
ALTER TABLE public.business_calendar_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bizcal_read" ON public.business_calendar_days;
CREATE POLICY "bizcal_read" ON public.business_calendar_days
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "bizcal_admin" ON public.business_calendar_days;
CREATE POLICY "bizcal_admin" ON public.business_calendar_days
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.user_has_permission(auth.uid(), 'manage_org'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.user_has_permission(auth.uid(), 'manage_org'));

CREATE OR REPLACE FUNCTION public.is_business_day(_d date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.business_calendar_days b
      WHERE b.day_date = _d AND b.is_holiday = false
    ) THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.business_calendar_days b
      WHERE b.day_date = _d AND b.is_holiday = true
    ) THEN false
    ELSE EXTRACT(DOW FROM _d) NOT IN (0, 6)
  END;
$$;

CREATE OR REPLACE FUNCTION public.add_business_days_ts(_start timestamptz, _days int)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days int := GREATEST(COALESCE(_days, 0), 0);
  v_cursor date := (_start AT TIME ZONE 'Asia/Almaty')::date;
  v_added int := 0;
  v_result timestamptz;
BEGIN
  IF v_days = 0 THEN
    RETURN _start;
  END IF;

  WHILE v_added < v_days LOOP
    v_cursor := v_cursor + 1;
    IF public.is_business_day(v_cursor) THEN
      v_added := v_added + 1;
    END IF;
  END LOOP;

  v_result := (v_cursor::text || ' 18:00:00')::timestamp AT TIME ZONE 'Asia/Almaty';
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_business_day(date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_business_days_ts(timestamptz, int) TO authenticated, service_role;

-- Seed common KZ holidays 2026 (idempotent)
INSERT INTO public.business_calendar_days (day_date, is_holiday, name_ru, name_kk) VALUES
  ('2026-01-01', true, 'Новый год', 'Жаңа жыл'),
  ('2026-01-02', true, 'Новый год', 'Жаңа жыл'),
  ('2026-01-07', true, 'Рождество (правосл.)', 'Рождество'),
  ('2026-03-08', true, 'Международный женский день', 'Халықаралық әйелдер күні'),
  ('2026-03-21', true, 'Наурыз', 'Наурыз'),
  ('2026-03-22', true, 'Наурыз', 'Наурыз'),
  ('2026-03-23', true, 'Наурыз', 'Наурыз'),
  ('2026-05-01', true, 'Праздник единства народа', 'Бірліктің мерекесі'),
  ('2026-05-07', true, 'День защитника Отечества', 'Отан қорғаушы күні'),
  ('2026-05-09', true, 'День Победы', 'Жеңіс күні'),
  ('2026-07-06', true, 'День столицы', 'Астана күні'),
  ('2026-08-30', true, 'День Конституции', 'Конституция күні'),
  ('2026-10-25', true, 'День Республики', 'Республика күні'),
  ('2026-12-16', true, 'День Независимости', 'Тәуелсіздік күні')
ON CONFLICT (day_date) DO NOTHING;

-- =============================================================================
-- 2. Saved searches
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  query jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON public.saved_searches (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;
GRANT ALL ON public.saved_searches TO service_role;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_saved_searches_updated ON public.saved_searches;
CREATE TRIGGER trg_saved_searches_updated
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "saved_search_own" ON public.saved_searches;
CREATE POLICY "saved_search_own" ON public.saved_searches
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- 3. Business-day aware task due dates
-- =============================================================================

CREATE OR REPLACE FUNCTION public.wf_create_tasks_for_node(
  _run_id uuid, _doc_id uuid, _node jsonb, _node_id text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_type text := COALESCE(_node->>'type', 'TASK');
  v_assignees uuid[];
  v_sla int;
  v_sla_unit text := COALESCE(_node->'data'->>'sla_unit', _node->>'sla_unit', 'hours');
  v_sla_days int;
BEGIN
  IF v_type NOT IN ('APPROVAL','SIGNATURE','TASK','NOTIFICATION') THEN
    RETURN;
  END IF;

  v_assignees := public.resolve_workflow_assignees(_node, _doc_id);

  IF (v_assignees IS NULL OR array_length(v_assignees,1) IS NULL)
     AND (_node->>'assignee_id') IS NOT NULL THEN
    v_assignees := ARRAY[(_node->>'assignee_id')::uuid];
  END IF;

  v_sla := public.wf_node_sla_hours(_node);
  v_sla_days := COALESCE(
    (_node->'data'->>'sla_hours')::int,
    (_node->>'sla_hours')::int
  );

  IF v_assignees IS NOT NULL AND array_length(v_assignees,1) > 0 THEN
    INSERT INTO public.workflow_tasks(run_id, document_id, node_id, node_type, title, assignee_id, action_required, due_at)
    SELECT _run_id, _doc_id, _node_id, v_type,
           COALESCE(_node->>'label', v_type), a,
           CASE v_type WHEN 'SIGNATURE' THEN 'sign' WHEN 'APPROVAL' THEN 'approve' ELSE 'review' END,
           CASE
             WHEN v_sla_unit = 'business_days' AND v_sla_days IS NOT NULL AND v_sla_days > 0
               THEN public.add_business_days_ts(now(), v_sla_days)
             WHEN v_sla IS NOT NULL
               THEN now() + (v_sla || ' hours')::interval
             ELSE NULL
           END
      FROM unnest(v_assignees) a;

    INSERT INTO public.notifications(user_id, type, title, body, link)
    SELECT a, 'task', 'Новая задача: ' || COALESCE(_node->>'label', v_type), NULL,
           '/documents/' || _doc_id
      FROM unnest(v_assignees) a;
  END IF;
END;
$$;
