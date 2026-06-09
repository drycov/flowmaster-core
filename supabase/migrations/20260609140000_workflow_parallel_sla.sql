-- Workflow engine v2: parallel branches (FORK/JOIN), context column, SLA correlation + cooldown

ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS context jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.workflow_runs
  ALTER COLUMN workflow_id DROP NOT NULL;

-- Read node SLA/config from either data.config or root config (designer compatibility)
CREATE OR REPLACE FUNCTION public.wf_node_timeout_action(_node jsonb)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(
    _node->'data'->'config'->>'timeout_action',
    _node->'config'->>'timeout_action',
    _node->'data'->>'timeout_action',
    'notify'
  );
$$;

CREATE OR REPLACE FUNCTION public.wf_node_escalation_role(_node jsonb)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(
    _node->'data'->'config'->>'escalation_role',
    _node->'config'->>'escalation_role',
    _node->'data'->>'escalation_role'
  );
$$;

CREATE OR REPLACE FUNCTION public.wf_node_max_escalations(_node jsonb)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(
    (_node->'data'->'config'->>'max_escalations')::int,
    (_node->'config'->>'max_escalations')::int,
    5
  );
$$;

CREATE OR REPLACE FUNCTION public.wf_node_sla_repeat_hours(_node jsonb)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(
    (_node->'data'->'config'->>'sla_repeat_hours')::int,
    (_node->'config'->>'sla_repeat_hours')::int,
    24
  );
$$;

CREATE OR REPLACE FUNCTION public.wf_node_sla_hours(_node jsonb)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(
    (_node->'data'->>'sla_hours')::int,
    (_node->>'sla_hours')::int
  );
$$;

-- Pending sibling tasks at the same node (multi-assignee gate)
CREATE OR REPLACE FUNCTION public.wf_has_pending_siblings(_run_id uuid, _node_id text, _exclude_task uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workflow_tasks
     WHERE run_id = _run_id AND node_id = _node_id
       AND status = 'pending' AND id <> _exclude_task
  );
$$;

