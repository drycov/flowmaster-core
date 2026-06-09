-- Security hardening: audit logs, signatures, document status, workflow inserts

-- =============================================================================
-- 1. Helpers
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enable_document_status_bypass()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.bypass_document_status_guard', 'on', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_document_workflow(_doc_id uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.id = _doc_id
      AND (
        d.created_by = _user
        OR public.is_admin(_user)
        OR public.user_has_permission(_user, 'register_documents')
        OR public.user_has_permission(_user, 'manage_workflows')
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_document_workflow(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enable_document_status_bypass() TO authenticated;

-- =============================================================================
-- 2. Audit logs — no direct INSERT from authenticated users
-- =============================================================================

DROP POLICY IF EXISTS "audit_insert_self" ON public.audit_logs;
REVOKE INSERT ON public.audit_logs FROM authenticated;
REVOKE USAGE, SELECT ON SEQUENCE public.audit_logs_id_seq FROM authenticated;

-- =============================================================================
-- 3. Signatures — require document access + pending sign task
-- =============================================================================

DROP POLICY IF EXISTS "sig_insert_own" ON public.document_signatures;
CREATE POLICY "sig_insert_own" ON public.document_signatures
  FOR INSERT TO authenticated
  WITH CHECK (
    signer_id = auth.uid()
    AND public.can_view_document(document_id, auth.uid())
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.workflow_tasks t
        WHERE t.document_id = document_signatures.document_id
          AND t.assignee_id = auth.uid()
          AND t.status = 'pending'
          AND (
            lower(t.action_required) = 'sign'
            OR upper(t.node_type) = 'SIGNATURE'
          )
      )
    )
  );

-- =============================================================================
-- 4. Workflow runs / tasks — restrict who can start workflows and spawn tasks
-- =============================================================================

DROP POLICY IF EXISTS "wfr_insert_priv" ON public.workflow_runs;
CREATE POLICY "wfr_insert_priv" ON public.workflow_runs
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_document_workflow(document_id, auth.uid()));

DROP POLICY IF EXISTS "wft_insert_priv" ON public.workflow_tasks;
CREATE POLICY "wft_insert_priv" ON public.workflow_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'register_documents')
    OR public.user_has_permission(auth.uid(), 'manage_workflows')
    OR EXISTS (
      SELECT 1
      FROM public.workflow_runs r
      INNER JOIN public.documents d ON d.id = r.document_id
      WHERE r.id = workflow_tasks.run_id
        AND r.status = 'running'
        AND d.created_by = auth.uid()
        AND public.can_manage_document_workflow(d.id, auth.uid())
    )
  );

-- =============================================================================
-- 5. Document status — block direct workflow status bypass
-- =============================================================================

CREATE OR REPLACE FUNCTION public.guard_document_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.bypass_document_status_guard', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled' THEN
    IF OLD.created_by = auth.uid() OR public.is_admin(auth.uid()) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'document status change to cancelled is not allowed';
  END IF;

  IF NEW.status = 'archived' THEN
    IF public.is_admin(auth.uid())
       OR public.user_has_permission(auth.uid(), 'archive_documents') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'document status change to archived is not allowed';
  END IF;

  IF NEW.status = 'in_review' THEN
    IF public.can_manage_document_workflow(OLD.id, auth.uid()) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'document status change to in_review is not allowed';
  END IF;

  IF NEW.status = 'signed' THEN
    IF public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1
      FROM public.workflow_tasks t
      WHERE t.document_id = OLD.id
        AND t.assignee_id = auth.uid()
        AND t.status = 'pending'
        AND (
          lower(t.action_required) = 'sign'
          OR upper(t.node_type) = 'SIGNATURE'
        )
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'document status change to signed is not allowed';
  END IF;

  IF NEW.status = 'draft' THEN
    IF (OLD.created_by = auth.uid() OR OLD.assigned_to = auth.uid() OR public.is_admin(auth.uid()))
       AND OLD.status IN ('draft', 'returned_for_revision', 'rejected') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'document status change to draft is not allowed';
  END IF;

  RAISE EXCEPTION 'document status cannot be changed to % directly; use workflow', NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_document_status ON public.documents;
CREATE TRIGGER trg_guard_document_status
  BEFORE UPDATE OF status ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_document_status_change();

-- =============================================================================
-- 6. Workflow RPCs — bypass status guard inside trusted functions
-- =============================================================================

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

  UPDATE public.workflow_runs SET current_node = _node_id WHERE id = _run_id;
  PERFORM public.wf_create_tasks_for_node(_run_id, _doc_id, v_node, _node_id);
  RETURN _node_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.wf_advance_from_node(
  _run_id uuid, _doc_id uuid, _from_node_id text, _nodes jsonb, _edges jsonb
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e jsonb;
  v_target text;
  v_first text;
  v_result text;
  v_outgoing int;
BEGIN
  PERFORM public.enable_document_status_bypass();

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
    UPDATE public.documents SET status='draft'::document_status WHERE id = v_task.document_id;
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (v_initiator, 'task', 'Документ возвращён на доработку', COALESCE(_comment,''),
            '/documents/' || v_task.document_id);
    RETURN jsonb_build_object('ok', true, 'next', null, 'correlation_id', v_correlation);
  END IF;

  IF public.wf_has_pending_siblings(v_task.run_id, v_task.node_id, _task_id) THEN
    RETURN jsonb_build_object('ok', true, 'next', v_task.node_id, 'waiting_siblings', true,
                              'correlation_id', v_correlation);
  END IF;

  v_next_id := public.wf_advance_from_node(v_task.run_id, v_task.document_id, v_task.node_id, v_nodes, v_edges);

  RETURN jsonb_build_object('ok', true, 'next', v_next_id, 'correlation_id', v_correlation);
END;
$function$;
