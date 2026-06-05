
-- Organization (singleton)
CREATE TABLE public.organization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ru text NOT NULL DEFAULT '',
  name_kk text NOT NULL DEFAULT '',
  short_name_ru text DEFAULT '',
  short_name_kk text DEFAULT '',
  bin text DEFAULT '',
  legal_address_ru text DEFAULT '',
  legal_address_kk text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  website text DEFAULT '',
  head_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  logo_url text DEFAULT '',
  reg_number_prefix text DEFAULT 'DOC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organization TO authenticated;
GRANT ALL ON public.organization TO service_role;
ALTER TABLE public.organization ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read all auth" ON public.organization FOR SELECT TO authenticated USING (true);
CREATE POLICY "org admin write" ON public.organization FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER org_updated BEFORE UPDATE ON public.organization
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Insert one row
INSERT INTO public.organization (name_ru, name_kk) VALUES ('Моя организация', 'Менің ұйымым');

-- Positions reference
CREATE TABLE public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title_ru text NOT NULL,
  title_kk text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  level int NOT NULL DEFAULT 0,
  is_head boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos read all auth" ON public.positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "pos admin write" ON public.positions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER pos_updated BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add position_id to profiles
ALTER TABLE public.profiles ADD COLUMN position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL;

-- Extend departments
ALTER TABLE public.departments
  ADD COLUMN head_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN kind text NOT NULL DEFAULT 'department',
  ADD COLUMN phone text DEFAULT '',
  ADD COLUMN email text DEFAULT '';

-- Role definitions (configurable descriptions + permissions matrix)
CREATE TABLE public.role_definitions (
  role app_role PRIMARY KEY,
  title_ru text NOT NULL,
  title_kk text NOT NULL,
  description_ru text DEFAULT '',
  description_kk text DEFAULT '',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.role_definitions TO authenticated;
GRANT ALL ON public.role_definitions TO service_role;
ALTER TABLE public.role_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roledef read auth" ON public.role_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "roledef admin write" ON public.role_definitions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER roledef_updated BEFORE UPDATE ON public.role_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.role_definitions (role, title_ru, title_kk, description_ru, description_kk, permissions) VALUES
  ('admin','Администратор','Әкімші','Полный доступ ко всем функциям и настройкам','Барлық функциялар мен баптауларға толық қол жеткізу',
   '{"manage_users":true,"manage_org":true,"manage_workflows":true,"manage_templates":true,"manage_nomenclature":true,"view_audit":true,"sign_documents":true,"register_documents":true,"approve_documents":true,"archive_documents":true}'::jsonb),
  ('registrar','Регистратор','Тіркеуші','Регистрация входящих и исходящих документов','Кіріс және шығыс құжаттарды тіркеу',
   '{"register_documents":true,"manage_templates":false}'::jsonb),
  ('approver','Согласующий','Келісуші','Согласование документов в маршрутах','Бағыттарда құжаттарды келісу',
   '{"approve_documents":true}'::jsonb),
  ('signer','Подписант','Қол қоюшы','Подписание документов ЭЦП','Құжаттарға ЭЦҚ қою',
   '{"sign_documents":true,"approve_documents":true}'::jsonb),
  ('archivist','Архивариус','Мұрағатшы','Управление архивом и номенклатурой','Мұрағат пен номенклатураны басқару',
   '{"archive_documents":true,"manage_nomenclature":true}'::jsonb),
  ('viewer','Наблюдатель','Байқаушы','Просмотр документов','Құжаттарды қарау','{}'::jsonb);
