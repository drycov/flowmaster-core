-- Address Supabase database linter security warnings:
-- search_path on helper functions, leave_requests RLS, avatars listing, RPC grants.

-- =============================================================================
-- 1. Immutable search_path on flagged helper / trigger functions
-- =============================================================================

ALTER FUNCTION public.wf_node_sla_hours(jsonb) SET search_path = public;
ALTER FUNCTION public.wf_node_max_escalations(jsonb) SET search_path = public;
ALTER FUNCTION public.wf_node_sla_repeat_hours(jsonb) SET search_path = public;
ALTER FUNCTION public.wf_node_timeout_action(jsonb) SET search_path = public;
ALTER FUNCTION public.wf_node_escalation_role(jsonb) SET search_path = public;
ALTER FUNCTION public.wf_node_parallel_mode(jsonb) SET search_path = public;
ALTER FUNCTION public.hash_password(text) SET search_path = public, extensions;
ALTER FUNCTION public.verify_password(text, text) SET search_path = public, extensions;
ALTER FUNCTION public.ref_catalog_policies(text, text) SET search_path = public;
ALTER FUNCTION public.is_approval_notification(text, text) SET search_path = public;
ALTER FUNCTION public.license_effective_status(timestamptz, int, text) SET search_path = public;
ALTER FUNCTION public.kb_articles_search_tsv() SET search_path = public;
ALTER FUNCTION public.jwt_organization_id() SET search_path = public;

-- =============================================================================
-- 2. leave_requests — tighten UPDATE WITH CHECK (was always true)
-- =============================================================================

DROP POLICY IF EXISTS "leave_update" ON public.leave_requests;
CREATE POLICY "leave_update" ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'pending')
    OR (approver_id = auth.uid() AND status = 'pending')
    OR public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_hr')
  )
  WITH CHECK (
    (
      user_id = auth.uid()
      AND status IN ('pending', 'cancelled')
    )
    OR (
      approver_id = auth.uid()
      AND status IN ('pending', 'approved', 'rejected', 'cancelled')
    )
    OR public.is_admin(auth.uid())
    OR public.user_has_permission(auth.uid(), 'manage_hr')
  );

-- =============================================================================
-- 3. Avatars — public bucket URLs work without a broad SELECT policy
-- =============================================================================

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;

-- =============================================================================
-- 4. Stop auto-granting EXECUTE on new routines to API roles
-- =============================================================================

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON ROUTINES FROM authenticated;

-- =============================================================================
-- 5. Revoke anon/PUBLIC execute on all public functions, then re-grant service_role
-- =============================================================================

DO $do$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS func
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.func);
  END LOOP;
END $do$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- =============================================================================
-- 6. Revoke authenticated execute on trigger / worker / auth internals only
-- =============================================================================

DO $do$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS func
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname = ANY(ARRAY[
        'audit_trigger',
        'documents_before_ins_upd',
        'documents_retention_before_ins_upd',
        'duty_assignments_notify',
        'guard_document_status_change',
        'leave_requests_after_decision',
        'leave_requests_notify',
        'leave_requests_set_defaults',
        'profile_assignments_after_insert',
        'queue_notification_email',
        'queue_notification_telegram',
        'queue_webhook_event',
        'rls_auto_enable',
        'set_row_organization_id',
        'sync_tenant_mode',
        'trg_webhook_document_signed',
        'trg_webhook_document_status',
        'trg_webhook_task_created',
        'kb_articles_search_tsv',
        'hash_password',
        'verify_password',
        'register_app_user',
        'authenticate_app_user',
        'change_app_user_password',
        'grant_app_role',
        'handle_new_user',
        'audit_documents',
        'claim_email_outbox_batch',
        'claim_telegram_outbox_batch',
        'claim_webhook_outbox_batch',
        'release_stale_outbox_claims',
        'app_retention_tick',
        'app_sla_tick',
        'license_row',
        'license_active_user_count',
        'license_can_add_user',
        'set_license_status',
        'wf_activate_node',
        'wf_advance_from_node',
        'wf_create_tasks_for_node',
        'enable_document_status_bypass'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.func);
  END LOOP;
END $do$;

NOTIFY pgrst, 'reload schema';
