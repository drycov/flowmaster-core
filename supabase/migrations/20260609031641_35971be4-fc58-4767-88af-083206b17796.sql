
ALTER TABLE public.workflow_tasks
  ADD COLUMN IF NOT EXISTS escalation_level int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sla_check timestamptz;

CREATE INDEX IF NOT EXISTS idx_wft_overdue
  ON public.workflow_tasks (status, due_at)
  WHERE status = 'pending' AND due_at IS NOT NULL;

-- Allow system context (auth.uid() IS NULL) to call advance for SLA auto-actions
CREATE OR REPLACE FUNCTION public.app_advance_workflow_task(_task_id uuid, _decision text, _comment text DEFAULT NULL::text)
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
  v_next     jsonb;
  v_next_type text;
  v_correlation uuid := gen_random_uuid();
  v_actor uuid := auth.uid();
  v_is_system boolean := (v_actor IS NULL);
  v_event_type text;
  v_assignees uuid[];
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
    SELECT context INTO v_def FROM public.workflow_runs WHERE id = v_run.id;
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

  SELECT (e->>'target') INTO v_next_id
    FROM jsonb_array_elements(v_edges) e
   WHERE e->>'source' = v_task.node_id
   LIMIT 1;

  IF v_next_id IS NULL THEN
    UPDATE public.workflow_runs SET status='completed'::run_status, completed_at=now(), current_node=NULL WHERE id = v_run.id;
    UPDATE public.documents SET status='approved'::document_status WHERE id = v_task.document_id;
    RETURN jsonb_build_object('ok', true, 'next', null, 'correlation_id', v_correlation);
  END IF;

  SELECT n INTO v_next FROM jsonb_array_elements(v_nodes) n WHERE n->>'id' = v_next_id LIMIT 1;
  v_next_type := COALESCE(v_next->>'type','TASK');

  IF v_next_type IN ('END','ARCHIVE') THEN
    UPDATE public.workflow_runs SET status='completed'::run_status, completed_at=now(), current_node=v_next_id WHERE id = v_run.id;
    UPDATE public.documents
       SET status = CASE v_next_type WHEN 'ARCHIVE' THEN 'archived'::document_status ELSE 'approved'::document_status END,
           archived_at = CASE v_next_type WHEN 'ARCHIVE' THEN now() ELSE archived_at END
     WHERE id = v_task.document_id;
    RETURN jsonb_build_object('ok', true, 'next', v_next_id, 'correlation_id', v_correlation);
  END IF;

  UPDATE public.workflow_runs SET current_node = v_next_id WHERE id = v_run.id;

  v_assignees := public.resolve_workflow_assignees(v_next, v_task.document_id);

  IF (v_assignees IS NULL OR array_length(v_assignees,1) IS NULL)
     AND (v_next->>'assignee_id') IS NOT NULL THEN
    v_assignees := ARRAY[(v_next->>'assignee_id')::uuid];
  END IF;

  IF v_assignees IS NOT NULL AND array_length(v_assignees,1) > 0 THEN
    INSERT INTO public.workflow_tasks(run_id, document_id, node_id, node_type, title, assignee_id, action_required, due_at)
    SELECT v_run.id, v_task.document_id, v_next_id, v_next_type,
           COALESCE(v_next->>'label', v_next_type), a,
           CASE v_next_type WHEN 'SIGNATURE' THEN 'sign' WHEN 'APPROVAL' THEN 'approve' ELSE 'review' END,
           CASE WHEN (v_next->'data'->>'sla_hours') IS NOT NULL
                THEN now() + ((v_next->'data'->>'sla_hours')::int || ' hours')::interval
                WHEN (v_next->>'sla_hours') IS NOT NULL
                THEN now() + ((v_next->>'sla_hours')::int || ' hours')::interval
                ELSE NULL END
      FROM unnest(v_assignees) a;

    INSERT INTO public.notifications(user_id, type, title, body, link)
    SELECT a, 'task', 'Новая задача: ' || COALESCE(v_next->>'label', v_next_type), NULL,
           '/documents/' || v_task.document_id
      FROM unnest(v_assignees) a;
  END IF;

  RETURN jsonb_build_object('ok', true, 'next', v_next_id, 'correlation_id', v_correlation);
END $function$;

-- SLA tick: processes overdue pending tasks
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
  v_processed int := 0;
  v_notified int := 0;
  v_reassigned int := 0;
  v_auto int := 0;
BEGIN
  FOR t IN
    SELECT * FROM public.workflow_tasks
     WHERE status = 'pending'
       AND due_at IS NOT NULL
       AND due_at < now()
     ORDER BY due_at
     LIMIT 200
  LOOP
    v_processed := v_processed + 1;

    -- Load node definition
    SELECT COALESCE(w.definition, r.context) INTO v_def
      FROM public.workflow_runs r
      LEFT JOIN public.workflows w ON w.id = r.workflow_id
     WHERE r.id = t.run_id;

    SELECT n INTO v_node FROM jsonb_array_elements(COALESCE(v_def->'nodes','[]'::jsonb)) n
     WHERE n->>'id' = t.node_id LIMIT 1;

    v_action := COALESCE(v_node->'data'->>'timeout_action', 'notify');
    v_esc_role := v_node->'data'->>'escalation_role';
    v_correlation := gen_random_uuid();

    IF v_action = 'approve' OR v_action = 'reject' THEN
      BEGIN
        PERFORM public.app_advance_workflow_task(t.id, v_action,
          'SLA авто-' || v_action || ' (просрочка)');
        v_auto := v_auto + 1;
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.audit_logs(actor_id, entity_type, entity_id, action, after, correlation_id)
        VALUES (NULL, 'workflow_task', t.id::text, 'workflow.sla_error',
                jsonb_build_object('error', SQLERRM), v_correlation);
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
                                          assignee_id, action_required, due_at)
        SELECT t.run_id, t.document_id, t.node_id, t.node_type,
               '[Эскалация] ' || t.title, a, t.action_required,
               now() + interval '24 hours'
          FROM unnest(v_role_users) a;

        INSERT INTO public.notifications(user_id, type, title, body, link)
        SELECT a, 'task',
               'Эскалация задачи: ' || t.title,
               'Срок исполнения просрочен',
               '/documents/' || t.document_id
          FROM unnest(v_role_users) a;

        v_reassigned := v_reassigned + 1;
      END IF;
    END IF;

    -- Notify branch (default + always for notify/reassign)
    IF t.assignee_id IS NOT NULL THEN
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
                               'due_at', t.due_at, 'level', t.escalation_level + 1),
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
    'at', now()
  );
END $$;

REVOKE ALL ON FUNCTION public.app_sla_tick() FROM public;
GRANT EXECUTE ON FUNCTION public.app_sla_tick() TO service_role;
