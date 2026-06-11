-- Align assignee resolution with app-owned auth (profiles) and designer node shape
-- (assignee_type, nested data.assignee_id, initiator mode).

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

CREATE OR REPLACE FUNCTION public.wf_create_tasks_for_node(
  _run_id uuid, _doc_id uuid, _node jsonb, _node_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text := COALESCE(_node->'data'->>'type', _node->>'type', 'TASK');
  v_assignees uuid[];
  v_sla int;
  v_sla_unit text := COALESCE(_node->'data'->>'sla_unit', _node->>'sla_unit', 'hours');
  v_sla_days int;
  v_label text := COALESCE(_node->>'label', _node->'data'->>'label', v_type);
BEGIN
  IF v_type NOT IN ('APPROVAL','SIGNATURE','TASK','NOTIFICATION') THEN
    RETURN;
  END IF;

  v_assignees := public.resolve_workflow_assignees(_node, _doc_id);

  v_sla := public.wf_node_sla_hours(_node);
  v_sla_days := COALESCE(
    (_node->'data'->>'sla_hours')::int,
    (_node->>'sla_hours')::int
  );

  IF v_assignees IS NOT NULL AND array_length(v_assignees, 1) > 0 THEN
    INSERT INTO public.workflow_tasks(run_id, document_id, node_id, node_type, title, assignee_id, action_required, due_at)
    SELECT _run_id, _doc_id, _node_id, v_type,
           v_label, a,
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
    SELECT a, 'task', 'Новая задача: ' || v_label, NULL,
           '/documents/' || _doc_id
      FROM unnest(v_assignees) a;
  END IF;
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

REVOKE EXECUTE ON FUNCTION public.resolve_workflow_assignees(jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_workflow_assignees(jsonb, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.wf_create_tasks_for_node(uuid, uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wf_create_tasks_for_node(uuid, uuid, jsonb, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.wf_activate_node(uuid, uuid, text, jsonb, jsonb, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wf_activate_node(uuid, uuid, text, jsonb, jsonb, int) TO service_role;
