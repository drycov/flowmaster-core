-- Default workflows for remaining ref_document_types:
-- order, contract, memo, protocol, act, application, report

INSERT INTO public.workflows (id, name_ru, name_kk, description, status, definition, version)
VALUES
  (
    'b1b2c3d4-e5f6-4789-a012-000000000104',
    'Утверждение приказа',
    'Бұйрықты бекіту',
    'Согласование руководителем, визирование вышестоящим руководством, подписание и архив.',
    'published',
    '{
      "schema_version": 2,
      "nodes": [
        {"id": "start", "type": "START", "position": {"x": 80, "y": 120}, "label": "Старт"},
        {"id": "mgr", "type": "APPROVAL", "position": {"x": 240, "y": 120}, "label": "Согласование непосредственного руководителя", "assignee_type": "initiator_manager", "sla_hours": 48, "sla_unit": "hours"},
        {"id": "parent", "type": "APPROVAL", "position": {"x": 400, "y": 120}, "label": "Визирование вышестоящего руководства", "assignee_type": "parent_department_head", "sla_hours": 72, "sla_unit": "hours"},
        {"id": "sign", "type": "SIGNATURE", "position": {"x": 560, "y": 120}, "label": "Подписание приказа", "assignee_type": "department_head", "sla_hours": 24, "sla_unit": "hours"},
        {"id": "archive", "type": "ARCHIVE", "position": {"x": 720, "y": 120}, "label": "Архив"},
        {"id": "end", "type": "END", "position": {"x": 880, "y": 120}, "label": "Завершено"}
      ],
      "edges": [
        {"id": "e1", "source": "start", "target": "mgr"},
        {"id": "e2", "source": "mgr", "target": "parent"},
        {"id": "e3", "source": "parent", "target": "sign"},
        {"id": "e4", "source": "sign", "target": "archive"},
        {"id": "e5", "source": "archive", "target": "end"}
      ]
    }'::jsonb,
    1
  ),
  (
    'b1b2c3d4-e5f6-4789-a012-000000000105',
    'Согласование договора',
    'Шартты келісу',
    'Согласование руководителем инициатора, юридическая проверка подразделением, подписание.',
    'published',
    '{
      "schema_version": 2,
      "nodes": [
        {"id": "start", "type": "START", "position": {"x": 80, "y": 120}, "label": "Старт"},
        {"id": "mgr", "type": "APPROVAL", "position": {"x": 240, "y": 120}, "label": "Согласование руководителя инициатора", "assignee_type": "initiator_manager", "sla_hours": 72, "sla_unit": "hours"},
        {"id": "legal", "type": "APPROVAL", "position": {"x": 400, "y": 120}, "label": "Проверка подразделением", "assignee_type": "department_head", "sla_hours": 72, "sla_unit": "hours"},
        {"id": "sign", "type": "SIGNATURE", "position": {"x": 560, "y": 120}, "label": "Подписание договора", "assignee_type": "department_head", "sla_hours": 48, "sla_unit": "hours"},
        {"id": "archive", "type": "ARCHIVE", "position": {"x": 720, "y": 120}, "label": "Архив"},
        {"id": "end", "type": "END", "position": {"x": 880, "y": 120}, "label": "Завершено"}
      ],
      "edges": [
        {"id": "e1", "source": "start", "target": "mgr"},
        {"id": "e2", "source": "mgr", "target": "legal"},
        {"id": "e3", "source": "legal", "target": "sign"},
        {"id": "e4", "source": "sign", "target": "archive"},
        {"id": "e5", "source": "archive", "target": "end"}
      ]
    }'::jsonb,
    1
  ),
  (
    'b1b2c3d4-e5f6-4789-a012-000000000106',
    'Согласование служебной записки',
    'Қызметтік жазбаны келісу',
    'Согласование непосредственным руководителем и руководителем подразделения.',
    'published',
    '{
      "schema_version": 2,
      "nodes": [
        {"id": "start", "type": "START", "position": {"x": 80, "y": 120}, "label": "Старт"},
        {"id": "mgr", "type": "APPROVAL", "position": {"x": 260, "y": 120}, "label": "Согласование руководителя", "assignee_type": "initiator_manager", "sla_hours": 24, "sla_unit": "hours"},
        {"id": "head", "type": "APPROVAL", "position": {"x": 440, "y": 120}, "label": "Ознакомление руководителя подразделения", "assignee_type": "department_head", "sla_hours": 24, "sla_unit": "hours"},
        {"id": "end", "type": "END", "position": {"x": 620, "y": 120}, "label": "Завершено"}
      ],
      "edges": [
        {"id": "e1", "source": "start", "target": "mgr"},
        {"id": "e2", "source": "mgr", "target": "head"},
        {"id": "e3", "source": "head", "target": "end"}
      ]
    }'::jsonb,
    1
  ),
  (
    'b1b2c3d4-e5f6-4789-a012-000000000107',
    'Утверждение протокола',
    'Хаттаманы бекіту',
    'Согласование, подписание председателем и передача в архив.',
    'published',
    '{
      "schema_version": 2,
      "nodes": [
        {"id": "start", "type": "START", "position": {"x": 80, "y": 120}, "label": "Старт"},
        {"id": "mgr", "type": "APPROVAL", "position": {"x": 240, "y": 120}, "label": "Согласование руководителя", "assignee_type": "initiator_manager", "sla_hours": 48, "sla_unit": "hours"},
        {"id": "head", "type": "APPROVAL", "position": {"x": 400, "y": 120}, "label": "Утверждение руководителем подразделения", "assignee_type": "department_head", "sla_hours": 48, "sla_unit": "hours"},
        {"id": "sign", "type": "SIGNATURE", "position": {"x": 560, "y": 120}, "label": "Подписание протокола", "assignee_type": "department_head", "sla_hours": 24, "sla_unit": "hours"},
        {"id": "archive", "type": "ARCHIVE", "position": {"x": 720, "y": 120}, "label": "Архив"},
        {"id": "end", "type": "END", "position": {"x": 880, "y": 120}, "label": "Завершено"}
      ],
      "edges": [
        {"id": "e1", "source": "start", "target": "mgr"},
        {"id": "e2", "source": "mgr", "target": "head"},
        {"id": "e3", "source": "head", "target": "sign"},
        {"id": "e4", "source": "sign", "target": "archive"},
        {"id": "e5", "source": "archive", "target": "end"}
      ]
    }'::jsonb,
    1
  ),
  (
    'b1b2c3d4-e5f6-4789-a012-000000000108',
    'Подписание акта',
    'Актіге қол қою',
    'Согласование, подписание сторонами и архивное хранение.',
    'published',
    '{
      "schema_version": 2,
      "nodes": [
        {"id": "start", "type": "START", "position": {"x": 80, "y": 120}, "label": "Старт"},
        {"id": "mgr", "type": "APPROVAL", "position": {"x": 240, "y": 120}, "label": "Согласование руководителя", "assignee_type": "initiator_manager", "sla_hours": 48, "sla_unit": "hours"},
        {"id": "head", "type": "APPROVAL", "position": {"x": 400, "y": 120}, "label": "Проверка руководителем подразделения", "assignee_type": "department_head", "sla_hours": 48, "sla_unit": "hours"},
        {"id": "sign", "type": "SIGNATURE", "position": {"x": 560, "y": 120}, "label": "Подписание акта", "assignee_type": "department_head", "sla_hours": 24, "sla_unit": "hours"},
        {"id": "archive", "type": "ARCHIVE", "position": {"x": 720, "y": 120}, "label": "Архив"},
        {"id": "end", "type": "END", "position": {"x": 880, "y": 120}, "label": "Завершено"}
      ],
      "edges": [
        {"id": "e1", "source": "start", "target": "mgr"},
        {"id": "e2", "source": "mgr", "target": "head"},
        {"id": "e3", "source": "head", "target": "sign"},
        {"id": "e4", "source": "sign", "target": "archive"},
        {"id": "e5", "source": "archive", "target": "end"}
      ]
    }'::jsonb,
    1
  ),
  (
    'b1b2c3d4-e5f6-4789-a012-000000000109',
    'Рассмотрение заявления',
    'Өтінішті қарау',
    'Согласование руководителем, рассмотрение кадровой службой (для кадровых заявлений).',
    'published',
    '{
      "schema_version": 2,
      "nodes": [
        {"id": "start", "type": "START", "position": {"x": 80, "y": 120}, "label": "Старт"},
        {"id": "mgr", "type": "APPROVAL", "position": {"x": 260, "y": 120}, "label": "Согласование руководителя", "assignee_type": "initiator_manager", "sla_hours": 48, "sla_unit": "hours"},
        {"id": "hr", "type": "APPROVAL", "position": {"x": 440, "y": 120}, "label": "Рассмотрение кадровой службой", "assignee_type": "role", "assignee_ref": "hr_officer", "sla_hours": 72, "sla_unit": "hours"},
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
  ),
  (
    'b1b2c3d4-e5f6-4789-a012-000000000110',
    'Утверждение отчёта',
    'Есепті бекіту',
    'Согласование руководителем и утверждение руководителем подразделения.',
    'published',
    '{
      "schema_version": 2,
      "nodes": [
        {"id": "start", "type": "START", "position": {"x": 80, "y": 120}, "label": "Старт"},
        {"id": "mgr", "type": "APPROVAL", "position": {"x": 260, "y": 120}, "label": "Согласование руководителя", "assignee_type": "initiator_manager", "sla_hours": 72, "sla_unit": "hours"},
        {"id": "head", "type": "APPROVAL", "position": {"x": 440, "y": 120}, "label": "Утверждение руководителем подразделения", "assignee_type": "department_head", "sla_hours": 48, "sla_unit": "hours"},
        {"id": "end", "type": "END", "position": {"x": 620, "y": 120}, "label": "Завершено"}
      ],
      "edges": [
        {"id": "e1", "source": "start", "target": "mgr"},
        {"id": "e2", "source": "mgr", "target": "head"},
        {"id": "e3", "source": "head", "target": "end"}
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

UPDATE public.ref_document_types SET
  default_workflow_id = 'b1b2c3d4-e5f6-4789-a012-000000000104',
  auto_start_workflow = true
WHERE code = 'order' AND default_workflow_id IS NULL;

UPDATE public.ref_document_types SET
  default_workflow_id = 'b1b2c3d4-e5f6-4789-a012-000000000105',
  auto_start_workflow = true
WHERE code = 'contract' AND default_workflow_id IS NULL;

UPDATE public.ref_document_types SET
  default_workflow_id = 'b1b2c3d4-e5f6-4789-a012-000000000106',
  auto_start_workflow = true
WHERE code = 'memo' AND default_workflow_id IS NULL;

UPDATE public.ref_document_types SET
  default_workflow_id = 'b1b2c3d4-e5f6-4789-a012-000000000107',
  auto_start_workflow = true
WHERE code = 'protocol' AND default_workflow_id IS NULL;

UPDATE public.ref_document_types SET
  default_workflow_id = 'b1b2c3d4-e5f6-4789-a012-000000000108',
  auto_start_workflow = true
WHERE code = 'act' AND default_workflow_id IS NULL;

UPDATE public.ref_document_types SET
  default_workflow_id = 'b1b2c3d4-e5f6-4789-a012-000000000109',
  auto_start_workflow = true
WHERE code = 'application' AND default_workflow_id IS NULL;

UPDATE public.ref_document_types SET
  default_workflow_id = 'b1b2c3d4-e5f6-4789-a012-000000000110',
  auto_start_workflow = true
WHERE code = 'report' AND default_workflow_id IS NULL;
