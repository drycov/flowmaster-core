-- EDMS reference catalogs (справочники СЭД)

-- =============================================================================
-- 1. Permission
-- =============================================================================
INSERT INTO public.permissions(code, category, description_ru, description_kk) VALUES
  ('manage_references', 'admin', 'Управление справочниками СЭД', 'СЭД анықтамалықтарын басқару')
ON CONFLICT (code) DO NOTHING;

UPDATE public.role_definitions SET
  permissions = permissions || '{"manage_references":true}'::jsonb,
  updated_at = now()
WHERE role = 'admin';

UPDATE public.role_definitions SET
  permissions = permissions || '{"manage_references":true}'::jsonb,
  updated_at = now()
WHERE role = 'registrar';

UPDATE public.role_definitions SET
  permissions = permissions || '{"manage_references":true}'::jsonb,
  updated_at = now()
WHERE role = 'archivist';

INSERT INTO public.role_permissions (role_id, permission_code)
SELECT r.id, 'manage_references'
FROM public.roles r
WHERE r.code IN ('admin', 'registrar', 'archivist')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 2. Helper: standard reference table setup
-- =============================================================================
CREATE OR REPLACE FUNCTION public.ref_catalog_policies(_table text, _permission text DEFAULT 'manage_references')
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', _table);

  EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', _table, _table);
  EXECUTE format(
    'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (true)',
    _table, _table
  );

  EXECUTE format('DROP POLICY IF EXISTS %I_manage ON public.%I', _table, _table);
  EXECUTE format(
    'CREATE POLICY %I_manage ON public.%I FOR ALL TO authenticated
       USING (public.user_has_permission(auth.uid(), %L))
       WITH CHECK (public.user_has_permission(auth.uid(), %L))',
    _table, _table, _permission, _permission
  );
END;
$$;

-- =============================================================================
-- 3. Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ref_document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_kk text NOT NULL,
  description_ru text NOT NULL DEFAULT '',
  description_kk text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ref_template_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_kk text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ref_correspondents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_kk text NOT NULL,
  bin text NOT NULL DEFAULT '',
  address_ru text NOT NULL DEFAULT '',
  address_kk text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  contact_person text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ref_delivery_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_kk text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ref_access_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_kk text NOT NULL,
  level_order int NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ref_priorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_kk text NOT NULL,
  sla_hours int,
  color text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ref_retention_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_kk text NOT NULL,
  years int NOT NULL DEFAULT 5,
  is_permanent boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ref_registration_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_kk text NOT NULL,
  prefix text NOT NULL DEFAULT '',
  document_type_id uuid REFERENCES public.ref_document_types(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ref_archive_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_kk text NOT NULL,
  parent_id uuid REFERENCES public.ref_archive_locations(id) ON DELETE SET NULL,
  address_ru text NOT NULL DEFAULT '',
  address_kk text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ref_department_kinds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_kk text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ref_rejection_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_kk text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ref_document_link_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_kk text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- updated_at triggers
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ref_document_types','ref_template_categories','ref_correspondents',
    'ref_delivery_methods','ref_access_levels','ref_priorities',
    'ref_retention_periods','ref_registration_journals','ref_archive_locations',
    'ref_department_kinds','ref_rejection_reasons','ref_document_link_types'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated ON public.%1$s', t);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON public.%1$s
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t
    );
    PERFORM public.ref_catalog_policies(t);
  END LOOP;
END $do$;

-- audit triggers
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ref_document_types','ref_template_categories','ref_correspondents',
    'ref_delivery_methods','ref_access_levels','ref_priorities',
    'ref_retention_periods','ref_registration_journals','ref_archive_locations',
    'ref_department_kinds','ref_rejection_reasons','ref_document_link_types'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$s', t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s
         FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()', t
    );
  END LOOP;
END $do$;

-- =============================================================================
-- 4. Seed data (idempotent)
-- =============================================================================

