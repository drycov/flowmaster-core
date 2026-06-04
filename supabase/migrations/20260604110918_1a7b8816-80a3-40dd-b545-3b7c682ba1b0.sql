
-- =============== ENUMS ===============
CREATE TYPE public.app_role AS ENUM ('admin','registrar','approver','signer','archivist','viewer');
CREATE TYPE public.document_status AS ENUM ('draft','in_review','approved','signed','rejected','archived','cancelled');
CREATE TYPE public.workflow_status AS ENUM ('draft','published','archived');
CREATE TYPE public.run_status AS ENUM ('running','completed','cancelled','failed');
CREATE TYPE public.task_status AS ENUM ('pending','in_progress','completed','rejected','escalated','cancelled');
CREATE TYPE public.signature_status AS ENUM ('pending','signed','rejected','expired');
CREATE TYPE public.sla_status AS ENUM ('ok','warning','overdue');

-- =============== UTILS ===============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- =============== DEPARTMENTS ===============
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  code TEXT NOT NULL UNIQUE,
  name_ru TEXT NOT NULL,
  name_kk TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- =============== PROFILES ===============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name_ru TEXT,
  full_name_kk TEXT,
  position_ru TEXT,
  position_kk TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  locale TEXT NOT NULL DEFAULT 'ru' CHECK (locale IN ('ru','kk')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_uat BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== USER ROLES ===============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin');
$$;

-- =============== AUTO-CREATE PROFILE ON SIGNUP ===============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name_ru, full_name_kk, locale)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'locale', 'ru')
  );
  -- Первый пользователь = admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS profiles
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated
USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- RLS user_roles
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- RLS departments
CREATE POLICY "departments_select_all_auth" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments_admin_manage" ON public.departments FOR ALL TO authenticated
USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =============== NOMENCLATURE ===============
CREATE TABLE public.nomenclature_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.nomenclature_items(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title_ru TEXT NOT NULL,
  title_kk TEXT NOT NULL,
  retention_years INTEGER NOT NULL DEFAULT 5,
  archive_rule TEXT NOT NULL DEFAULT 'standard',
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nomenclature_items TO authenticated;
GRANT ALL ON public.nomenclature_items TO service_role;
ALTER TABLE public.nomenclature_items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_nom_uat BEFORE UPDATE ON public.nomenclature_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "nom_select_all" ON public.nomenclature_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "nom_manage_admin_or_registrar" ON public.nomenclature_items FOR ALL TO authenticated
USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'registrar'))
WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'registrar'));

-- =============== TEMPLATES ===============
CREATE TABLE public.document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ru TEXT NOT NULL,
  name_kk TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  file_path TEXT,
  file_format TEXT NOT NULL DEFAULT 'docx',
  schema JSONB NOT NULL DEFAULT '{"fields":[]}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_templates TO authenticated;
GRANT ALL ON public.document_templates TO service_role;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_tpl_uat BEFORE UPDATE ON public.document_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "tpl_select_all" ON public.document_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "tpl_manage_priv" ON public.document_templates FOR ALL TO authenticated
USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'registrar'))
WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'registrar'));

-- =============== WORKFLOWS ===============
CREATE TABLE public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ru TEXT NOT NULL,
  name_kk TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status public.workflow_status NOT NULL DEFAULT 'draft',
  definition JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflows TO authenticated;
GRANT ALL ON public.workflows TO service_role;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_wf_uat BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "wf_select_all" ON public.workflows FOR SELECT TO authenticated USING (true);
CREATE POLICY "wf_manage_priv" ON public.workflows FOR ALL TO authenticated
USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'registrar'))
WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'registrar'));

-- =============== DOCUMENTS ===============
CREATE SEQUENCE IF NOT EXISTS public.document_reg_seq;

CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reg_number TEXT NOT NULL UNIQUE,
  doc_type TEXT NOT NULL DEFAULT 'general',
  status public.document_status NOT NULL DEFAULT 'draft',
  title_ru TEXT NOT NULL,
  title_kk TEXT,
  summary TEXT,
  body TEXT,
  nomenclature_id UUID REFERENCES public.nomenclature_items(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.document_templates(id) ON DELETE SET NULL,
  current_version INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  sla_status public.sla_status NOT NULL DEFAULT 'ok',
  archived_at TIMESTAMPTZ,
  legal_hold BOOLEAN NOT NULL DEFAULT false,
  search_tsv tsvector,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_doc_uat BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_doc_status ON public.documents(status);
CREATE INDEX idx_doc_assigned ON public.documents(assigned_to);
CREATE INDEX idx_doc_created_by ON public.documents(created_by);
CREATE INDEX idx_doc_tsv ON public.documents USING GIN(search_tsv);

-- Auto reg_number + FTS
CREATE OR REPLACE FUNCTION public.documents_before_ins_upd()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.reg_number IS NULL OR NEW.reg_number = '') THEN
    NEW.reg_number := 'DOC-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.document_reg_seq')::text, 6, '0');
  END IF;
  NEW.search_tsv :=
    setweight(to_tsvector('simple', coalesce(NEW.reg_number,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.title_ru,'') || ' ' || coalesce(NEW.title_kk,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.summary,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.body,'')), 'C');
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_doc_bi BEFORE INSERT OR UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.documents_before_ins_upd();

-- =============== DOCUMENT VERSIONS ===============
CREATE TABLE public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  file_path TEXT,
  file_format TEXT,
  content_hash TEXT,
  comment TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id, version_no)
);
GRANT SELECT, INSERT, UPDATE ON public.document_versions TO authenticated;
GRANT ALL ON public.document_versions TO service_role;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_dv_doc ON public.document_versions(document_id);

-- =============== SIGNATURES (NCALayer payload) ===============
CREATE TABLE public.document_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_id UUID REFERENCES public.document_versions(id) ON DELETE SET NULL,
  signer_id UUID NOT NULL REFERENCES auth.users(id),
  signature_type TEXT NOT NULL DEFAULT 'CMS',
  cert_subject TEXT,
  cert_serial TEXT,
  cert_issuer TEXT,
  payload TEXT,
  status public.signature_status NOT NULL DEFAULT 'pending',
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.document_signatures TO authenticated;
GRANT ALL ON public.document_signatures TO service_role;
ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sig_doc ON public.document_signatures(document_id);

-- =============== COMMENTS ===============
CREATE TABLE public.document_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.document_comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_comments TO authenticated;
GRANT ALL ON public.document_comments TO service_role;
ALTER TABLE public.document_comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_cmt_doc ON public.document_comments(document_id);

-- =============== WORKFLOW RUNS / TASKS / EVENTS ===============
CREATE TABLE public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  current_node TEXT,
  status public.run_status NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.workflow_runs TO authenticated;
GRANT ALL ON public.workflow_runs TO service_role;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_wfr_doc ON public.workflow_runs(document_id);

CREATE TABLE public.workflow_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  title TEXT NOT NULL,
  assignee_id UUID REFERENCES auth.users(id),
  action_required TEXT NOT NULL DEFAULT 'approve',
  status public.task_status NOT NULL DEFAULT 'pending',
  decision TEXT,
  comment TEXT,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.workflow_tasks TO authenticated;
GRANT ALL ON public.workflow_tasks TO service_role;
ALTER TABLE public.workflow_tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_wft_assignee ON public.workflow_tasks(assignee_id, status);
CREATE INDEX idx_wft_doc ON public.workflow_tasks(document_id);

CREATE TABLE public.workflow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  node_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.workflow_events TO authenticated;
GRANT ALL ON public.workflow_events TO service_role;
ALTER TABLE public.workflow_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_wfe_doc ON public.workflow_events(document_id, created_at DESC);

-- =============== DOCUMENTS RLS (after tasks for participant check) ===============
CREATE OR REPLACE FUNCTION public.can_view_document(_doc_id UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.documents d
    WHERE d.id = _doc_id AND (
      d.created_by = _user
      OR d.assigned_to = _user
      OR public.is_admin(_user)
      OR public.has_role(_user,'archivist')
      OR EXISTS (SELECT 1 FROM public.workflow_tasks t WHERE t.document_id = _doc_id AND t.assignee_id = _user)
    )
  );
$$;

CREATE POLICY "doc_select_participants" ON public.documents FOR SELECT TO authenticated
USING (created_by = auth.uid() OR assigned_to = auth.uid() OR public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'archivist')
       OR EXISTS (SELECT 1 FROM public.workflow_tasks t WHERE t.document_id = documents.id AND t.assignee_id = auth.uid()));
