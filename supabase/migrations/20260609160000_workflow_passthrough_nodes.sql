-- Auto-advance gateway nodes; fail loudly when actionable nodes have no assignees

CREATE OR REPLACE FUNCTION public.wf_activate_node(
  _run_id uuid, _doc_id uuid, _node_id text, _nodes jsonb, _edges jsonb, _depth int DEFAULT 0
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_node jsonb;
  v_type text;
  e jsonb;
  v_target text;
  v_result text;
  v_first text;
  v_has_tasks boolean;
BEGIN
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
    v_first := NULL;
    FOR e IN SELECT elem FROM jsonb_array_elements(_edges) AS elem WHERE elem->>'source' = _node_id LOOP
      v_target := e->>'target';
      v_result := public.wf_activate_node(_run_id, _doc_id, v_target, _nodes, _edges, _depth + 1);
      IF v_first IS NULL THEN v_first := v_result; END IF;
    END LOOP;
    RETURN COALESCE(v_first, _node_id);
  END IF;

  IF v_type = 'FORK' THEN
    v_first := NULL;
    FOR e IN SELECT elem FROM jsonb_array_elements(_edges) AS elem WHERE elem->>'source' = _node_id LOOP
      v_target := e->>'target';
      v_result := public.wf_activate_node(_run_id, _doc_id, v_target, _nodes, _edges, _depth + 1);
      IF v_first IS NULL THEN v_first := v_result; END IF;
    END LOOP;
    UPDATE public.workflow_runs SET current_node = _node_id WHERE id = _run_id;
    RETURN COALESCE(v_first, _node_id);
  END IF;

  -- Passthrough: START, CONDITION, TIMER, ESCALATION — advance immediately
  IF v_type IN ('START', 'CONDITION', 'TIMER', 'ESCALATION') THEN
    v_first := NULL;
    FOR e IN SELECT elem FROM jsonb_array_elements(_edges) AS elem WHERE elem->>'source' = _node_id LOOP
      v_target := e->>'target';
      v_result := public.wf_activate_node(_run_id, _doc_id, v_target, _nodes, _edges, _depth + 1);
      IF v_first IS NULL THEN v_first := v_result; END IF;
    END LOOP;
    UPDATE public.workflow_runs SET current_node = COALESCE(v_first, _node_id) WHERE id = _run_id;
    RETURN COALESCE(v_first, _node_id);
  END IF;

  -- NOTIFICATION: optional tasks, then auto-advance
  IF v_type = 'NOTIFICATION' THEN
    PERFORM public.wf_create_tasks_for_node(_run_id, _doc_id, v_node, _node_id);
    v_first := NULL;
    FOR e IN SELECT elem FROM jsonb_array_elements(_edges) AS elem WHERE elem->>'source' = _node_id LOOP
      v_target := e->>'target';
      v_result := public.wf_activate_node(_run_id, _doc_id, v_target, _nodes, _edges, _depth + 1);
      IF v_first IS NULL THEN v_first := v_result; END IF;
    END LOOP;
    UPDATE public.workflow_runs SET current_node = COALESCE(v_first, _node_id) WHERE id = _run_id;
    RETURN COALESCE(v_first, _node_id);
  END IF;

  -- Actionable nodes: must create at least one pending task
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
