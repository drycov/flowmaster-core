
-- ===== Seed new roles from legacy role_definitions =====
INSERT INTO public.roles (code, name_ru, name_kk, description, kind, is_active, is_system)
SELECT rd.role::text,
       COALESCE(NULLIF(rd.title_ru,''), rd.role::text),
       COALESCE(NULLIF(rd.title_kk,''), rd.role::text),
       COALESCE(rd.description_ru,''),
       'system',
       true,
       true
FROM public.role_definitions rd
ON CONFLICT (code) DO NOTHING;

-- Copy permissions from legacy role_definitions.permissions jsonb into role_permissions
INSERT INTO public.role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM public.role_definitions rd
JOIN public.roles r ON r.code = rd.role::text
JOIN LATERAL jsonb_each_text(rd.permissions) AS perm ON true
JOIN public.permissions p ON p.code = perm.key
WHERE perm.value::boolean = true
ON CONFLICT DO NOTHING;

-- ===== Workflow advance RPC with correlation_id =====
CREATE OR REPLACE FUNCTION public.app_advance_workflow_task(
  _task_id uuid,
  _decision text,
  _comment text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task     public.workflow_tasks%ROWTYPE;
  v_run      public.workflow_runs%ROWTYPE;
  v_def      jsonb;
  v_nodes    jsonb;
  v_edges    jsonb;
  v_next_id  text;
  v_next     jsonb;
  v_next_type text;
  v_doc_status text;
  v_run_status text;
  v_correlation uuid := gen_random_uuid();
  v_actor uuid := auth.uid();
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
  IF v_task.assignee_id IS DISTINCT FROM v_actor AND NOT public.is_admin(v_actor) THEN
    RAISE EXCEPTION 'not the assignee';
  END IF;

  SELECT * INTO v_run FROM public.workflow_runs WHERE id = v_task.run_id FOR UPDATE;
  SELECT created_by INTO v_initiator FROM public.documents WHERE id = v_task.document_id;

  -- Close current task
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
          jsonb_build_object('comment', _comment, 'correlation_id', v_correlation));

  -- Audit row tied via correlation_id
  INSERT INTO public.audit_logs(actor_id, entity_type, entity_id, action, after, correlation_id)
  VALUES (v_actor, 'workflow_task', _task_id::text, 'workflow.' || _decision,
          jsonb_build_object('decision', _decision, 'comment', _comment,
                             'document_id', v_task.document_id, 'node_id', v_task.node_id),
          v_correlation);

  -- Load definition (workflow or custom run context)
  IF v_run.workflow_id IS NOT NULL THEN
    SELECT definition INTO v_def FROM public.workflows WHERE id = v_run.workflow_id;
  ELSE
    -- custom run stored context.nodes/edges
    SELECT context INTO v_def FROM public.workflow_runs WHERE id = v_run.id;
  END IF;
  v_nodes := COALESCE(v_def->'nodes','[]'::jsonb);
  v_edges := COALESCE(v_def->'edges','[]'::jsonb);

  IF _decision = 'reject' THEN
    UPDATE public.workflow_runs
       SET status='cancelled'::run_status, completed_at=now()
     WHERE id = v_run.id;
    UPDATE public.documents SET status='rejected'::document_status WHERE id = v_task.document_id;
    RETURN jsonb_build_object('ok', true, 'next', null, 'correlation_id', v_correlation);
  END IF;

  IF _decision = 'return' THEN
    -- Send back to initiator: cancel run, mark doc draft
    UPDATE public.workflow_runs
       SET status='cancelled'::run_status, completed_at=now()
     WHERE id = v_run.id;
    UPDATE public.documents SET status='draft'::document_status WHERE id = v_task.document_id;
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (v_initiator, 'task',
            'Документ возвращён на доработку',
            COALESCE(_comment,''),
            '/documents/' || v_task.document_id);
    RETURN jsonb_build_object('ok', true, 'next', null, 'correlation_id', v_correlation);
  END IF;

  -- approve: find next node by edges
  SELECT (e->>'target') INTO v_next_id
    FROM jsonb_array_elements(v_edges) e
   WHERE e->>'source' = v_task.node_id
   LIMIT 1;

  IF v_next_id IS NULL THEN
    UPDATE public.workflow_runs
       SET status='completed'::run_status, completed_at=now(), current_node=NULL
     WHERE id = v_run.id;
    UPDATE public.documents SET status='approved'::document_status WHERE id = v_task.document_id;
    RETURN jsonb_build_object('ok', true, 'next', null, 'correlation_id', v_correlation);
  END IF;

  SELECT n INTO v_next FROM jsonb_array_elements(v_nodes) n WHERE n->>'id' = v_next_id LIMIT 1;
  v_next_type := COALESCE(v_next->>'type','TASK');

  IF v_next_type IN ('END','ARCHIVE') THEN
    UPDATE public.workflow_runs
       SET status='completed'::run_status, completed_at=now(), current_node=v_next_id
     WHERE id = v_run.id;
    UPDATE public.documents
       SET status = CASE v_next_type WHEN 'ARCHIVE' THEN 'archived'::document_status ELSE 'approved'::document_status END,
           archived_at = CASE v_next_type WHEN 'ARCHIVE' THEN now() ELSE archived_at END
     WHERE id = v_task.document_id;
    RETURN jsonb_build_object('ok', true, 'next', v_next_id, 'correlation_id', v_correlation);
  END IF;

  UPDATE public.workflow_runs SET current_node = v_next_id WHERE id = v_run.id;

  -- Resolve assignees via existing helper
  v_assignees := public.resolve_workflow_assignees(v_next, v_task.document_id);

  IF array_length(v_assignees,1) IS NULL OR v_assignees[1] IS NULL THEN
    -- fallback: assignee_id field directly
    IF (v_next->>'assignee_id') IS NOT NULL THEN
      v_assignees := ARRAY[(v_next->>'assignee_id')::uuid];
    END IF;
  END IF;

  IF v_assignees IS NOT NULL AND array_length(v_assignees,1) > 0 THEN
    INSERT INTO public.workflow_tasks(run_id, document_id, node_id, node_type, title, assignee_id, action_required, due_at)
    SELECT v_run.id, v_task.document_id, v_next_id, v_next_type,
           COALESCE(v_next->>'label', v_next_type),
           a,
           CASE v_next_type WHEN 'SIGNATURE' THEN 'sign' WHEN 'APPROVAL' THEN 'approve' ELSE 'review' END,
           CASE WHEN (v_next->'data'->>'sla_hours') IS NOT NULL
                THEN now() + ((v_next->'data'->>'sla_hours')::int || ' hours')::interval
                WHEN (v_next->>'sla_hours') IS NOT NULL
                THEN now() + ((v_next->>'sla_hours')::int || ' hours')::interval
                ELSE NULL END
      FROM unnest(v_assignees) a;

    INSERT INTO public.notifications(user_id, type, title, body, link)
    SELECT a, 'task',
           'Новая задача: ' || COALESCE(v_next->>'label', v_next_type),
           NULL,
           '/documents/' || v_task.document_id
      FROM unnest(v_assignees) a;
  END IF;

  RETURN jsonb_build_object('ok', true, 'next', v_next_id, 'correlation_id', v_correlation);
END $$;

GRANT EXECUTE ON FUNCTION public.app_advance_workflow_task(uuid, text, text) TO authenticated;
