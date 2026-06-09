-- EDMS workflow standards: edge conditions, exclusive gateway, SLA units, group assignees

CREATE OR REPLACE FUNCTION public.wf_document_field_value(_field text, _doc_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE _field
    WHEN 'status' THEN d.status::text
    WHEN 'doc_type' THEN COALESCE(d.doc_type, '')
    WHEN 'document_type_code' THEN COALESCE(dt.code, '')
    WHEN 'priority_code' THEN COALESCE(p.code, '')
    WHEN 'department_code' THEN COALESCE(dep.code, '')
    WHEN 'legal_hold' THEN d.legal_hold::text
    WHEN 'sla_status' THEN d.sla_status::text
    WHEN 'reg_number' THEN COALESCE(d.reg_number, '')
    ELSE NULL
  END
  FROM public.documents d
  LEFT JOIN public.ref_document_types dt ON dt.id = d.document_type_id
  LEFT JOIN public.ref_priorities p ON p.id = d.priority_id
  LEFT JOIN public.departments dep ON dep.id = d.department_id
  WHERE d.id = _doc_id;
$$;

CREATE OR REPLACE FUNCTION public.wf_eval_edge_condition(_condition text, _doc_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  field text;
  op text;
  val text;
  actual text;
  m text[];
BEGIN
  IF _condition IS NULL OR btrim(_condition) = '' THEN
    RETURN true;
  END IF;

  IF _condition ~ '\.includes\(' THEN
    field := (regexp_match(_condition, '^\s*(\w+)\.includes'))[1];
    val := (regexp_match(_condition, '''([^'']*)'''))[1];
    actual := public.wf_document_field_value(field, _doc_id);
    RETURN COALESCE(actual, '') ILIKE '%' || COALESCE(val, '') || '%';
  END IF;

  IF _condition ~ '\.startsWith\(' THEN
    field := (regexp_match(_condition, '^\s*(\w+)\.startsWith'))[1];
    val := (regexp_match(_condition, '''([^'']*)'''))[1];
    actual := public.wf_document_field_value(field, _doc_id);
    RETURN COALESCE(actual, '') ILIKE COALESCE(val, '') || '%';
  END IF;

  IF _condition ~ '\.endsWith\(' THEN
    field := (regexp_match(_condition, '^\s*(\w+)\.endsWith'))[1];
    val := (regexp_match(_condition, '''([^'']*)'''))[1];
    actual := public.wf_document_field_value(field, _doc_id);
    RETURN COALESCE(actual, '') ILIKE '%' || COALESCE(val, '');
  END IF;

  m := regexp_match(_condition, '^\s*(\w+)\s*(===|!==|>=|<=|>|<)\s*''([^'']*)''\s*$');
  IF m IS NULL THEN
    RETURN false;
  END IF;

  field := m[1];
  op := m[2];
  val := m[3];
  actual := COALESCE(public.wf_document_field_value(field, _doc_id), '');

  CASE op
    WHEN '===' THEN RETURN actual = val;
    WHEN '!==' THEN RETURN actual <> val;
    WHEN '>' THEN
      BEGIN RETURN actual::numeric > val::numeric; EXCEPTION WHEN OTHERS THEN RETURN false; END;
    WHEN '<' THEN
      BEGIN RETURN actual::numeric < val::numeric; EXCEPTION WHEN OTHERS THEN RETURN false; END;
    WHEN '>=' THEN
      BEGIN RETURN actual::numeric >= val::numeric; EXCEPTION WHEN OTHERS THEN RETURN false; END;
    WHEN '<=' THEN
      BEGIN RETURN actual::numeric <= val::numeric; EXCEPTION WHEN OTHERS THEN RETURN false; END;
    ELSE RETURN false;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.wf_get_outgoing_targets(
  _from_node_id text,
  _edges jsonb,
  _doc_id uuid,
  _exclusive boolean DEFAULT false
)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e jsonb;
  matched text[] := '{}';
  default_target text;
  cond text;
  tgt text;
BEGIN
  FOR e IN
    SELECT elem
    FROM jsonb_array_elements(_edges) AS elem
    WHERE elem->>'source' = _from_node_id
    ORDER BY elem->>'label' NULLS LAST, elem->>'id'
  LOOP
    tgt := e->>'target';
    cond := e->>'condition';
    IF cond IS NULL OR btrim(cond) = '' THEN
      IF default_target IS NULL THEN
        default_target := tgt;
      END IF;
    ELSIF public.wf_eval_edge_condition(cond, _doc_id) THEN
      matched := array_append(matched, tgt);
      IF _exclusive THEN
        RETURN matched;
      END IF;
    END IF;
  END LOOP;

  IF array_length(matched, 1) IS NOT NULL AND array_length(matched, 1) > 0 THEN
    RETURN matched;
  END IF;

  IF default_target IS NOT NULL THEN
    RETURN ARRAY[default_target];
  END IF;

  RETURN '{}';
END;
$$;

CREATE OR REPLACE FUNCTION public.wf_node_sla_hours(_node jsonb)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(_node->'data'->>'sla_unit', _node->>'sla_unit') = 'business_days' THEN
      COALESCE(
        (_node->'data'->>'sla_hours')::int,
        (_node->>'sla_hours')::int
      ) * 8
    ELSE COALESCE(
      (_node->'data'->>'sla_hours')::int,
      (_node->>'sla_hours')::int
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_workflow_assignees(_node jsonb, _document uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mode text := COALESCE(_node->'data'->>'assignee_mode', _node->>'assignee_mode', 'user');
  ref text := COALESCE(_node->'data'->>'assignee_ref', _node->>'assignee_ref',
                       _node->'data'->>'assignee_user_id', _node->>'assignee_id');
  initiator uuid;
  dept uuid;
  result uuid[] := '{}'::uuid[];
BEGIN
  SELECT created_by, department_id INTO initiator, dept FROM public.documents WHERE id = _document;

  IF mode = 'user' AND ref IS NOT NULL THEN
    result := ARRAY[ref::uuid];
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

CREATE OR REPLACE FUNCTION public.wf_advance_from_node(
  _run_id uuid, _doc_id uuid, _from_node_id text, _nodes jsonb, _edges jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_type text;
  v_targets text[];
  tgt text;
  v_first text;
  v_result text;
  v_outgoing int;
BEGIN
  PERFORM public.enable_document_status_bypass();

  SELECT COALESCE(n->>'type', 'TASK') INTO v_source_type
    FROM jsonb_array_elements(_nodes) n
   WHERE n->>'id' = _from_node_id
   LIMIT 1;

  SELECT count(*) INTO v_outgoing
    FROM jsonb_array_elements(_edges) e WHERE e->>'source' = _from_node_id;

  IF v_outgoing = 0 THEN
    UPDATE public.workflow_runs SET status='completed'::run_status, completed_at=now(), current_node=NULL WHERE id = _run_id;
    UPDATE public.documents SET status='approved'::document_status WHERE id = _doc_id;
    RETURN NULL;
  END IF;

  IF v_source_type = 'FORK' THEN
    v_targets := public.wf_get_outgoing_targets(_from_node_id, _edges, _doc_id, false);
  ELSE
    v_targets := public.wf_get_outgoing_targets(_from_node_id, _edges, _doc_id, true);
  END IF;

  IF v_targets IS NULL OR array_length(v_targets, 1) IS NULL THEN
    RAISE EXCEPTION 'no matching transition from node %', _from_node_id;
  END IF;

  v_first := NULL;
  FOREACH tgt IN ARRAY v_targets LOOP
    v_result := public.wf_activate_node(_run_id, _doc_id, tgt, _nodes, _edges, 0);
    IF v_first IS NULL THEN v_first := v_result; END IF;
  END LOOP;

  RETURN v_first;
END;
$$;

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
  v_target text;
  v_result text;
  v_first text;
  v_has_tasks boolean;
  v_targets text[];
  tgt text;
BEGIN
  PERFORM public.enable_document_status_bypass();

  IF _depth > 32 THEN
    RAISE EXCEPTION 'workflow graph too deep (cycle?)';
  END IF;

  SELECT n INTO v_node FROM jsonb_array_elements(_nodes) n WHERE n->>'id' = _node_id LIMIT 1;
  IF v_node IS NULL THEN RETURN NULL; END IF;

  v_type := COALESCE(v_node->>'type', 'TASK');

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

  -- Exclusive gateway / passthrough nodes with conditional edges
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
    RAISE EXCEPTION 'workflow node % (%) has no assignees', _node_id, v_type;
  END IF;

  RETURN _node_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.wf_node_parallel_mode(_node jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    _node->'data'->'config'->>'parallel_mode',
    _node->'config'->>'parallel_mode',
    'all'
  );
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
  v_def      jsonb;
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

  IF NOT v_is_system
     AND v_task.assignee_id IS DISTINCT FROM v_actor
     AND NOT public.is_admin(v_actor) THEN
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
                             'system', v_is_system));

  INSERT INTO public.audit_logs(actor_id, entity_type, entity_id, action, after, correlation_id)
  VALUES (v_actor, 'workflow_task', _task_id::text,
          CASE WHEN v_is_system THEN 'workflow.sla_' || _decision
               ELSE 'workflow.' || _decision END,
          jsonb_build_object('decision', _decision, 'comment', _comment,
                             'document_id', v_task.document_id, 'node_id', v_task.node_id,
                             'system', v_is_system),
          v_correlation);

  IF v_run.workflow_id IS NOT NULL THEN
    SELECT definition INTO v_def FROM public.workflows WHERE id = v_run.workflow_id;
  ELSE
    v_def := v_run.context;
  END IF;
  v_nodes := COALESCE(v_def->'nodes','[]'::jsonb);
  v_edges := COALESCE(v_def->'edges','[]'::jsonb);

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

GRANT EXECUTE ON FUNCTION public.wf_document_field_value(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wf_eval_edge_condition(text, uuid) TO authenticated;