INSERT INTO public.ref_document_types (code, name_ru, name_kk, description_ru, description_kk, sort_order) VALUES
  ('incoming',  'Входящий',           'Кіріс',              'Входящая корреспонденция',     'Кіріс хат-хабар', 10),
  ('outgoing',  'Исходящий',          'Шығыс',              'Исходящая корреспонденция',    'Шығыс хат-хабар', 20),
  ('internal',  'Внутренний',         'Ішкі',               'Внутренний документ',          'Ішкі құжат', 30),
  ('order',     'Приказ',             'Бұйрық',             'Организационно-распорядительный','Ұйымдастырушылық', 40),
  ('contract',  'Договор',            'Шарт',               'Договор и приложения',         'Шарт және қосымшалар', 50),
  ('memo',      'Служебная записка',  'Қызметтік жазба',    'Служебная записка',            'Қызметтік жазба', 60),
  ('protocol',  'Протокол',           'Хаттама',            'Протокол совещания',           'Кеңес хаттамасы', 70),
  ('act',       'Акт',                'Акт',                'Акт выполненных работ',        'Орындалған жұмыс актісі', 80),
  ('application','Заявление',         'Өтініш',             'Заявление гражданина/сотрудника','Өтініш', 90),
  ('report',    'Отчёт',              'Есеп',               'Отчётная документация',         'Есептік құжаттама', 100)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ref_template_categories (code, name_ru, name_kk, sort_order) VALUES
  ('general',     'Общие',              'Жалпы',           0),
  ('memo',        'Служебные записки',  'Қызметтік жазбалар', 10),
  ('order',       'Приказы',            'Бұйрықтар',       20),
  ('contract',    'Договоры',           'Шарттар',         30),
  ('protocol',    'Протоколы',          'Хаттамалар',      40),
  ('act',         'Акты',               'Актілер',         50),
  ('application', 'Заявления',          'Өтініштер',       60),
  ('report',      'Отчёты',             'Есептер',         70),
  ('instruction', 'Инструкции',         'Нұсқаулықтар',    80)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ref_delivery_methods (code, name_ru, name_kk, sort_order) VALUES
  ('hand',    'Лично / курьер',     'Жеке / курьер',    10),
  ('email',   'Электронная почта',  'Электрондық пошта', 20),
  ('portal',  'Портал / ЕСЭДО',     'Портал / ЕСЭДО',   30),
  ('post',    'Почта',              'Пошта',            40),
  ('fax',     'Факс',               'Факс',             50)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ref_access_levels (code, name_ru, name_kk, level_order, sort_order) VALUES
  ('public',        'Общедоступный',        'Жалпыға қолжетімді', 0, 10),
  ('internal',      'Для служебного пользования', 'Қызметтік пайдалану', 1, 20),
  ('confidential',  'Конфиденциально',      'Құпия',              2, 30),
  ('secret',        'Особой важности',      'Өте маңызды',        3, 40)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ref_priorities (code, name_ru, name_kk, sla_hours, color, sort_order) VALUES
  ('low',    'Низкий',     'Төмен',    120, 'muted',    10),
  ('normal', 'Обычный',    'Қалыпты',   72, 'default',  20),
  ('high',   'Высокий',    'Жоғары',    24, 'warning',  30),
  ('urgent', 'Срочный',    'Шұғыл',      4, 'destructive', 40)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ref_retention_periods (code, name_ru, name_kk, years, is_permanent, sort_order) VALUES
  ('1y',   '1 год',          '1 жыл',         1, false, 10),
  ('3y',   '3 года',         '3 жыл',         3, false, 20),
  ('5y',   '5 лет',          '5 жыл',         5, false, 30),
  ('10y',  '10 лет',         '10 жыл',       10, false, 40),
  ('75y',  '75 лет',         '75 жыл',       75, false, 50),
  ('perm', 'Постоянно',      'Тұрақты сақтау', 0, true, 60)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ref_department_kinds (code, name_ru, name_kk, sort_order) VALUES
  ('company',    'Организация',  'Ұйым',        10),
  ('branch',     'Филиал',       'Филиал',      20),
  ('department', 'Отдел',        'Бөлім',       30),
  ('division',   'Управление',   'Басқарма',    40)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ref_rejection_reasons (code, name_ru, name_kk, sort_order) VALUES
  ('incomplete',  'Неполный комплект',        'Толық емес жинақ',        10),
  ('wrong_route', 'Неверный маршрут',         'Қате бағыт',              20),
  ('errors',      'Ошибки в содержании',      'Мазмұндағы қателер',      30),
  ('duplicate',   'Дубликат',                 'Дубликат',                40),
  ('other',       'Иное',                     'Басқа',                   50)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ref_document_link_types (code, name_ru, name_kk, sort_order) VALUES
  ('response_to', 'В ответ на',           'Жауап ретінде',       10),
  ('attachment',  'Приложение к',         'Қосымша',             20),
  ('related',     'Связанный',            'Байланысты',          30),
  ('parent',      'Основание',            'Негіз',               40),
  ('supersedes',  'Заменяет',             'Ауыстырады',          50)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ref_registration_journals (code, name_ru, name_kk, prefix, document_type_id, sort_order)
SELECT 'incoming', 'Журнал входящих', 'Кіріс журналы', 'IN',
       (SELECT id FROM public.ref_document_types WHERE code = 'incoming' LIMIT 1), 10
WHERE NOT EXISTS (SELECT 1 FROM public.ref_registration_journals WHERE code = 'incoming');

INSERT INTO public.ref_registration_journals (code, name_ru, name_kk, prefix, document_type_id, sort_order)
SELECT 'outgoing', 'Журнал исходящих', 'Шығыс журналы', 'OUT',
       (SELECT id FROM public.ref_document_types WHERE code = 'outgoing' LIMIT 1), 20
WHERE NOT EXISTS (SELECT 1 FROM public.ref_registration_journals WHERE code = 'outgoing');

INSERT INTO public.ref_registration_journals (code, name_ru, name_kk, prefix, document_type_id, sort_order)
SELECT 'internal', 'Журнал внутренних', 'Ішкі журнал', 'INT',
       (SELECT id FROM public.ref_document_types WHERE code = 'internal' LIMIT 1), 30
WHERE NOT EXISTS (SELECT 1 FROM public.ref_registration_journals WHERE code = 'internal');

INSERT INTO public.ref_archive_locations (code, name_ru, name_kk, sort_order) VALUES
  ('main', 'Центральный архив', 'Орталық мұрағат', 10)
ON CONFLICT (code) DO NOTHING;
