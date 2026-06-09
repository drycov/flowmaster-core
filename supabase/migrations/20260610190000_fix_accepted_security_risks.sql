-- Fix previously accepted security risks: storage, realtime, notifications, profiles, function grants

-- =============================================================================
-- 1. Storage — enable RLS + signatures bucket
-- =============================================================================

DO $do$
BEGIN
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'storage.objects RLS managed by platform owner';
END $do$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'signatures',
  'signatures',
  false,
  10485760,
  ARRAY['application/pkcs7-mime', 'application/octet-stream', 'text/plain']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Re-assert document / template / avatar policies (idempotent)
DROP POLICY IF EXISTS "signatures_participant_select" ON storage.objects;
DROP POLICY IF EXISTS "signatures_participant_insert" ON storage.objects;
DROP POLICY IF EXISTS "signatures_participant_update" ON storage.objects;
DROP POLICY IF EXISTS "signatures_participant_delete" ON storage.objects;

CREATE POLICY "signatures_participant_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'signatures'
    AND public.user_can_access_document(
      auth.uid(),
      (split_part(name, '/', 1))::uuid
    )
  );

CREATE POLICY "signatures_participant_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'signatures'
    AND public.user_can_access_document(
      auth.uid(),
      (split_part(name, '/', 1))::uuid
    )
  );

CREATE POLICY "signatures_participant_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'signatures'
    AND public.user_can_access_document(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "signatures_participant_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'signatures'
    AND public.user_can_access_document(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

-- =============================================================================
-- 2. Notifications — restrict direct INSERT to own inbox
-- =============================================================================

DROP POLICY IF EXISTS "notif_insert_auth" ON public.notifications;
CREATE POLICY "notif_insert_own" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid,
  _type text,
  _title text,
  _body text DEFAULT NULL,
  _link text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _actor uuid := auth.uid();
BEGIN
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF _user_id IS DISTINCT FROM _actor
     AND NOT public.is_admin(_actor)
     AND NOT public.user_has_permission(_actor, 'register_documents')
     AND NOT public.user_has_permission(_actor, 'manage_workflows')
     AND NOT EXISTS (
       SELECT 1
       FROM public.workflow_tasks t
       JOIN public.documents d ON d.id = t.document_id
       WHERE t.assignee_id = _actor
         AND t.status = 'pending'
         AND public.can_manage_document_workflow(d.id, _actor)
     ) THEN
    RAISE EXCEPTION 'cannot create notification for another user';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (_user_id, _type, _title, _body, _link)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) TO authenticated;

-- =============================================================================
-- 3. Profiles — directory visibility for document collaborators
-- =============================================================================

DROP POLICY IF EXISTS "profiles_select_directory" ON public.profiles;
CREATE POLICY "profiles_select_directory" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE public.can_view_document(d.id, auth.uid())
        AND (d.created_by = profiles.id OR d.assigned_to = profiles.id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.workflow_tasks t
      WHERE t.assignee_id = profiles.id
        AND public.can_view_document(t.document_id, auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.workflow_tasks t_me
      JOIN public.workflow_tasks t_peer ON t_me.document_id = t_peer.document_id
      WHERE t_me.assignee_id = auth.uid()
        AND t_peer.assignee_id = profiles.id
    )
  );

-- =============================================================================
-- 4. Realtime — authorize private channel topics
-- =============================================================================

DO $do$
BEGIN
  ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'realtime.messages RLS managed by platform owner';
  WHEN undefined_table THEN
    RAISE NOTICE 'realtime.messages not available';
END $do$;

DROP POLICY IF EXISTS "realtime_select_doc_channels" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_select_notif_shell" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_insert_deny_clients" ON realtime.messages;

CREATE POLICY "realtime_select_doc_channels"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    split_part(realtime.topic(), ':', 1) = 'doc'
    AND public.can_view_document(
      NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid,
      auth.uid()
    )
  );

CREATE POLICY "realtime_select_notif_shell"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    realtime.topic() = 'notif-shell'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "realtime_insert_deny_clients"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (false);

-- =============================================================================
-- 5. Revoke dangerous SECURITY DEFINER EXECUTE from anon/authenticated
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.hash_password(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_password(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.register_app_user(text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.authenticate_app_user(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.change_app_user_password(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_app_role(uuid, public.app_role, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_documents() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enable_document_status_bypass() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wf_activate_node(uuid, uuid, text, jsonb, jsonb, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wf_advance_from_node(uuid, uuid, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wf_create_tasks_for_node(uuid, uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.app_sla_tick() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.hash_password(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_password(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_app_user(text, text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.authenticate_app_user(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.change_app_user_password(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_app_role(uuid, public.app_role, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.app_sla_tick() TO service_role;
