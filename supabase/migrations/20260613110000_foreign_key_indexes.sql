-- Address Supabase database linter: unindexed foreign keys (lint 0001).
-- https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

-- api_keys
CREATE INDEX IF NOT EXISTS idx_api_keys_created_by ON public.api_keys (created_by);

-- departments
CREATE INDEX IF NOT EXISTS idx_departments_head_user_id ON public.departments (head_user_id);
CREATE INDEX IF NOT EXISTS idx_departments_parent_id ON public.departments (parent_id);

-- document_access_grants
CREATE INDEX IF NOT EXISTS idx_document_access_grants_requested_by ON public.document_access_grants (requested_by);
CREATE INDEX IF NOT EXISTS idx_document_access_grants_reviewed_by ON public.document_access_grants (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_document_access_grants_user_id ON public.document_access_grants (user_id);

-- document_comments
CREATE INDEX IF NOT EXISTS idx_document_comments_author_id ON public.document_comments (author_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_parent_id ON public.document_comments (parent_id);

-- document_links
CREATE INDEX IF NOT EXISTS idx_document_links_created_by ON public.document_links (created_by);

-- document_project_templates
CREATE INDEX IF NOT EXISTS idx_document_project_templates_default_workflow_id
  ON public.document_project_templates (default_workflow_id);
CREATE INDEX IF NOT EXISTS idx_document_project_templates_template_id
  ON public.document_project_templates (template_id);

-- document_projects
CREATE INDEX IF NOT EXISTS idx_document_projects_department_id ON public.document_projects (department_id);
CREATE INDEX IF NOT EXISTS idx_document_projects_nomenclature_id ON public.document_projects (nomenclature_id);
CREATE INDEX IF NOT EXISTS idx_document_projects_owner_id ON public.document_projects (owner_id);

-- document_signatures
CREATE INDEX IF NOT EXISTS idx_document_signatures_signer_id ON public.document_signatures (signer_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_version_id ON public.document_signatures (version_id);

-- document_templates
CREATE INDEX IF NOT EXISTS idx_document_templates_created_by ON public.document_templates (created_by);
CREATE INDEX IF NOT EXISTS idx_document_templates_default_workflow_id ON public.document_templates (default_workflow_id);

-- document_versions
CREATE INDEX IF NOT EXISTS idx_document_versions_created_by ON public.document_versions (created_by);

-- documents
CREATE INDEX IF NOT EXISTS idx_documents_access_level_id ON public.documents (access_level_id);
CREATE INDEX IF NOT EXISTS idx_documents_archive_location_id ON public.documents (archive_location_id);
CREATE INDEX IF NOT EXISTS idx_documents_delivery_method_id ON public.documents (delivery_method_id);
CREATE INDEX IF NOT EXISTS idx_documents_department_id ON public.documents (department_id);
CREATE INDEX IF NOT EXISTS idx_documents_legal_hold_by ON public.documents (legal_hold_by);
CREATE INDEX IF NOT EXISTS idx_documents_nomenclature_id ON public.documents (nomenclature_id);
CREATE INDEX IF NOT EXISTS idx_documents_retention_period_id ON public.documents (retention_period_id);
CREATE INDEX IF NOT EXISTS idx_documents_template_id ON public.documents (template_id);
CREATE INDEX IF NOT EXISTS idx_documents_workflow_id ON public.documents (workflow_id);

-- duty_assignments
CREATE INDEX IF NOT EXISTS idx_duty_assignments_created_by ON public.duty_assignments (created_by);
CREATE INDEX IF NOT EXISTS idx_duty_assignments_department_id ON public.duty_assignments (department_id);
CREATE INDEX IF NOT EXISTS idx_duty_assignments_duty_role_id ON public.duty_assignments (duty_role_id);
CREATE INDEX IF NOT EXISTS idx_duty_assignments_substitute_id ON public.duty_assignments (substitute_id);

-- duty_reminder_log
CREATE INDEX IF NOT EXISTS idx_duty_reminder_log_user_id ON public.duty_reminder_log (user_id);

-- email_outbox
CREATE INDEX IF NOT EXISTS idx_email_outbox_notification_id ON public.email_outbox (notification_id);
CREATE INDEX IF NOT EXISTS idx_email_outbox_user_id ON public.email_outbox (user_id);

-- import_jobs
CREATE INDEX IF NOT EXISTS idx_import_jobs_api_key_id ON public.import_jobs (api_key_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_by ON public.import_jobs (created_by);

-- installation_license
CREATE INDEX IF NOT EXISTS idx_installation_license_activated_by ON public.installation_license (activated_by);

-- kb_articles
CREATE INDEX IF NOT EXISTS idx_kb_articles_access_level_id ON public.kb_articles (access_level_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_author_id ON public.kb_articles (author_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_category_id ON public.kb_articles (category_id);

-- kb_categories
CREATE INDEX IF NOT EXISTS idx_kb_categories_parent_id ON public.kb_categories (parent_id);

-- leave_requests
CREATE INDEX IF NOT EXISTS idx_leave_requests_absence_type_id ON public.leave_requests (absence_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_document_id ON public.leave_requests (document_id);

-- nomenclature_items
CREATE INDEX IF NOT EXISTS idx_nomenclature_items_department_id ON public.nomenclature_items (department_id);
CREATE INDEX IF NOT EXISTS idx_nomenclature_items_parent_id ON public.nomenclature_items (parent_id);

-- organization
CREATE INDEX IF NOT EXISTS idx_organization_head_user_id ON public.organization (head_user_id);

-- positions
CREATE INDEX IF NOT EXISTS idx_positions_department_id ON public.positions (department_id);

-- profile_assignments
CREATE INDEX IF NOT EXISTS idx_profile_assignments_created_by ON public.profile_assignments (created_by);
CREATE INDEX IF NOT EXISTS idx_profile_assignments_department_id ON public.profile_assignments (department_id);
CREATE INDEX IF NOT EXISTS idx_profile_assignments_manager_user_id ON public.profile_assignments (manager_user_id);
CREATE INDEX IF NOT EXISTS idx_profile_assignments_position_id ON public.profile_assignments (position_id);

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_access_level_id ON public.profiles (access_level_id);
CREATE INDEX IF NOT EXISTS idx_profiles_department_id ON public.profiles (department_id);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles (organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_position_id ON public.profiles (position_id);

-- ref_archive_locations
CREATE INDEX IF NOT EXISTS idx_ref_archive_locations_parent_id ON public.ref_archive_locations (parent_id);

-- ref_duty_roles
CREATE INDEX IF NOT EXISTS idx_ref_duty_roles_department_id ON public.ref_duty_roles (department_id);

-- ref_registration_journals
CREATE INDEX IF NOT EXISTS idx_ref_registration_journals_department_id ON public.ref_registration_journals (department_id);
CREATE INDEX IF NOT EXISTS idx_ref_registration_journals_document_type_id
  ON public.ref_registration_journals (document_type_id);

-- role_permissions
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_code ON public.role_permissions (permission_code);

-- roles
CREATE INDEX IF NOT EXISTS idx_roles_parent_role_id ON public.roles (parent_role_id);
CREATE INDEX IF NOT EXISTS idx_roles_scope_department_id ON public.roles (scope_department_id);

-- schedule_plan_items
CREATE INDEX IF NOT EXISTS idx_schedule_plan_items_assignee_id ON public.schedule_plan_items (assignee_id);
CREATE INDEX IF NOT EXISTS idx_schedule_plan_items_depends_on_id ON public.schedule_plan_items (depends_on_id);
CREATE INDEX IF NOT EXISTS idx_schedule_plan_items_parent_id ON public.schedule_plan_items (parent_id);

-- schedule_plans
CREATE INDEX IF NOT EXISTS idx_schedule_plans_department_id ON public.schedule_plans (department_id);
CREATE INDEX IF NOT EXISTS idx_schedule_plans_owner_id ON public.schedule_plans (owner_id);
CREATE INDEX IF NOT EXISTS idx_schedule_plans_project_id ON public.schedule_plans (project_id);

-- telegram_link_tokens
CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_user_id ON public.telegram_link_tokens (user_id);

-- telegram_outbox
CREATE INDEX IF NOT EXISTS idx_telegram_outbox_notification_id ON public.telegram_outbox (notification_id);
CREATE INDEX IF NOT EXISTS idx_telegram_outbox_user_id ON public.telegram_outbox (user_id);

-- telegram_pending_actions
CREATE INDEX IF NOT EXISTS idx_telegram_pending_actions_user_id ON public.telegram_pending_actions (user_id);

-- user_role_grants
CREATE INDEX IF NOT EXISTS idx_user_role_grants_granted_by ON public.user_role_grants (granted_by);
CREATE INDEX IF NOT EXISTS idx_user_role_grants_revoked_by ON public.user_role_grants (revoked_by);
CREATE INDEX IF NOT EXISTS idx_user_role_grants_role_id ON public.user_role_grants (role_id);
CREATE INDEX IF NOT EXISTS idx_user_role_grants_scope_department_id ON public.user_role_grants (scope_department_id);

-- user_substitutions
CREATE INDEX IF NOT EXISTS idx_user_substitutions_created_by ON public.user_substitutions (created_by);

-- webhook_outbox
CREATE INDEX IF NOT EXISTS idx_webhook_outbox_subscription_id ON public.webhook_outbox (subscription_id);

-- webhook_subscriptions
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_created_by ON public.webhook_subscriptions (created_by);

-- work_time_entries
CREATE INDEX IF NOT EXISTS idx_work_time_entries_approver_id ON public.work_time_entries (approver_id);
CREATE INDEX IF NOT EXISTS idx_work_time_entries_project_id ON public.work_time_entries (project_id);

-- workflow_events
CREATE INDEX IF NOT EXISTS idx_workflow_events_actor_id ON public.workflow_events (actor_id);
CREATE INDEX IF NOT EXISTS idx_workflow_events_run_id ON public.workflow_events (run_id);

-- workflow_runs
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON public.workflow_runs (workflow_id);

-- workflow_tasks
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_delegated_by ON public.workflow_tasks (delegated_by);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_delegated_from ON public.workflow_tasks (delegated_from);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_run_id ON public.workflow_tasks (run_id);

-- workflows
CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON public.workflows (created_by);