CREATE POLICY "doc_insert_auth" ON public.documents FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());
CREATE POLICY "doc_update_owner_or_admin" ON public.documents FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR assigned_to = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (created_by = auth.uid() OR assigned_to = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "doc_delete_admin" ON public.documents FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- Versions RLS
CREATE POLICY "dv_select_participants" ON public.document_versions FOR SELECT TO authenticated
USING (public.can_view_document(document_id, auth.uid()));
CREATE POLICY "dv_insert_participants" ON public.document_versions FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND public.can_view_document(document_id, auth.uid()));

-- Signatures RLS
CREATE POLICY "sig_select_participants" ON public.document_signatures FOR SELECT TO authenticated
USING (public.can_view_document(document_id, auth.uid()));
CREATE POLICY "sig_insert_own" ON public.document_signatures FOR INSERT TO authenticated
WITH CHECK (signer_id = auth.uid());
CREATE POLICY "sig_update_own" ON public.document_signatures FOR UPDATE TO authenticated
USING (signer_id = auth.uid() OR public.is_admin(auth.uid()));

-- Comments RLS
CREATE POLICY "cmt_select_participants" ON public.document_comments FOR SELECT TO authenticated
USING (public.can_view_document(document_id, auth.uid()));
CREATE POLICY "cmt_insert_participants" ON public.document_comments FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND public.can_view_document(document_id, auth.uid()));
CREATE POLICY "cmt_delete_own_or_admin" ON public.document_comments FOR DELETE TO authenticated
USING (author_id = auth.uid() OR public.is_admin(auth.uid()));

-- Workflow runs RLS
CREATE POLICY "wfr_select_participants" ON public.workflow_runs FOR SELECT TO authenticated
USING (public.can_view_document(document_id, auth.uid()));
CREATE POLICY "wfr_insert_priv" ON public.workflow_runs FOR INSERT TO authenticated
WITH CHECK (public.can_view_document(document_id, auth.uid()));
CREATE POLICY "wfr_update_priv" ON public.workflow_runs FOR UPDATE TO authenticated
USING (public.can_view_document(document_id, auth.uid()));

-- Workflow tasks RLS
CREATE POLICY "wft_select_visible" ON public.workflow_tasks FOR SELECT TO authenticated
USING (assignee_id = auth.uid() OR public.is_admin(auth.uid()) OR public.can_view_document(document_id, auth.uid()));
CREATE POLICY "wft_insert_priv" ON public.workflow_tasks FOR INSERT TO authenticated
WITH CHECK (public.can_view_document(document_id, auth.uid()));
CREATE POLICY "wft_update_assignee" ON public.workflow_tasks FOR UPDATE TO authenticated
USING (assignee_id = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (assignee_id = auth.uid() OR public.is_admin(auth.uid()));

-- Workflow events RLS
CREATE POLICY "wfe_select_participants" ON public.workflow_events FOR SELECT TO authenticated
USING (public.can_view_document(document_id, auth.uid()));
CREATE POLICY "wfe_insert_participants" ON public.workflow_events FOR INSERT TO authenticated
WITH CHECK (public.can_view_document(document_id, auth.uid()));

-- =============== AUDIT LOG ===============
CREATE TABLE public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before JSONB,
  after JSONB,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.audit_logs_id_seq TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_entity ON public.audit_logs(entity_type, entity_id, created_at DESC);
CREATE POLICY "audit_select_admin" ON public.audit_logs FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR actor_id = auth.uid());
CREATE POLICY "audit_insert_self" ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

-- Auto-audit trigger for documents
CREATE OR REPLACE FUNCTION public.audit_documents()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs(actor_id, entity_type, entity_id, action, before, after)
  VALUES (
    auth.uid(),
    'document',
    COALESCE(NEW.id::text, OLD.id::text),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER trg_audit_documents AFTER INSERT OR UPDATE OR DELETE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.audit_documents();

-- =============== NOTIFICATIONS ===============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notif_user ON public.notifications(user_id, read_at);
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_insert_auth" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- =============== REALTIME ===============
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.document_comments;
