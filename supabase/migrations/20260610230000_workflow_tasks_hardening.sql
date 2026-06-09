-- Workflow engine hardening: passthrough nodes, return status, signature sync

ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'returned';

CREATE OR REPLACE FUNCTION public.wf_activate_node(
  _run_id uuid, _doc_id uuid, _node_id text, _nodes jsonb, _edges jsonb, _depth int DEFAULT 0
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_node jsonb;
  v_type text;
  e jsonb;
  v_target text;
  v_result text;
  v_first text;
  v_has_tasks boolean;
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

  -- Passthrough gateway / system nodes
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

  IF public.wf_has_pending_siblings(v_task.run_id, v_task.node_id, _task_id) THEN
    RETURN jsonb_build_object('ok', true, 'next', v_task.node_id, 'waiting_siblings', true,
                              'correlation_id', v_correlation);
  END IF;

  v_next_id := public.wf_advance_from_node(v_task.run_id, v_task.document_id, v_task.node_id, v_nodes, v_edges);

  RETURN jsonb_build_object('ok', true, 'next', v_next_id, 'correlation_id', v_correlation);
END;
$function$;
