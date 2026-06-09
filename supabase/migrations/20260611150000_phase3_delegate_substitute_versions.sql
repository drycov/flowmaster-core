-- Phase 3: task delegation, user substitution, version snapshots

-- Substitutions (замещение)
CREATE TABLE IF NOT EXISTS public.user_substitutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  substitute_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  note text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_substitutions_no_self CHECK (principal_id <> substitute_id)
);

CREATE INDEX IF NOT EXISTS idx_user_substitutions_substitute
  ON public.user_substitutions(substitute_id, is_active, valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_user_substitutions_principal
  ON public.user_substitutions(principal_id, is_active);

GRANT SELECT, INSERT, UPDATE ON public.user_substitutions TO authenticated;
GRANT ALL ON public.user_substitutions TO service_role;
ALTER TABLE public.user_substitutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "us_select_own" ON public.user_substitutions
  FOR SELECT TO authenticated
  USING (
    principal_id = auth.uid()
    OR substitute_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "us_insert_own_or_admin" ON public.user_substitutions
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (principal_id = auth.uid() OR public.is_admin(auth.uid()))
  );

CREATE POLICY "us_update_own_or_admin" ON public.user_substitutions
  FOR UPDATE TO authenticated
  USING (principal_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (principal_id = auth.uid() OR public.is_admin(auth.uid()));

-- Task delegation audit columns
ALTER TABLE public.workflow_tasks
  ADD COLUMN IF NOT EXISTS delegated_from uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delegated_at timestamptz,
  ADD COLUMN IF NOT EXISTS delegated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Version snapshots for diff
ALTER TABLE public.document_versions
  ADD COLUMN IF NOT EXISTS body_snapshot text,
  ADD COLUMN IF NOT EXISTS content_hash text;

CREATE OR REPLACE FUNCTION public.is_active_substitute_for(
  _substitute uuid,
  _principal uuid,
  _at timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_substitutions s
    WHERE s.is_active
      AND s.substitute_id = _substitute
      AND s.principal_id = _principal
      AND s.valid_from <= _at
      AND s.valid_until >= _at
  );
$$;

CREATE OR REPLACE FUNCTION public.can_act_on_workflow_task(_task_id uuid, _user uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignee uuid;
BEGIN
  IF _user IS NULL THEN RETURN false; END IF;
  IF public.is_admin(_user) THEN RETURN true; END IF;

  SELECT assignee_id INTO v_assignee
  FROM public.workflow_tasks WHERE id = _task_id;

  IF v_assignee IS NULL THEN RETURN false; END IF;
  IF v_assignee = _user THEN RETURN true; END IF;

  RETURN public.is_active_substitute_for(_user, v_assignee);
END;
$$;

CREATE OR REPLACE FUNCTION public.delegate_workflow_task(
  _task_id uuid,
  _to_user uuid,
  _comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task public.workflow_tasks%ROWTYPE;
  v_actor uuid := auth.uid();
  v_old_assignee uuid;
BEGIN
  IF _to_user IS NULL THEN
    RAISE EXCEPTION 'delegate target required';
  END IF;

  SELECT * INTO v_task FROM public.workflow_tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'task not found'; END IF;
  IF v_task.status <> 'pending' THEN RAISE EXCEPTION 'task not pending'; END IF;

  IF NOT public.can_act_on_workflow_task(_task_id, v_actor) THEN
    RAISE EXCEPTION 'not allowed to delegate this task';
  END IF;

  v_old_assignee := v_task.assignee_id;
  IF v_old_assignee = _to_user THEN
    RAISE EXCEPTION 'already assigned to this user';
  END IF;

  UPDATE public.workflow_tasks
     SET assignee_id = _to_user,
         delegated_from = v_old_assignee,
         delegated_at = now(),
         delegated_by = v_actor
   WHERE id = _task_id;

  INSERT INTO public.workflow_events(run_id, document_id, event_type, node_id, actor_id, payload)
  VALUES (
    v_task.run_id,
    v_task.document_id,
    'task.delegated',
    v_task.node_id,
    v_actor,
    jsonb_build_object(
      'task_id', _task_id,
      'from_user', v_old_assignee,
      'to_user', _to_user,
      'comment', _comment
    )
  );

  RETURN jsonb_build_object('ok', true, 'assignee_id', _to_user);
END;
$$;

-- Allow assignee, substitute, or admin to complete tasks
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

GRANT EXECUTE ON FUNCTION public.is_active_substitute_for(uuid, uuid, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_act_on_workflow_task(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delegate_workflow_task(uuid, uuid, text) TO authenticated, service_role;
