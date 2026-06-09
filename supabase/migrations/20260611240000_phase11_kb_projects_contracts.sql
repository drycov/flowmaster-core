-- Phase 11: Knowledge Base (document-based), document projects, contracts, counterparties

-- =============================================================================
-- 1. Counterparties enrichment
-- =============================================================================

ALTER TABLE public.ref_correspondents
  ADD COLUMN IF NOT EXISTS correspondent_type text NOT NULL DEFAULT 'legal'
    CHECK (correspondent_type IN ('legal', 'individual', 'government')),
  ADD COLUMN IF NOT EXISTS external_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_account text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bik text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS iik text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS kbe text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.document_correspondents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  correspondent_id uuid NOT NULL REFERENCES public.ref_correspondents(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'counterparty'
    CHECK (role IN ('sender', 'recipient', 'counterparty', 'witness', 'other')),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, correspondent_id, role)
);

CREATE INDEX IF NOT EXISTS idx_document_correspondents_doc ON public.document_correspondents(document_id);
CREATE INDEX IF NOT EXISTS idx_document_correspondents_corr ON public.document_correspondents(correspondent_id);

-- =============================================================================
-- 2. Knowledge base (articles sourced from documents)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.kb_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_kk text NOT NULL,
  parent_id uuid REFERENCES public.kb_categories(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  category_id uuid REFERENCES public.kb_categories(id) ON DELETE SET NULL,
  source_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  title_ru text NOT NULL,
  title_kk text NOT NULL,
  summary_ru text NOT NULL DEFAULT '',
  summary_kk text NOT NULL DEFAULT '',
  body_ru text NOT NULL DEFAULT '',
  body_kk text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  access_level_id uuid REFERENCES public.ref_access_levels(id) ON DELETE SET NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  search_tsv tsvector,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON public.kb_articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_articles_source_doc ON public.kb_articles(source_document_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_tsv ON public.kb_articles USING gin(search_tsv);

CREATE OR REPLACE FUNCTION public.kb_articles_search_tsv()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('russian', coalesce(NEW.title_ru, '') || ' ' || coalesce(NEW.summary_ru, '') || ' ' || coalesce(NEW.body_ru, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.title_kk, '') || ' ' || coalesce(NEW.summary_kk, '') || ' ' || coalesce(NEW.body_kk, '')), 'B') ||
    setweight(to_tsvector('simple', array_to_string(NEW.tags, ' ')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kb_articles_tsv ON public.kb_articles;
CREATE TRIGGER trg_kb_articles_tsv
  BEFORE INSERT OR UPDATE ON public.kb_articles
  FOR EACH ROW EXECUTE FUNCTION public.kb_articles_search_tsv();

-- =============================================================================
-- 3. Document projects (multi-template bundles)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.document_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_kk text NOT NULL,
  description_ru text NOT NULL DEFAULT '',
  description_kk text NOT NULL DEFAULT '',
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  nomenclature_id uuid REFERENCES public.nomenclature_items(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_project_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.document_projects(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
  label_ru text NOT NULL DEFAULT '',
  label_kk text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT false,
  default_workflow_id uuid REFERENCES public.workflows(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_document_project_templates_project ON public.document_project_templates(project_id, sort_order);

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.document_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_project_id ON public.documents(project_id);

-- =============================================================================
-- 4. Contracts registry (sidecar on documents)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.contract_details (
  document_id uuid PRIMARY KEY REFERENCES public.documents(id) ON DELETE CASCADE,
  contract_number text NOT NULL DEFAULT '',
  contract_date date,
  valid_from date,
  valid_to date,
  amount numeric(18,2),
  currency text NOT NULL DEFAULT 'KZT',
  contract_status text NOT NULL DEFAULT 'draft'
    CHECK (contract_status IN ('draft', 'negotiation', 'active', 'expired', 'terminated')),
  counterparty_id uuid REFERENCES public.ref_correspondents(id) ON DELETE SET NULL,
  subject_ru text NOT NULL DEFAULT '',
  subject_kk text NOT NULL DEFAULT '',
  payment_terms text NOT NULL DEFAULT '',
  auto_renew boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_details_status ON public.contract_details(contract_status, valid_to);
CREATE INDEX IF NOT EXISTS idx_contract_details_counterparty ON public.contract_details(counterparty_id);

-- =============================================================================
-- 5. Permissions
-- =============================================================================

INSERT INTO public.permissions (code, category, description_ru, description_kk)
VALUES
  ('manage_knowledge_base', 'docs', 'Управление базой знаний', 'Білім базасын басқару'),
  ('manage_projects', 'docs', 'Управление проектами документов', 'Құжат жобаларын басқару'),
  ('manage_contracts', 'docs', 'Управление договорами', 'Шарттарды басқару')
ON CONFLICT (code) DO NOTHING;

UPDATE public.role_definitions
SET permissions = permissions || '{"manage_knowledge_base":true,"manage_projects":true,"manage_contracts":true}'::jsonb,
    updated_at = now()
WHERE role IN ('admin', 'registrar');

INSERT INTO public.role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM public.roles r
CROSS JOIN (VALUES ('manage_knowledge_base'), ('manage_projects'), ('manage_contracts')) AS p(code)
WHERE r.code IN ('admin', 'registrar')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 6. Seeds
-- =============================================================================

INSERT INTO public.kb_categories (code, name_ru, name_kk, sort_order)
VALUES
  ('regulations', 'Регламенты и инструкции', 'Регламенттер мен нұсқаулықтар', 10),
  ('templates-help', 'Работа с шаблонами', 'Үлгілермен жұмыс', 20),
  ('contracts-help', 'Договорная работа', 'Шарттық жұмыс', 30),
  ('onboarding', 'Онбординг', 'Онбординг', 40)
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- 7. RLS
-- =============================================================================

ALTER TABLE public.kb_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_correspondents ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_articles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_project_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_details TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_correspondents TO authenticated;

GRANT ALL ON public.kb_categories TO service_role;
GRANT ALL ON public.kb_articles TO service_role;
GRANT ALL ON public.document_projects TO service_role;
GRANT ALL ON public.document_project_templates TO service_role;
GRANT ALL ON public.contract_details TO service_role;
GRANT ALL ON public.document_correspondents TO service_role;

-- KB categories: read all, write manage_knowledge_base
CREATE POLICY kb_categories_select ON public.kb_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY kb_categories_write ON public.kb_categories FOR ALL TO authenticated
  USING (public.user_has_permission(auth.uid(), 'manage_knowledge_base'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_knowledge_base'));

-- KB articles: published readable; drafts by author or manager
CREATE POLICY kb_articles_select ON public.kb_articles FOR SELECT TO authenticated
  USING (
    status = 'published'
    OR author_id = auth.uid()
    OR public.user_has_permission(auth.uid(), 'manage_knowledge_base')
    OR public.user_has_permission(auth.uid(), 'view_all_documents')
  );

CREATE POLICY kb_articles_write ON public.kb_articles FOR ALL TO authenticated
  USING (
    author_id = auth.uid()
    OR public.user_has_permission(auth.uid(), 'manage_knowledge_base')
  )
  WITH CHECK (
    author_id = auth.uid()
    OR public.user_has_permission(auth.uid(), 'manage_knowledge_base')
  );

-- Projects: read all authenticated, write manage_projects
CREATE POLICY document_projects_select ON public.document_projects FOR SELECT TO authenticated USING (true);
CREATE POLICY document_projects_write ON public.document_projects FOR ALL TO authenticated
  USING (public.user_has_permission(auth.uid(), 'manage_projects') OR public.user_has_permission(auth.uid(), 'manage_documents'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_projects') OR public.user_has_permission(auth.uid(), 'manage_documents'));

CREATE POLICY document_project_templates_select ON public.document_project_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY document_project_templates_write ON public.document_project_templates FOR ALL TO authenticated
  USING (public.user_has_permission(auth.uid(), 'manage_projects') OR public.user_has_permission(auth.uid(), 'manage_documents'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manage_projects') OR public.user_has_permission(auth.uid(), 'manage_documents'));

-- Contracts: visible if document visible (simplified: all with view_all or creator path via API)
CREATE POLICY contract_details_select ON public.contract_details FOR SELECT TO authenticated
  USING (
    public.user_has_permission(auth.uid(), 'view_all_documents')
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = contract_details.document_id
        AND (d.created_by = auth.uid() OR d.assigned_to = auth.uid())
    )
    OR public.can_view_document(auth.uid(), contract_details.document_id)
  );

CREATE POLICY contract_details_write ON public.contract_details FOR ALL TO authenticated
  USING (
    public.user_has_permission(auth.uid(), 'manage_contracts')
    OR public.user_has_permission(auth.uid(), 'manage_documents')
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = contract_details.document_id AND d.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.user_has_permission(auth.uid(), 'manage_contracts')
    OR public.user_has_permission(auth.uid(), 'manage_documents')
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = contract_details.document_id AND d.created_by = auth.uid()
    )
  );

-- Document correspondents: follow document access
CREATE POLICY document_correspondents_select ON public.document_correspondents FOR SELECT TO authenticated
  USING (public.can_view_document(auth.uid(), document_id));

CREATE POLICY document_correspondents_write ON public.document_correspondents FOR ALL TO authenticated
  USING (
    public.user_has_permission(auth.uid(), 'manage_documents')
    OR EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_correspondents.document_id AND d.created_by = auth.uid())
  )
  WITH CHECK (
    public.user_has_permission(auth.uid(), 'manage_documents')
    OR EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_correspondents.document_id AND d.created_by = auth.uid())
  );

DROP TRIGGER IF EXISTS trg_kb_categories_updated ON public.kb_categories;
CREATE TRIGGER trg_kb_categories_updated BEFORE UPDATE ON public.kb_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_kb_articles_updated ON public.kb_articles;
CREATE TRIGGER trg_kb_articles_updated BEFORE UPDATE ON public.kb_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_document_projects_updated ON public.document_projects;
CREATE TRIGGER trg_document_projects_updated BEFORE UPDATE ON public.document_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_contract_details_updated ON public.contract_details;
CREATE TRIGGER trg_contract_details_updated BEFORE UPDATE ON public.contract_details
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
