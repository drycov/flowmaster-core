-- HR leave: document package, workflow, templates, sync with leave_requests

-- =============================================================================
-- 1. Package linkage
-- =============================================================================
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS document_package boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.leave_request_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id uuid NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  doc_kind text NOT NULL CHECK (doc_kind IN ('application', 'approval_sheet', 'order', 'memo')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (leave_request_id, doc_kind),
  UNIQUE (document_id)
);

CREATE INDEX IF NOT EXISTS idx_leave_request_documents_leave
  ON public.leave_request_documents(leave_request_id, sort_order);

GRANT SELECT ON public.leave_request_documents TO authenticated;
GRANT ALL ON public.leave_request_documents TO service_role;
ALTER TABLE public.leave_request_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lrd_select" ON public.leave_request_documents;
CREATE POLICY "lrd_select" ON public.leave_request_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.id = leave_request_id
        AND (
          lr.user_id = auth.uid()
          OR lr.approver_id = auth.uid()
          OR public.is_admin(auth.uid())
          OR public.user_has_permission(auth.uid(), 'manage_hr')
          OR public.user_has_permission(auth.uid(), 'manage_users')
        )
    )
  );

-- =============================================================================
-- 2. HR officer role (workflow assignee for cadre step)
-- =============================================================================
INSERT INTO public.roles (code, name_ru, name_kk, description, kind, is_active, is_system)
VALUES (
  'hr_officer',
  'Кадровая служба',
  'Кадр қызметі',
  'Согласование кадровых документов и отпусков',
  'system',
  true,
  true
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM public.roles r
CROSS JOIN (VALUES ('manage_hr'), ('approve_documents')) AS p(code)
WHERE r.code = 'hr_officer'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_role_grants (user_id, role_id)
SELECT DISTINCT urg.user_id, hr.id
FROM public.user_role_grants urg
JOIN public.role_permissions rp ON rp.role_id = urg.role_id AND rp.permission_code = 'manage_hr'
JOIN public.roles hr ON hr.code = 'hr_officer'
WHERE urg.revoked_at IS NULL
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 3. Workflow + templates (stable UUIDs — see leave-package.constants.ts)
-- =============================================================================
INSERT INTO public.workflows (id, name_ru, name_kk, description, status, definition, version)
VALUES (
  'a1b2c3d4-e5f6-4789-a012-000000000001',
  'Согласование отпуска',
  'Демалысты келісу',
  'Руководитель → кадровая служба → архив. Для заявления на отпуск.',
  'published',
  '{
    "schema_version": 2,
    "nodes": [
      {"id": "start", "type": "START", "position": {"x": 80, "y": 120}, "label": "Старт"},
      {"id": "mgr", "type": "APPROVAL", "position": {"x": 260, "y": 120}, "label": "Согласование руководителя", "assignee_type": "initiator_manager", "sla_hours": 48, "sla_unit": "hours"},
      {"id": "hr", "type": "APPROVAL", "position": {"x": 440, "y": 120}, "label": "Кадровая служба", "assignee_type": "role", "assignee_ref": "hr_officer", "sla_hours": 24, "sla_unit": "hours"},
      {"id": "archive", "type": "ARCHIVE", "position": {"x": 620, "y": 120}, "label": "Архив"},
      {"id": "end", "type": "END", "position": {"x": 800, "y": 120}, "label": "Завершено"}
    ],
    "edges": [
      {"id": "e1", "source": "start", "target": "mgr"},
      {"id": "e2", "source": "mgr", "target": "hr"},
      {"id": "e3", "source": "hr", "target": "archive"},
      {"id": "e4", "source": "archive", "target": "end"}
    ]
  }'::jsonb,
  1
)
ON CONFLICT (id) DO UPDATE SET
  name_ru = EXCLUDED.name_ru,
  name_kk = EXCLUDED.name_kk,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  definition = EXCLUDED.definition;

INSERT INTO public.document_templates (
  id, name_ru, name_kk, category, description, file_format, status, schema, default_workflow_id
) VALUES (
  'a1b2c3d4-e5f6-4789-a012-000000000101',
  'Заявление на отпуск',
  'Демалыс өтінімі',
  'hr',
  'Заявление сотрудника на предоставление отпуска или иного отсутствия',
  'html',
  'published',
  jsonb_build_object(
    'title_template_ru', 'Заявление на {{absence_type_ru}} — {{full_name}}',
    'title_template_kk', 'Демалыс өтінімі — {{full_name}}',
    'body_template',
    E'{{organization_name}}\n\nЗАЯВЛЕНИЕ\n\nПрошу предоставить мне {{absence_type_ru}} с {{date_from}} по {{date_to}} ({{business_days}} раб. дн.).\n\n{{reason_block}}\n\n\n{{document_date}}                    _________________\n                                     {{full_name}}\n                                     {{position}}\n                                     {{department}}',
    'fields', '[]'::jsonb
  ),
  'a1b2c3d4-e5f6-4789-a012-000000000001'
)
ON CONFLICT (id) DO UPDATE SET
  schema = EXCLUDED.schema,
  status = EXCLUDED.status,
  default_workflow_id = EXCLUDED.default_workflow_id;

