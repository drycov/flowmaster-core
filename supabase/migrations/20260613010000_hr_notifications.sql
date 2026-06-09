-- HR notifications: leave decisions, duty assignments, user prefs

ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS telegram_hr_events boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_hr_events boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.should_send_notification_email(
  _user_id uuid,
  _type text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.user_notification_preferences pref ON pref.user_id = p.id
    WHERE p.id = _user_id
      AND p.email IS NOT NULL
      AND btrim(p.email) <> ''
      AND p.email NOT LIKE 'eds.%@esedo.local'
      AND COALESCE(pref.email_enabled, true) = true
      AND (
        (_type = 'task' AND COALESCE(pref.email_task_assigned, true))
        OR (_type = 'return' AND COALESCE(pref.email_document_returned, true))
        OR (_type IN ('workflow', 'sla', 'system') AND COALESCE(pref.email_workflow_events, true))
        OR (_type = 'hr' AND COALESCE(pref.email_hr_events, true))
        OR (_type NOT IN ('task', 'return', 'workflow', 'sla', 'system', 'hr'))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.should_send_notification_telegram(
  _user_id uuid,
  _type text,
  _title text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org record;
  v_is_approval boolean;
BEGIN
  SELECT * INTO v_org FROM public.org_telegram_settings();
  IF NOT COALESCE(v_org.enabled, false) THEN
    RETURN false;
  END IF;

  v_is_approval := public.is_approval_notification(_type, _title);
  IF v_is_approval AND NOT COALESCE(v_org.notify_on_approvals, true) THEN
    RETURN false;
  END IF;
  IF NOT v_is_approval AND NOT COALESCE(v_org.notify_on_tasks, true) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_notification_preferences pref
    WHERE pref.user_id = _user_id
      AND COALESCE(pref.telegram_enabled, true) = true
      AND pref.telegram_chat_id IS NOT NULL
      AND btrim(pref.telegram_chat_id) <> ''
      AND (
        (_type = 'task' AND COALESCE(pref.telegram_task_assigned, true))
        OR (_type = 'return' AND COALESCE(pref.telegram_document_returned, true))
        OR (_type IN ('workflow', 'sla', 'system') AND COALESCE(pref.telegram_workflow_events, true))
        OR (_type = 'hr' AND COALESCE(pref.telegram_hr_events, true))
        OR (_type NOT IN ('task', 'return', 'workflow', 'sla', 'system', 'hr'))
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_requests_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type_name text;
  v_employee_name text;
  v_period text;
BEGIN
  SELECT COALESCE(at.name_ru, 'Отсутствие') INTO v_type_name
  FROM public.ref_absence_types at
  WHERE at.id = NEW.absence_type_id;

  v_period := to_char(NEW.date_from, 'DD.MM.YYYY')
    || CASE
      WHEN NEW.date_to <> NEW.date_from THEN ' — ' || to_char(NEW.date_to, 'DD.MM.YYYY')
      ELSE ''
    END;

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' AND NEW.approver_id IS NOT NULL THEN
    SELECT COALESCE(p.full_name_ru, p.email, 'Сотрудник') INTO v_employee_name
    FROM public.profiles p
    WHERE p.id = NEW.user_id;

    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (
      NEW.approver_id,
      'hr',
      'Заявка на согласование: ' || v_type_name,
      v_employee_name || ' · ' || v_period,
      '/hr/leave/approvals'
    );
  ELSIF TG_OP = 'UPDATE'
    AND OLD.status = 'pending'
    AND NEW.status IN ('approved', 'rejected')
  THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (
      NEW.user_id,
      'hr',
      CASE NEW.status
        WHEN 'approved' THEN 'Отпуск согласован'
        ELSE 'Заявка не согласована'
      END,
      v_type_name || ' · ' || v_period,
      '/hr/leave'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_requests_notify ON public.leave_requests;
CREATE TRIGGER trg_leave_requests_notify
  AFTER INSERT OR UPDATE OF status ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.leave_requests_notify();

CREATE OR REPLACE FUNCTION public.duty_assignments_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_name text;
  v_dept_label text;
  v_period text;
  v_body text;
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(dr.name_ru, 'Дежурство') INTO v_role_name
  FROM public.ref_duty_roles dr
  WHERE dr.id = NEW.duty_role_id;

  SELECT COALESCE(d.code, d.name_ru, '') INTO v_dept_label
  FROM public.departments d
  WHERE d.id = NEW.department_id;

  v_period := to_char(NEW.starts_at::date, 'DD.MM.YYYY')
    || CASE
      WHEN NEW.ends_at::date <> NEW.starts_at::date THEN ' — ' || to_char(NEW.ends_at::date, 'DD.MM.YYYY')
      ELSE ''
    END;

  v_body := v_role_name || ' · ' || v_period;
  IF v_dept_label <> '' THEN
    v_body := v_body || ' · ' || v_dept_label;
  END IF;

  INSERT INTO public.notifications(user_id, type, title, body, link)
  VALUES (NEW.assignee_id, 'hr', 'Назначено дежурство', v_body, '/hr/duty');

  IF NEW.substitute_id IS NOT NULL AND NEW.substitute_id <> NEW.assignee_id THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (
      NEW.substitute_id,
      'hr',
      'Назначено замещение на дежурстве',
      v_body,
      '/hr/duty'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_duty_assignments_notify ON public.duty_assignments;
CREATE TRIGGER trg_duty_assignments_notify
  AFTER INSERT ON public.duty_assignments
  FOR EACH ROW EXECUTE FUNCTION public.duty_assignments_notify();

NOTIFY pgrst, 'reload schema';