-- All immediate predecessors of JOIN have no pending tasks
CREATE OR REPLACE FUNCTION public.wf_join_predecessors_done(_run_id uuid, _join_id text, _edges jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e jsonb;
  src text;
BEGIN
  FOR e IN SELECT * FROM jsonb_array_elements(_edges) LOOP
    IF e->>'target' = _join_id THEN
      src := e->>'source';
      IF EXISTS (
        SELECT 1 FROM public.workflow_tasks
         WHERE run_id = _run_id AND node_id = src AND status = 'pending'
      ) THEN
        RETURN false;
      END IF;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

-- Create tasks for an actionable node
CREATE OR REPLACE FUNCTION public.wf_create_tasks_for_node(
  _run_id uuid, _doc_id uuid, _node jsonb, _node_id text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_type text := COALESCE(_node->>'type', 'TASK');
  v_assignees uuid[];
  v_sla int;
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

  IF v_assignees IS NOT NULL AND array_length(v_assignees,1) > 0 THEN
    INSERT INTO public.workflow_tasks(run_id, document_id, node_id, node_type, title, assignee_id, action_required, due_at)
    SELECT _run_id, _doc_id, _node_id, v_type,
           COALESCE(_node->>'label', v_type), a,
           CASE v_type WHEN 'SIGNATURE' THEN 'sign' WHEN 'APPROVAL' THEN 'approve' ELSE 'review' END,
           CASE WHEN v_sla IS NOT NULL THEN now() + (v_sla || ' hours')::interval ELSE NULL END
      FROM unnest(v_assignees) a;

    INSERT INTO public.notifications(user_id, type, title, body, link)
    SELECT a, 'task', 'Новая задача: ' || COALESCE(_node->>'label', v_type), NULL,
           '/documents/' || _doc_id
      FROM unnest(v_assignees) a;
  END IF;
END;
$$;

-- Activate a node (handles FORK/JOIN gateways recursively)
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

  UPDATE public.workflow_runs SET current_node = _node_id WHERE id = _run_id;
  PERFORM public.wf_create_tasks_for_node(_run_id, _doc_id, v_node, _node_id);
  RETURN _node_id;
END;
$$;

-- Advance from completed node to downstream targets
CREATE OR REPLACE FUNCTION public.wf_advance_from_node(
  _run_id uuid, _doc_id uuid, _from_node_id text, _nodes jsonb, _edges jsonb
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e jsonb;
  v_target text;
  v_first text;
  v_result text;
  v_outgoing int;
BEGIN
  SELECT count(*) INTO v_outgoing
    FROM jsonb_array_elements(_edges) e WHERE e->>'source' = _from_node_id;

  IF v_outgoing = 0 THEN
    UPDATE public.workflow_runs SET status='completed'::run_status, completed_at=now(), current_node=NULL WHERE id = _run_id;
    UPDATE public.documents SET status='approved'::document_status WHERE id = _doc_id;
    RETURN NULL;
  END IF;

  v_first := NULL;
  FOR e IN SELECT elem FROM jsonb_array_elements(_edges) AS elem WHERE elem->>'source' = _from_node_id LOOP
    v_target := e->>'target';
    v_result := public.wf_activate_node(_run_id, _doc_id, v_target, _nodes, _edges, 0);
    IF v_first IS NULL THEN v_first := v_result; END IF;
  END LOOP;

  RETURN v_first;
END;
$$;

-- Main advance RPC with parallel branch support + correlation passthrough
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

  -- Cancel sibling pending tasks on reject/return
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
    UPDATE public.documents SET status='draft'::document_status WHERE id = v_task.document_id;
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (v_initiator, 'task', 'Документ возвращён на доработку', COALESCE(_comment,''),
            '/documents/' || v_task.document_id);
    RETURN jsonb_build_object('ok', true, 'next', null, 'correlation_id', v_correlation);
  END IF;

  -- Multi-assignee gate: wait for sibling tasks at same node
  IF public.wf_has_pending_siblings(v_task.run_id, v_task.node_id, _task_id) THEN
    RETURN jsonb_build_object('ok', true, 'next', v_task.node_id, 'waiting_siblings', true,
                              'correlation_id', v_correlation);
  END IF;

  v_next_id := public.wf_advance_from_node(v_task.run_id, v_task.document_id, v_task.node_id, v_nodes, v_edges);

  RETURN jsonb_build_object('ok', true, 'next', v_next_id, 'correlation_id', v_correlation);
END $function$;

-- SLA tick v2: config path fix, cooldown, max escalations, shared correlation_id
CREATE OR REPLACE FUNCTION public.app_sla_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t public.workflow_tasks%ROWTYPE;
  v_def jsonb;
  v_node jsonb;
  v_action text;
  v_esc_role text;
  v_correlation uuid;
  v_manager uuid;
  v_role_users uuid[];
  v_max_esc int;
  v_repeat_h int;
  v_processed int := 0;
  v_notified int := 0;
  v_reassigned int := 0;
  v_auto int := 0;
  v_skipped int := 0;
BEGIN
  FOR t IN
    SELECT * FROM public.workflow_tasks
     WHERE status = 'pending'
       AND due_at IS NOT NULL
       AND due_at < now()
     ORDER BY due_at
     LIMIT 200
  LOOP
    SELECT COALESCE(w.definition, r.context) INTO v_def
      FROM public.workflow_runs r
      LEFT JOIN public.workflows w ON w.id = r.workflow_id
     WHERE r.id = t.run_id;

    SELECT n INTO v_node FROM jsonb_array_elements(COALESCE(v_def->'nodes','[]'::jsonb)) n
     WHERE n->>'id' = t.node_id LIMIT 1;

    v_action := public.wf_node_timeout_action(v_node);
    v_esc_role := public.wf_node_escalation_role(v_node);
    v_max_esc := public.wf_node_max_escalations(v_node);
    v_repeat_h := public.wf_node_sla_repeat_hours(v_node);
    v_correlation := gen_random_uuid();

    -- Cooldown between repeat escalations
    IF t.last_sla_check IS NOT NULL
       AND t.last_sla_check > now() - (v_repeat_h || ' hours')::interval THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF t.escalation_level >= v_max_esc THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_processed := v_processed + 1;

    IF v_action IN ('approve', 'reject') THEN
      BEGIN
        PERFORM public.app_advance_workflow_task(t.id, v_action,
          'SLA авто-' || v_action || ' (просрочка, уровень ' || (t.escalation_level + 1) || ')',
          v_correlation);
        v_auto := v_auto + 1;
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.audit_logs(actor_id, entity_type, entity_id, action, after, correlation_id)
        VALUES (NULL, 'workflow_task', t.id::text, 'workflow.sla_error',
                jsonb_build_object('error', SQLERRM, 'action', v_action), v_correlation);
      END;
      CONTINUE;
    END IF;

    IF v_action = 'reassign' AND v_esc_role IS NOT NULL THEN
      SELECT array_agg(DISTINCT g.user_id) INTO v_role_users
        FROM public.user_role_grants g
        JOIN public.roles r ON r.id = g.role_id
       WHERE r.code = v_esc_role AND g.revoked_at IS NULL
         AND (g.expires_at IS NULL OR g.expires_at > now());

      IF v_role_users IS NOT NULL AND array_length(v_role_users,1) > 0 THEN
        INSERT INTO public.workflow_tasks(run_id, document_id, node_id, node_type, title,
                                          assignee_id, action_required, due_at, escalation_level)
        SELECT t.run_id, t.document_id, t.node_id, t.node_type,
               '[Эскалация L' || (t.escalation_level + 1) || '] ' || t.title, a, t.action_required,
               now() + (v_repeat_h || ' hours')::interval, t.escalation_level + 1
          FROM unnest(v_role_users) a
         WHERE NOT EXISTS (
           SELECT 1 FROM public.workflow_tasks et
            WHERE et.run_id = t.run_id AND et.node_id = t.node_id
              AND et.assignee_id = a AND et.status = 'pending'
              AND et.title LIKE '[Эскалация%'
         );

        INSERT INTO public.notifications(user_id, type, title, body, link)
        SELECT a, 'task',
               'Эскалация задачи: ' || t.title,
               'Срок исполнения просрочен (уровень ' || (t.escalation_level + 1) || ')',
               '/documents/' || t.document_id
          FROM unnest(v_role_users) a;

        v_reassigned := v_reassigned + 1;
      END IF;
    END IF;

    IF t.assignee_id IS NOT NULL AND v_action IN ('notify', 'reassign') THEN
      INSERT INTO public.notifications(user_id, type, title, body, link)
      VALUES (t.assignee_id, 'task',
              'Просрочка задачи: ' || t.title,
              'Срок исполнения истёк ' || to_char(t.due_at, 'DD.MM.YYYY HH24:MI'),
              '/documents/' || t.document_id);

      v_manager := public.user_manager(t.assignee_id);
      IF v_manager IS NOT NULL AND v_manager <> t.assignee_id THEN
        INSERT INTO public.notifications(user_id, type, title, body, link)
        VALUES (v_manager, 'task',
                'Просрочка у подчинённого: ' || t.title,
                'Задача просрочена',
                '/documents/' || t.document_id);
      END IF;
      v_notified := v_notified + 1;
    END IF;

    INSERT INTO public.audit_logs(actor_id, entity_type, entity_id, action, after, correlation_id)
    VALUES (NULL, 'workflow_task', t.id::text, 'workflow.sla_escalated',
            jsonb_build_object('action', v_action, 'escalation_role', v_esc_role,
                               'document_id', t.document_id, 'node_id', t.node_id,
                               'due_at', t.due_at, 'level', t.escalation_level + 1,
                               'max_escalations', v_max_esc),
            v_correlation);

    INSERT INTO public.workflow_events(run_id, document_id, event_type, node_id, actor_id, payload)
    VALUES (t.run_id, t.document_id, 'task.sla_escalated', t.node_id, NULL,
            jsonb_build_object('correlation_id', v_correlation, 'action', v_action,
                               'level', t.escalation_level + 1));

    UPDATE public.workflow_tasks
       SET escalation_level = escalation_level + 1,
           escalated_at = now(),
           last_sla_check = now()
     WHERE id = t.id;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'notified', v_notified,
    'reassigned', v_reassigned,
    'auto_decided', v_auto,
    'skipped_cooldown', v_skipped,
    'at', now()
  );
END $$;

GRANT EXECUTE ON FUNCTION public.app_advance_workflow_task(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wf_activate_node(uuid, uuid, text, jsonb, jsonb, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wf_advance_from_node(uuid, uuid, text, jsonb, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.app_sla_tick() FROM public;
GRANT EXECUTE ON FUNCTION public.app_sla_tick() TO service_role;
