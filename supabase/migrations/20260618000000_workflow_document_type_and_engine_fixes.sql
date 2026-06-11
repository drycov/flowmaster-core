-- Document type → default workflow mapping + workflow engine fixes
-- (frozen run.context graph, parallel_mode:any, NOTIFICATION auto-advance)

-- =============================================================================
-- 1. Document types: default workflow + auto-start flag
-- =============================================================================

ALTER TABLE public.ref_document_types
  ADD COLUMN IF NOT EXISTS default_workflow_id uuid
    REFERENCES public.workflows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_start_workflow boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ref_document_types_default_workflow_id
  ON public.ref_document_types (default_workflow_id)
  WHERE default_workflow_id IS NOT NULL;

COMMENT ON COLUMN public.ref_document_types.default_workflow_id IS
  'Published workflow started for documents of this type when no template/custom route is set.';
COMMENT ON COLUMN public.ref_document_types.auto_start_workflow IS
  'When true, creation fails if the default workflow cannot be started.';

-- =============================================================================
-- 2. Seed EDMS default workflows (stable UUIDs)
-- =============================================================================

INSERT INTO public.workflows (id, name_ru, name_kk, description, status, definition, version)
VALUES
  (
    'b1b2c3d4-e5f6-4789-a012-000000000101',
    'Согласование входящего',
    'Кіріс құжатын келісу',
    'Регистрация и согласование входящей корреспонденции.',
    'published',
    '{
      "schema_version": 2,
      "nodes": [
        {"id": "start", "type": "START", "position": {"x": 80, "y": 120}, "label": "Старт"},
        {"id": "reg", "type": "APPROVAL", "position": {"x": 260, "y": 120}, "label": "Регистрация / согласование", "assignee_type": "department_head", "sla_hours": 24, "sla_unit": "hours"},
        {"id": "archive", "type": "ARCHIVE", "position": {"x": 440, "y": 120}, "label": "Архив"},
        {"id": "end", "type": "END", "position": {"x": 620, "y": 120}, "label": "Завершено"}
      ],
      "edges": [
        {"id": "e1", "source": "start", "target": "reg"},
        {"id": "e2", "source": "reg", "target": "archive"},
        {"id": "e3", "source": "archive", "target": "end"}
      ]
    }'::jsonb,
    1
  ),
  (
    'b1b2c3d4-e5f6-4789-a012-000000000102',
    'Согласование исходящего',
    'Шығыс құжатын келісу',
    'Согласование руководителем и подписание исходящего документа.',
    'published',
    '{
      "schema_version": 2,
      "nodes": [
        {"id": "start", "type": "START", "position": {"x": 80, "y": 120}, "label": "Старт"},
        {"id": "mgr", "type": "APPROVAL", "position": {"x": 260, "y": 120}, "label": "Согласование руководителя", "assignee_type": "initiator_manager", "sla_hours": 48, "sla_unit": "hours"},
        {"id": "sign", "type": "SIGNATURE", "position": {"x": 440, "y": 120}, "label": "Подписание", "assignee_type": "department_head", "sla_hours": 24, "sla_unit": "hours"},
        {"id": "end", "type": "END", "position": {"x": 620, "y": 120}, "label": "Завершено"}
      ],
      "edges": [
        {"id": "e1", "source": "start", "target": "mgr"},
        {"id": "e2", "source": "mgr", "target": "sign"},
        {"id": "e3", "source": "sign", "target": "end"}
      ]
    }'::jsonb,
    1
  ),
  (
    'b1b2c3d4-e5f6-4789-a012-000000000103',
    'Согласование внутреннего',
    'Ішкі құжатты келісу',
    'Согласование внутреннего документа руководителем подразделения.',
    'published',
    '{
      "schema_version": 2,
      "nodes": [
        {"id": "start", "type": "START", "position": {"x": 80, "y": 120}, "label": "Старт"},
        {"id": "head", "type": "APPROVAL", "position": {"x": 260, "y": 120}, "label": "Согласование руководителя", "assignee_type": "department_head", "sla_hours": 48, "sla_unit": "hours"},
        {"id": "end", "type": "END", "position": {"x": 440, "y": 120}, "label": "Завершено"}
      ],
      "edges": [
        {"id": "e1", "source": "start", "target": "head"},
        {"id": "e2", "source": "head", "target": "end"}
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
  default_workflow_id = 'b1b2c3d4-e5f6-4789-a012-000000000101',
  auto_start_workflow = true
WHERE code = 'incoming' AND default_workflow_id IS NULL;

UPDATE public.ref_document_types SET
  default_workflow_id = 'b1b2c3d4-e5f6-4789-a012-000000000102',
  auto_start_workflow = true
WHERE code = 'outgoing' AND default_workflow_id IS NULL;

UPDATE public.ref_document_types SET
  default_workflow_id = 'b1b2c3d4-e5f6-4789-a012-000000000103',
  auto_start_workflow = true
WHERE code = 'internal' AND default_workflow_id IS NULL;

-- =============================================================================
-- 3. Assignee resolution: legacy typo alias
-- =============================================================================

CREATE OR REPLACE FUNCTION public.resolve_workflow_assignees(_node jsonb, _document uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mode text := COALESCE(
    _node->'data'->>'assignee_mode',
    _node->>'assignee_mode',
    _node->'data'->>'assignee_type',
    _node->>'assignee_type',
    'user'
  );
  ref text := COALESCE(
    _node->'data'->>'assignee_ref',
    _node->>'assignee_ref',
    _node->'data'->>'assignee_user_id',
    _node->>'assignee_user_id',
    _node->'data'->>'assignee_id',
    _node->>'assignee_id'
  );
  initiator uuid;
  dept uuid;
  result uuid[] := '{}'::uuid[];
BEGIN
  IF mode = 'initiatory_manager' THEN
    mode := 'initiator_manager';
  END IF;

  SELECT created_by, department_id INTO initiator, dept FROM public.documents WHERE id = _document;

  IF mode = 'user' AND ref IS NOT NULL THEN
    result := ARRAY[ref::uuid];
  ELSIF mode = 'initiator' THEN
    result := ARRAY[initiator];
  ELSIF mode = 'position' AND ref IS NOT NULL THEN
    SELECT array_agg(pa.user_id) INTO result
      FROM public.profile_assignments pa
     WHERE pa.position_id = ref::uuid AND pa.is_primary AND pa.end_date IS NULL;
  ELSIF mode = 'department' AND ref IS NOT NULL THEN
    SELECT array_agg(pa.user_id) INTO result
      FROM public.profile_assignments pa
     WHERE pa.department_id = ref::uuid AND pa.is_primary AND pa.end_date IS NULL;
  ELSIF mode = 'department_head' THEN
    result := ARRAY[public.department_head(COALESCE(ref::uuid, dept))];
  ELSIF mode = 'parent_department_head' THEN
    result := ARRAY[public.department_parent_head(COALESCE(ref::uuid, dept))];
  ELSIF mode = 'initiator_manager' THEN
    result := ARRAY[public.user_manager(initiator)];
  ELSIF mode IN ('role', 'group') AND ref IS NOT NULL THEN
    SELECT array_agg(DISTINCT g.user_id) INTO result
      FROM public.user_role_grants g
      JOIN public.roles r ON r.id = g.role_id
     WHERE r.code = ref AND g.revoked_at IS NULL
       AND (g.expires_at IS NULL OR g.expires_at > now());
  END IF;

  RETURN COALESCE(array_remove(result, NULL), '{}'::uuid[]);
END;
$$;

-- =============================================================================
-- 4. NOTIFICATION nodes: notify then auto-complete (no blocking tasks)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.wf_activate_node(
  _run_id uuid, _doc_id uuid, _node_id text, _nodes jsonb, _edges jsonb, _depth int DEFAULT 0
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_node jsonb;
  v_type text;
  v_result text;
  v_first text;
  v_has_tasks boolean;
  v_targets text[];
  tgt text;
  v_label text;
BEGIN
  PERFORM public.enable_document_status_bypass();

  IF _depth > 32 THEN
    RAISE EXCEPTION 'workflow graph too deep (cycle?)';
  END IF;

  SELECT n INTO v_node FROM jsonb_array_elements(_nodes) n WHERE n->>'id' = _node_id LIMIT 1;
  IF v_node IS NULL THEN RETURN NULL; END IF;

  v_type := COALESCE(v_node->'data'->>'type', v_node->>'type', 'TASK');
  v_label := COALESCE(v_node->>'label', v_node->'data'->>'label', _node_id);

  IF v_type = 'END' THEN
    UPDATE public.workflow_runs SET status='completed'::run_status, completed_at=now(), current_node=_node_id WHERE id = _run_id;
    UPDATE public.documents SET status='approved'::document_status WHERE id = _doc_id;
    RETURN _node_id;
  END IF;

  IF v_type = 'ARCHIVE' THEN
    UPDATE public.workflow_runs SET status='completed'::run_status, completed_at=now(), current_node=_node_id WHERE id = _run_id;
    UPDATE public.documents SET status='archived'::document_status, archived_at=now() WHERE id = _doc_id;
    RETURN _node_id;
  END IF;

  IF v_type = 'JOIN' THEN
    IF NOT public.wf_join_predecessors_done(_run_id, _node_id, _edges) THEN
      UPDATE public.workflow_runs SET current_node = _node_id WHERE id = _run_id;
      RETURN _node_id;
    END IF;
    v_targets := public.wf_get_outgoing_targets(_node_id, _edges, _doc_id, true);
    v_first := NULL;
    FOREACH tgt IN ARRAY v_targets LOOP
      v_result := public.wf_activate_node(_run_id, _doc_id, tgt, _nodes, _edges, _depth + 1);
      IF v_first IS NULL THEN v_first := v_result; END IF;
    END LOOP;
    RETURN COALESCE(v_first, _node_id);
  END IF;

  IF v_type = 'FORK' THEN
    v_targets := public.wf_get_outgoing_targets(_node_id, _edges, _doc_id, false);
    v_first := NULL;
    FOREACH tgt IN ARRAY v_targets LOOP
      v_result := public.wf_activate_node(_run_id, _doc_id, tgt, _nodes, _edges, _depth + 1);
      IF v_first IS NULL THEN v_first := v_result; END IF;
    END LOOP;
    UPDATE public.workflow_runs SET current_node = _node_id WHERE id = _run_id;
    RETURN COALESCE(v_first, _node_id);
  END IF;

  IF v_type IN ('START', 'CONDITION', 'TIMER', 'ESCALATION') THEN
    v_targets := public.wf_get_outgoing_targets(_node_id, _edges, _doc_id, v_type = 'CONDITION');
    IF v_targets IS NULL OR array_length(v_targets, 1) IS NULL THEN
      RAISE EXCEPTION 'condition node % has no matching branch', _node_id;
    END IF;
    v_first := NULL;
    FOREACH tgt IN ARRAY v_targets LOOP
      v_result := public.wf_activate_node(_run_id, _doc_id, tgt, _nodes, _edges, _depth + 1);
      IF v_first IS NULL THEN v_first := v_result; END IF;
    END LOOP;
    UPDATE public.workflow_runs SET current_node = COALESCE(v_first, _node_id) WHERE id = _run_id;
    RETURN COALESCE(v_first, _node_id);
  END IF;

  IF v_type = 'NOTIFICATION' THEN
    PERFORM public.wf_create_tasks_for_node(_run_id, _doc_id, v_node, _node_id);
    UPDATE public.workflow_tasks
       SET status = 'completed'::task_status,
           decision = 'approve',
           comment = COALESCE(comment, 'notification:auto-complete'),
           completed_at = now()
     WHERE run_id = _run_id
       AND node_id = _node_id
       AND status = 'pending';
    v_targets := public.wf_get_outgoing_targets(_node_id, _edges, _doc_id, true);
    v_first := NULL;
    FOREACH tgt IN ARRAY v_targets LOOP
      v_result := public.wf_activate_node(_run_id, _doc_id, tgt, _nodes, _edges, _depth + 1);
      IF v_first IS NULL THEN v_first := v_result; END IF;
    END LOOP;
    UPDATE public.workflow_runs SET current_node = COALESCE(v_first, _node_id) WHERE id = _run_id;
    RETURN COALESCE(v_first, _node_id);
  END IF;

  UPDATE public.workflow_runs SET current_node = _node_id WHERE id = _run_id;
  PERFORM public.wf_create_tasks_for_node(_run_id, _doc_id, v_node, _node_id);

  SELECT EXISTS (
    SELECT 1 FROM public.workflow_tasks
     WHERE run_id = _run_id AND node_id = _node_id AND status = 'pending'
  ) INTO v_has_tasks;

  IF NOT v_has_tasks THEN
    RAISE EXCEPTION 'workflow node % (%) «%» has no assignees', _node_id, v_type, v_label;
  END IF;

  RETURN _node_id;
END;
$$;

-- =============================================================================
-- 5. Task advance: frozen graph + parallel_mode:any
-- =============================================================================

CREATE OR REPLACE FUNCTION public.wf_run_graph(_run public.workflow_runs)
RETURNS TABLE(nodes jsonb, edges jsonb)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_def jsonb;
BEGIN
  nodes := COALESCE(_run.context->'nodes', '[]'::jsonb);
  edges := COALESCE(_run.context->'edges', '[]'::jsonb);

  IF jsonb_array_length(nodes) = 0 AND _run.workflow_id IS NOT NULL THEN
    SELECT definition INTO v_def FROM public.workflows WHERE id = _run.workflow_id;
    nodes := COALESCE(v_def->'nodes', '[]'::jsonb);
    edges := COALESCE(v_def->'edges', '[]'::jsonb);
  END IF;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_advance_workflow_task(
  _task_id uuid,
  _decision text,
  _comment text DEFAULT NULL::text,
  _correlation_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_task     public.workflow_tasks%ROWTYPE;
  v_run      public.workflow_runs%ROWTYPE;
  v_nodes    jsonb;
  v_edges    jsonb;
  v_node     jsonb;
  v_parallel text;
  v_next_id  text;
  v_correlation uuid := COALESCE(_correlation_id, gen_random_uuid());
  v_actor uuid := auth.uid();
  v_is_system boolean := (v_actor IS NULL);
  v_event_type text;
  v_initiator uuid;
BEGIN
  PERFORM public.enable_document_status_bypass();

  IF _decision NOT IN ('approve','reject','return') THEN
    RAISE EXCEPTION 'invalid decision %', _decision;
  END IF;

  SELECT * INTO v_task FROM public.workflow_tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'task not found'; END IF;
  IF v_task.status <> 'pending' THEN RAISE EXCEPTION 'task already completed'; END IF;

  IF NOT v_is_system AND NOT public.can_act_on_workflow_task(_task_id, v_actor) THEN
    RAISE EXCEPTION 'not the assignee';
  END IF;

  SELECT * INTO v_run FROM public.workflow_runs WHERE id = v_task.run_id FOR UPDATE;
  SELECT created_by INTO v_initiator FROM public.documents WHERE id = v_task.document_id;

  UPDATE public.workflow_tasks
     SET status = CASE _decision
                    WHEN 'approve' THEN 'completed'::task_status
                    WHEN 'reject'  THEN 'rejected'::task_status
                    ELSE 'returned'::task_status
                  END,
         decision = _decision,
         comment = _comment,
         completed_at = now()
   WHERE id = _task_id;

  IF _decision IN ('reject','return') THEN
    UPDATE public.workflow_tasks
       SET status = CASE _decision WHEN 'reject' THEN 'rejected'::task_status ELSE 'returned'::task_status END,
           completed_at = now()
     WHERE run_id = v_task.run_id AND status = 'pending' AND id <> _task_id;
  END IF;

  v_event_type := 'task.' || _decision;

  INSERT INTO public.workflow_events(run_id, document_id, event_type, node_id, actor_id, payload)
  VALUES (v_run.id, v_task.document_id, v_event_type, v_task.node_id, v_actor,
          jsonb_build_object('comment', _comment, 'correlation_id', v_correlation,
                             'system', v_is_system, 'acted_as_substitute',
                             CASE WHEN v_actor IS NOT NULL AND v_task.assignee_id IS DISTINCT FROM v_actor
                                  THEN public.is_active_substitute_for(v_actor, v_task.assignee_id)
                                  ELSE false END));

  INSERT INTO public.audit_logs(actor_id, entity_type, entity_id, action, after, correlation_id)
  VALUES (v_actor, 'workflow_task', _task_id::text,
          CASE WHEN v_is_system THEN 'workflow.sla_' || _decision
               ELSE 'workflow.' || _decision END,
          jsonb_build_object('decision', _decision, 'comment', _comment,
                             'document_id', v_task.document_id, 'node_id', v_task.node_id,
                             'system', v_is_system),
          v_correlation);

  SELECT g.nodes, g.edges INTO v_nodes, v_edges
    FROM public.wf_run_graph(v_run) g;

  IF _decision = 'reject' THEN
    UPDATE public.workflow_runs SET status='cancelled'::run_status, completed_at=now() WHERE id = v_run.id;
    UPDATE public.documents SET status='rejected'::document_status WHERE id = v_task.document_id;
    RETURN jsonb_build_object('ok', true, 'next', null, 'correlation_id', v_correlation);
  END IF;

  IF _decision = 'return' THEN
    UPDATE public.workflow_runs SET status='cancelled'::run_status, completed_at=now() WHERE id = v_run.id;
    UPDATE public.documents SET status='returned_for_revision'::document_status WHERE id = v_task.document_id;
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (v_initiator, 'task', 'Документ возвращён на доработку', COALESCE(_comment,''),
            '/documents/' || v_task.document_id);
    RETURN jsonb_build_object('ok', true, 'next', null, 'correlation_id', v_correlation);
  END IF;

  IF v_task.node_type = 'SIGNATURE' THEN
    UPDATE public.documents SET status='signed'::document_status WHERE id = v_task.document_id;
  END IF;

  SELECT n INTO v_node
    FROM jsonb_array_elements(v_nodes) n
   WHERE n->>'id' = v_task.node_id
   LIMIT 1;
  v_parallel := public.wf_node_parallel_mode(v_node);

  IF v_parallel = 'any' AND _decision = 'approve' THEN
    UPDATE public.workflow_tasks
       SET status = 'completed'::task_status,
           decision = 'approve',
           comment = COALESCE(comment, 'parallel:any auto-complete'),
           completed_at = now()
     WHERE run_id = v_task.run_id
       AND node_id = v_task.node_id
       AND status = 'pending'
       AND id <> _task_id;
  ELSIF public.wf_has_pending_siblings(v_task.run_id, v_task.node_id, _task_id) THEN
    RETURN jsonb_build_object('ok', true, 'next', v_task.node_id, 'waiting_siblings', true,
                              'correlation_id', v_correlation);
  END IF;

  v_next_id := public.wf_advance_from_node(v_task.run_id, v_task.document_id, v_task.node_id, v_nodes, v_edges);

  RETURN jsonb_build_object('ok', true, 'next', v_next_id, 'correlation_id', v_correlation);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.wf_run_graph(public.workflow_runs) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wf_run_graph(public.workflow_runs) TO service_role;
