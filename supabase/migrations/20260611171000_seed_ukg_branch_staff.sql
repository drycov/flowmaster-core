-- Seed UKG branch staff roster (26 employees)
-- Idempotent: match by email; skip assignment if current primary already matches.

-- Optional org grouping: «Администрация филиала»
INSERT INTO public.departments (
  id, parent_id, code, name_ru, name_kk, kind, is_active
) VALUES (
  'f3a8c1d2-4e5b-6a7c-8d9e-0f1a2b3c4d5e'::uuid,
  '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid,
  'UKG-SAT-ADM',
  'Администрация филиала',
  'Администрация филиала',
  'department',
  true
)
ON CONFLICT (code) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  name_ru = EXCLUDED.name_ru,
  name_kk = EXCLUDED.name_kk,
  kind = EXCLUDED.kind,
  is_active = EXCLUDED.is_active,
  updated_at = now();

UPDATE public.positions
   SET department_id = 'f3a8c1d2-4e5b-6a7c-8d9e-0f1a2b3c4d5e'::uuid,
       updated_at = now()
 WHERE code IN ('dir', 'chief_eng', 'accountant', 'chief_accountant', 'spec_hr', 'storekeeper');

DO $seed$
DECLARE
  v_pwd text := 'Satory2026!';
  r record;
  v_user_id uuid;
  v_adm_dept uuid := 'f3a8c1d2-4e5b-6a7c-8d9e-0f1a2b3c4d5e'::uuid;
  v_branch uuid := '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid;
  v_mon uuid := '2d1b9434-2e90-485c-b918-037b8c24fefa'::uuid;
  v_iam uuid := 'e5c531e6-b3ae-47bf-a757-298430a1296d'::uuid;
  v_oess uuid := 'bd22ccb4-f044-412c-9c52-377641fc642e'::uuid;
  v_ops uuid := '0a99623d-b7d6-428d-a9c5-d538960c70b0'::uuid;
  v_prd uuid := '8f169fb3-7fe7-49c0-bf08-3d6c179a44da'::uuid;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('v.biryukov@satory.kz',           'Бирюков Виктор Юрьевич',              v_adm_dept, '1c660c25-472d-4f15-8440-1dfe46432468'::uuid, 'Директор филиала'),
      ('r.genittenov@satory.kz',         'Гениттенов Руслан Кусаинович',        v_adm_dept, '53e4adda-8cf8-4eb0-9d86-1a0c42192b9b'::uuid, 'Главный инженер'),
      ('o.nishkun@satory.kz',            'Нишкун Олеся Александровна',          v_adm_dept, 'f20e1e0b-ae1d-4685-895b-73b16abc7a98'::uuid, 'Бухгалтер'),
      ('i.kuznetsova@satory.kz',         'Кузнецова Ирина Юрьевна',             v_adm_dept, 'e6008a0c-2411-4194-9ad2-4443785a17e4'::uuid, 'Главный бухгалтер филиала'),
      ('e.isakova@satory.kz',            'Исакова Елена Назархановна',          v_adm_dept, '4c51958c-d98f-4232-9f1a-d2abe90a57b7'::uuid, 'Специалист по кадрам'),
      ('v.fadeeva@satory.kz',            'Фадеева Виктория Анатольевна',        v_adm_dept, '3ae08b3a-9393-494b-b144-59610a5bb763'::uuid, 'Кладовщик'),
      ('a.polupanova@satory.kz',         'Полупанова Анастасия Артемовна',      v_mon,      'eab93816-6b03-48f1-aff3-86e24228fd9c'::uuid, 'Руководитель центра мониторинга'),
      ('l.sosnovskaya@satory.kz',        'Сосновская Любовь Юрьевна',           v_mon,      '7d7b2d8f-7699-4236-a2af-317556913ae9'::uuid, 'Специалист по мониторингу'),
      ('i.fazylova@satory.kz',           'Фазылова Инара Армановна',            v_mon,      '7d7b2d8f-7699-4236-a2af-317556913ae9'::uuid, 'Специалист по мониторингу'),
      ('n.egorova@satory.kz',            'Егорова Наталья Владимировна',        v_mon,      '7d7b2d8f-7699-4236-a2af-317556913ae9'::uuid, 'Специалист по мониторингу'),
      ('e.khamzinov@satory.kz',          'Хамзинов Ермек Нурбекович',           v_iam,      '61814a13-211f-4e38-b2be-1f1f7ed9c020'::uuid, 'Старший менеджер доступа'),
      ('p.furtatov@satory.kz',           'Фуртатов Петр Сергеевич',             v_iam,      '1b3d0fa7-093e-4a96-aee4-e6ff6ead7504'::uuid, 'Менеджер доступа'),
      ('k.kurmangaliev@satory.kz',       'Курмангалиев Канат Манакович',        v_iam,      '1b3d0fa7-093e-4a96-aee4-e6ff6ead7504'::uuid, 'Менеджер доступа'),
      ('a.zhumataev@satory.kz',          'Жұматаев Алдияр Даниярұлы',           v_oess,     '389ab909-aeac-4420-88ff-5c08ac0df3b3'::uuid, 'Системный администратор'),
      ('a.adilgaziev@satory.kz',         'Адильгазыев Акежан Адильетович',      v_oess,     '389ab909-aeac-4420-88ff-5c08ac0df3b3'::uuid, 'Системный администратор'),
      ('drycov@gmail.com',               'Рыков Денис Игорьевич',               v_oess,     '4eb33629-292d-478b-ad07-803d5042e667'::uuid, 'Начальник отдела эксплуатации сетей и связи'),
      ('m.mautbekov@satory.kz',          'Маутбеков Мирас Каирлиевич',          v_oess,     '71cf5cb2-d8e4-4265-b248-ec776c9ad73c'::uuid, 'Ведущий сетевой инженер'),
      ('a.kudageldinov@satory.kz',       'Кудагелдинов Адиль Амангазыевич',     v_oess,     '9810cd94-6b46-455b-a7c3-84ff853e9609'::uuid, 'Сетевой инженер'),
      ('v.saprykin@satory.kz',           'Сапрыкин Владислав',                  v_oess,     '9810cd94-6b46-455b-a7c3-84ff853e9609'::uuid, 'Сетевой инженер'),
      ('vmironov001@gmail.com',          'Махов Владислав Вадимович',           v_oess,     '9810cd94-6b46-455b-a7c3-84ff853e9609'::uuid, 'Сетевой инженер'),
      ('a.akhmetvaliev@satory.kz',       'Ахметвалиев Алмас Есдаулетович',      v_ops,      '5eb3b7f1-258a-4db5-897d-336166fc4830'::uuid, 'Начальник отдела технической эксплуатации'),
      ('r.zhunisbekov@satory.kz',        'Жүнісбеков Райнұр Сабырғалиұлы',      v_ops,      '7e98ac9e-cd5c-4782-a781-39688066225d'::uuid, 'Инженер отдела технической эксплуатации'),
      ('k.lepeshkin@satory.kz',          'Лепешкин Кирилл Евгеньевич',          v_prd,      'b9e1c46e-f37f-4b1d-bde9-4bbad6151c96'::uuid, 'Начальник производственного отдела'),
      ('s.kudabaev@satory.kz',           'Кудабаев Саят Нураханович',           v_prd,      '9d6ccae3-fb98-4889-b3e6-2f582b15c6ee'::uuid, 'Бригадир'),
      ('b.zhumadilov@satory.kz',         'Жумадилов Берик Талгатович',          v_prd,      '9d6ccae3-fb98-4889-b3e6-2f582b15c6ee'::uuid, 'Бригадир'),
      ('d.sharipov@satory.kz',           'Шарипов Дамир Аскарович',             v_prd,      '2336a846-e963-4b0d-a8a3-2fa9ff911a5d'::uuid, 'Старший энергетик')
    ) AS staff(email, full_name, dept_id, pos_id, pos_title)
  LOOP
    SELECT p.id INTO v_user_id
      FROM public.profiles p
     WHERE lower(p.email) = lower(r.email)
     LIMIT 1;

    IF v_user_id IS NULL THEN
      v_user_id := public.register_app_user(
        r.email,
        v_pwd,
        r.full_name,
        r.full_name,
        'ru',
        NULL,
        'email'
      );
    ELSE
      UPDATE public.profiles
         SET full_name_ru = r.full_name,
             full_name_kk = r.full_name,
             position_ru = r.pos_title,
             position_kk = r.pos_title,
             updated_at = now()
       WHERE id = v_user_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM public.profile_assignments pa
       WHERE pa.user_id = v_user_id
         AND pa.is_primary
         AND pa.end_date IS NULL
         AND pa.department_id = r.dept_id
         AND pa.position_id = r.pos_id
    ) THEN
      INSERT INTO public.profile_assignments (
        user_id, department_id, position_id, start_date, is_primary, reason, notes
      ) VALUES (
        v_user_id, r.dept_id, r.pos_id, current_date, true, 'hire',
        'Импорт штатного расписания филиала УКГ'
      );
    END IF;
  END LOOP;