INSERT INTO public.document_templates (
  id, name_ru, name_kk, category, description, file_format, status, schema
) VALUES (
  'a1b2c3d4-e5f6-4789-a012-000000000102',
  'Приказ о предоставлении отпуска',
  'Демалыс беру туралы бұйрық',
  'hr',
  'Приказ работодателя о предоставлении отпуска (формируется после согласования)',
  'html',
  'published',
  jsonb_build_object(
    'body_template',
    E'{{organization_name}}\n\nПРИКАЗ № {{document_number}}\n\n{{document_date}}\n\nО предоставлении отпуска\n\nПРИКАЗЫВАЮ:\n1. Предоставить {{full_name}}, {{position}}, {{department}}, {{absence_type_ru}} с {{date_from}} по {{date_to}} продолжительностью {{business_days}} раб. дн.\n2. Основание: заявление сотрудника от {{document_date}}.\n3. Контроль за исполнением оставить за кадровой службой.\n\nДиректор _________________ {{sender_name}}'
  )
)
ON CONFLICT (id) DO UPDATE SET schema = EXCLUDED.schema, status = EXCLUDED.status;

INSERT INTO public.document_templates (
  id, name_ru, name_kk, category, description, file_format, status, schema
) VALUES (
  'a1b2c3d4-e5f6-4789-a012-000000000103',
  'Служебная записка (отпуск)',
  'Қызметтік жазба (демалыс)',
  'hr',
  'Уведомление бухгалтерии / кадров о предоставлении отпуска',
  'html',
  'published',
  jsonb_build_object(
    'body_template',
    E'{{organization_name}}\n\nСЛУЖЕБНАЯ ЗАПИСКА\n\nВ бухгалтерию / кадровую службу\n\nСообщаем, что сотруднику {{full_name}} ({{department}}, {{position}}) согласован {{absence_type_ru}} на период с {{date_from}} по {{date_to}} ({{business_days}} раб. дн.).\n\nПросим произвести начисление и отражение в табеле учёта рабочего времени.\n\n{{document_date}}                    _________________\n                                     {{sender_name}}\n                                     {{sender_position}}'
  )
)
ON CONFLICT (id) DO UPDATE SET schema = EXCLUDED.schema, status = EXCLUDED.status;

-- =============================================================================
-- 4. Spawn order + memo when leave approved (document package)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.hr_format_leave_date(_d date)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT to_char(_d, 'DD.MM.YYYY');
$$;

CREATE OR REPLACE FUNCTION public.hr_leave_template_values(_leave_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lr record;
  p record;
  org record;
  pos text;
  dept text;
  mgr record;
BEGIN
  SELECT lr.*, at.name_ru AS absence_ru, at.name_kk AS absence_kk
    INTO lr
    FROM public.leave_requests lr
    JOIN public.ref_absence_types at ON at.id = lr.absence_type_id
   WHERE lr.id = _leave_id;

  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;

  SELECT p.*, d.name_ru AS dept_ru, d.name_kk AS dept_kk, po.title_ru AS pos_ru
    INTO p
    FROM public.profiles p
    LEFT JOIN public.departments d ON d.id = p.department_id
    LEFT JOIN public.positions po ON po.id = p.position_id
   WHERE p.id = lr.user_id;

  SELECT name_ru INTO org FROM public.organization ORDER BY created_at LIMIT 1;

  dept := COALESCE(p.dept_ru, '');
  pos := COALESCE(p.pos_ru, '');

  SELECT mp.full_name_ru, mp.full_name_kk INTO mgr
    FROM public.profiles mp
   WHERE mp.id = public.user_manager(lr.user_id);

  RETURN jsonb_build_object(
    'organization_name', COALESCE(org.name_ru, ''),
    'full_name', COALESCE(p.full_name_ru, p.email, ''),
    'position', pos,
    'department', dept,
    'absence_type_ru', lr.absence_ru,
    'absence_type_kk', lr.absence_kk,
    'date_from', public.hr_format_leave_date(lr.date_from),
    'date_to', public.hr_format_leave_date(lr.date_to),
    'business_days', lr.business_days::text,
    'document_date', to_char(now()::date, 'DD.MM.YYYY'),
    'sender_name', COALESCE(mgr.full_name_ru, ''),
    'sender_position', 'Руководитель'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_substitute_template(_template text, _vals jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  k text;
  v text;
  result text := _template;
BEGIN
  FOR k, v IN SELECT * FROM jsonb_each_text(_vals) LOOP
    result := replace(result, '{{' || k || '}}', COALESCE(v, ''));
  END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_spawn_leave_package_documents(_leave_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lr record;
  vals jsonb;
  tpl_order text;
  tpl_memo text;
  body_order text;
  body_memo text;
  doc_order uuid;
  doc_memo uuid;
  hr_user uuid;
  title_base text;
BEGIN
  SELECT * INTO lr FROM public.leave_requests WHERE id = _leave_id;
  IF NOT FOUND OR NOT lr.document_package THEN RETURN; END IF;
  IF lr.status <> 'approved' THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM public.leave_request_documents
    WHERE leave_request_id = _leave_id AND doc_kind = 'order'
  ) THEN
    RETURN;
  END IF;

  vals := public.hr_leave_template_values(_leave_id);
  title_base := vals->>'full_name';

  SELECT schema->>'body_template' INTO tpl_order
    FROM public.document_templates WHERE id = 'a1b2c3d4-e5f6-4789-a012-000000000102';
  SELECT schema->>'body_template' INTO tpl_memo
    FROM public.document_templates WHERE id = 'a1b2c3d4-e5f6-4789-a012-000000000103';

  body_order := public.hr_substitute_template(COALESCE(tpl_order, ''), vals);
  body_memo := public.hr_substitute_template(COALESCE(tpl_memo, ''), vals);

  SELECT pa.user_id INTO hr_user
    FROM public.user_role_grants urg
    JOIN public.roles r ON r.id = urg.role_id AND r.code = 'hr_officer'
    JOIN public.profile_assignments pa ON pa.user_id = urg.user_id AND pa.is_primary AND pa.end_date IS NULL
    WHERE urg.revoked_at IS NULL
    LIMIT 1;

  IF hr_user IS NULL THEN
    hr_user := lr.user_id;
  END IF;

  INSERT INTO public.documents (title_ru, title_kk, body, template_id, created_by, status, reg_number)
  VALUES (
    'Приказ о предоставлении отпуска — ' || title_base,
    'Демалыс бұйрығы — ' || title_base,
    body_order,
    'a1b2c3d4-e5f6-4789-a012-000000000102',
    hr_user,
    'draft',
    ''
  )
  RETURNING id INTO doc_order;

  INSERT INTO public.leave_request_documents (leave_request_id, document_id, doc_kind, sort_order)
  VALUES (_leave_id, doc_order, 'order', 30);

  INSERT INTO public.documents (title_ru, title_kk, body, template_id, created_by, status, reg_number)
  VALUES (
    'Служебная записка — отпуск — ' || title_base,
    'Қызметтік жазба — демалыс — ' || title_base,
    body_memo,
    'a1b2c3d4-e5f6-4789-a012-000000000103',
    hr_user,
    'draft',
    ''
  )
  RETURNING id INTO doc_memo;

  INSERT INTO public.leave_request_documents (leave_request_id, document_id, doc_kind, sort_order)
  VALUES (_leave_id, doc_memo, 'memo', 40);
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_request_sync_from_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leave_id uuid;
BEGIN
  SELECT lrd.leave_request_id INTO v_leave_id
    FROM public.leave_request_documents lrd
   WHERE lrd.document_id = NEW.id AND lrd.doc_kind = 'application';

  IF v_leave_id IS NULL THEN
    SELECT lr.id INTO v_leave_id
      FROM public.leave_requests lr
     WHERE lr.document_id = NEW.id
     LIMIT 1;
  END IF;

  IF v_leave_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.status IN ('approved', 'signed', 'archived') THEN
    UPDATE public.leave_requests
       SET status = 'approved',
           decided_at = COALESCE(decided_at, now())
     WHERE id = v_leave_id AND status = 'pending';
  ELSIF NEW.status = 'rejected' THEN
    UPDATE public.leave_requests
       SET status = 'rejected',
           decided_at = COALESCE(decided_at, now())
     WHERE id = v_leave_id AND status = 'pending';
  ELSIF NEW.status = 'cancelled' THEN
    UPDATE public.leave_requests
       SET status = 'cancelled',
           decided_at = COALESCE(decided_at, now())
     WHERE id = v_leave_id AND status IN ('pending', 'approved');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_request_sync_document ON public.documents;
CREATE TRIGGER trg_leave_request_sync_document
  AFTER UPDATE OF status ON public.documents
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.leave_request_sync_from_document();

CREATE OR REPLACE FUNCTION public.leave_request_spawn_package_on_approve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' AND NEW.document_package THEN
    PERFORM public.hr_spawn_leave_package_documents(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_request_spawn_package ON public.leave_requests;
CREATE TRIGGER trg_leave_request_spawn_package
  AFTER UPDATE OF status ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.leave_request_spawn_package_on_approve();

-- Skip duplicate approver ping when workflow package is used
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
  IF NEW.document_package THEN
    RETURN NEW;
  END IF;

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

NOTIFY pgrst, 'reload schema';