END $seed$;

-- Department heads
UPDATE public.departments SET head_user_id = sub.head_id, updated_at = now()
FROM (VALUES
  ('UKG-SAT',      (SELECT id FROM public.profiles WHERE lower(email) = 'v.biryukov@satory.kz' LIMIT 1)),
  ('UKG-SAT-ADM',  (SELECT id FROM public.profiles WHERE lower(email) = 'v.biryukov@satory.kz' LIMIT 1)),
  ('UKG-SAT-MON',  (SELECT id FROM public.profiles WHERE lower(email) = 'a.polupanova@satory.kz' LIMIT 1)),
  ('UKG-SAT-IAM',  (SELECT id FROM public.profiles WHERE lower(email) = 'e.khamzinov@satory.kz' LIMIT 1)),
  ('UKG-SAT-OESS', (SELECT id FROM public.profiles WHERE lower(email) = 'drycov@gmail.com' LIMIT 1)),
  ('UKG-SAT-OPS',  (SELECT id FROM public.profiles WHERE lower(email) = 'a.akhmetvaliev@satory.kz' LIMIT 1)),
  ('UKG-SAT-PRD',  (SELECT id FROM public.profiles WHERE lower(email) = 'k.lepeshkin@satory.kz' LIMIT 1))
) AS sub(code, head_id)
WHERE departments.code = sub.code
  AND sub.head_id IS NOT NULL;

UPDATE public.organization
   SET head_user_id = (SELECT id FROM public.profiles WHERE lower(email) = 'v.biryukov@satory.kz' LIMIT 1),
       updated_at = now()
 WHERE head_user_id IS NULL
   AND EXISTS (SELECT 1 FROM public.profiles WHERE lower(email) = 'v.biryukov@satory.kz');
