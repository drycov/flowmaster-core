-- Seed departments and positions from CSV exports
-- Departments: 8, Positions: 19

INSERT INTO public.departments (
  id, parent_id, code, name_ru, name_kk, head_user_id, kind, phone, email, is_active, deputy_user_ids, created_at, updated_at
) VALUES
  ('a0ba297d-2fd1-4b9d-b31e-7a3272017ce9'::uuid, NULL, 'SAT', 'ТОО "SATORY COMPANY LTD"', 'ТОО "SATORY COMPANY LTD"', NULL, 'company', '', '', true, '{}'::uuid[], '2026-06-05 03:52:21.896502+00'::timestamptz, '2026-06-05 03:52:21.896502+00'::timestamptz),
  ('78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid, 'a0ba297d-2fd1-4b9d-b31e-7a3272017ce9'::uuid, 'UKG-SAT', 'ФИЛИАЛ ТОО "SATORY COMPANY LTD" В ГОРОДЕ УСТЬ-КАМЕНОГОРСК', 'ФИЛИАЛ ТОО "SATORY COMPANY LTD" В ГОРОДЕ УСТЬ-КАМЕНОГОРСК', NULL, 'branch', '', '', true, '{}'::uuid[], '2026-06-05 03:52:49.737598+00'::timestamptz, '2026-06-05 03:52:49.737598+00'::timestamptz),
  ('2d1b9434-2e90-485c-b918-037b8c24fefa'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid, 'UKG-SAT-MON', 'Центр мониторинга', 'Центр мониторинга', NULL, 'department', '', '', true, '{}'::uuid[], '2026-06-05 04:11:34.006677+00'::timestamptz, '2026-06-05 04:11:34.006677+00'::timestamptz),
  ('e5c531e6-b3ae-47bf-a757-298430a1296d'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid, 'UKG-SAT-IAM', 'Отдел доступов и разрешений', 'Отдел доступов и разрешений', NULL, 'department', '', '', true, '{}'::uuid[], '2026-06-05 04:12:04.175863+00'::timestamptz, '2026-06-05 04:12:04.175863+00'::timestamptz),
  ('26b0c55d-8607-4f31-af78-776950fe5b8c'::uuid, 'a0ba297d-2fd1-4b9d-b31e-7a3272017ce9'::uuid, 'CORE-SAT-BUH', 'Бухгалтерия', 'Бухгалтерия', NULL, 'department', '', '', true, '{}'::uuid[], '2026-06-05 03:53:30.657674+00'::timestamptz, '2026-06-05 03:53:30.657674+00'::timestamptz),
  ('bd22ccb4-f044-412c-9c52-377641fc642e'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid, 'UKG-SAT-OESS', 'Отдел эксплутации сети и связи', 'Отдел эксплутации сети и связи', (CASE WHEN EXISTS (SELECT 1 FROM auth.users u WHERE u.id = '579b8f8e-e74e-425c-bbe7-832bb67840c2'::uuid) THEN '579b8f8e-e74e-425c-bbe7-832bb67840c2'::uuid ELSE NULL END), 'department', '+77710515252', 'oess@satory.kz', true, '{}'::uuid[], '2026-06-04 11:37:41.975121+00'::timestamptz, '2026-06-04 11:37:41.975121+00'::timestamptz),
  ('0a99623d-b7d6-428d-a9c5-d538960c70b0'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid, 'UKG-SAT-OPS', 'Отдел технической эксплуатации', 'Отдел технической эксплуатации', NULL, 'department', '', 'OPS@satory.kz', true, '{}'::uuid[], '2026-06-05 04:12:36.766779+00'::timestamptz, '2026-06-05 04:12:36.766779+00'::timestamptz),
  ('8f169fb3-7fe7-49c0-bf08-3d6c179a44da'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid, 'UKG-SAT-PRD', 'Производственный отдел', 'Производственный отдел', NULL, 'department', '', 'PRD@satory.kz', true, '{}'::uuid[], '2026-06-05 04:14:19.819788+00'::timestamptz, '2026-06-05 04:14:19.819788+00'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  code = EXCLUDED.code,
  name_ru = EXCLUDED.name_ru,
  name_kk = EXCLUDED.name_kk,
  head_user_id = EXCLUDED.head_user_id,
  kind = EXCLUDED.kind,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  is_active = EXCLUDED.is_active,
  deputy_user_ids = EXCLUDED.deputy_user_ids,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.positions (
  id, code, title_ru, title_kk, department_id, level, is_head, created_at, updated_at
) VALUES
  ('1c660c25-472d-4f15-8440-1dfe46432468'::uuid, 'dir', 'Директор филиала', 'Директор филиала', '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid, 0::int, true, '2026-06-05 04:16:41.064129+00'::timestamptz, '2026-06-05 04:16:41.064129+00'::timestamptz),
  ('53e4adda-8cf8-4eb0-9d86-1a0c42192b9b'::uuid, 'chief_eng', 'Главный инженер', 'Главный инженер', '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid, 1::int, true, '2026-06-05 04:16:59.887898+00'::timestamptz, '2026-06-05 04:16:59.887898+00'::timestamptz),
  ('f20e1e0b-ae1d-4685-895b-73b16abc7a98'::uuid, 'accountant', 'Бухгалтер', 'Бухгалтер', '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid, 3::int, false, '2026-06-05 04:17:33.896329+00'::timestamptz, '2026-06-05 04:21:01.185983+00'::timestamptz),
  ('e6008a0c-2411-4194-9ad2-4443785a17e4'::uuid, 'chief_accountant', 'Главный бухгалтер филиала', 'Главный бухгалтер филиала', '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid, 1::int, true, '2026-06-05 04:21:19.877379+00'::timestamptz, '2026-06-05 04:21:19.877379+00'::timestamptz),
  ('4c51958c-d98f-4232-9f1a-d2abe90a57b7'::uuid, 'spec_hr', 'Специалист по кадрам', 'Специалист по кадрам', '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid, 3::int, false, '2026-06-05 04:21:42.122166+00'::timestamptz, '2026-06-05 04:21:42.122166+00'::timestamptz),
  ('3ae08b3a-9393-494b-b144-59610a5bb763'::uuid, 'storekeeper', 'Кладовщик', 'Кладовщик', '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid, 4::int, false, '2026-06-05 04:22:05.66692+00'::timestamptz, '2026-06-05 04:22:05.66692+00'::timestamptz),
  ('eab93816-6b03-48f1-aff3-86e24228fd9c'::uuid, 'head_monitoring', 'Руководитель центра мониторинга', 'Руководитель центра мониторинга', '2d1b9434-2e90-485c-b918-037b8c24fefa'::uuid, 1::int, true, '2026-06-05 04:22:58.820636+00'::timestamptz, '2026-06-05 04:22:58.820636+00'::timestamptz),
  ('7d7b2d8f-7699-4236-a2af-317556913ae9'::uuid, 'spec_monitoring', 'Специалист по мониторингу', 'Специалист по мониторингу', '2d1b9434-2e90-485c-b918-037b8c24fefa'::uuid, 3::int, false, '2026-06-05 04:23:15.030246+00'::timestamptz, '2026-06-05 04:23:15.030246+00'::timestamptz),
  ('61814a13-211f-4e38-b2be-1f1f7ed9c020'::uuid, 'senior_access_manager', 'Старший менеджер доступа', 'Старший менеджер доступа', 'e5c531e6-b3ae-47bf-a757-298430a1296d'::uuid, 1::int, true, '2026-06-05 04:23:50.886194+00'::timestamptz, '2026-06-05 04:23:50.886194+00'::timestamptz),
  ('1b3d0fa7-093e-4a96-aee4-e6ff6ead7504'::uuid, 'access_manager', 'Менеджер доступа', 'Менеджер доступа', 'e5c531e6-b3ae-47bf-a757-298430a1296d'::uuid, 3::int, false, '2026-06-05 04:24:13.974221+00'::timestamptz, '2026-06-05 04:24:13.974221+00'::timestamptz),
  ('389ab909-aeac-4420-88ff-5c08ac0df3b3'::uuid, 'sys_admin', 'Системный администратор', 'Системный администратор', 'bd22ccb4-f044-412c-9c52-377641fc642e'::uuid, 3::int, false, '2026-06-05 04:25:54.68216+00'::timestamptz, '2026-06-05 04:25:54.68216+00'::timestamptz),
  ('4eb33629-292d-478b-ad07-803d5042e667'::uuid, 'head_net_dep', 'Начальник отдела эксплуатации сетей и связи', 'Начальник отдела эксплуатации сетей и связи', 'bd22ccb4-f044-412c-9c52-377641fc642e'::uuid, 1::int, true, '2026-06-05 04:26:16.590006+00'::timestamptz, '2026-06-05 04:26:16.590006+00'::timestamptz),
  ('71cf5cb2-d8e4-4265-b248-ec776c9ad73c'::uuid, 'lead_net_eng', 'Ведущий сетевой инженер', 'Ведущий сетевой инженер', 'bd22ccb4-f044-412c-9c52-377641fc642e'::uuid, 2::int, false, '2026-06-05 04:26:32.332905+00'::timestamptz, '2026-06-05 04:26:32.332905+00'::timestamptz),
  ('5eb3b7f1-258a-4db5-897d-336166fc4830'::uuid, 'head_tech_dep', 'Начальник отдела технической эксплуатации', 'Начальник отдела технической эксплуатации', '0a99623d-b7d6-428d-a9c5-d538960c70b0'::uuid, 1::int, true, '2026-06-05 04:27:10.202928+00'::timestamptz, '2026-06-05 04:27:10.202928+00'::timestamptz),
  ('9810cd94-6b46-455b-a7c3-84ff853e9609'::uuid, 'net_eng', 'Сетевой инженер', 'Сетевой инженер', 'bd22ccb4-f044-412c-9c52-377641fc642e'::uuid, 3::int, false, '2026-06-05 04:26:52.965064+00'::timestamptz, '2026-06-05 04:27:20.920909+00'::timestamptz),
  ('7e98ac9e-cd5c-4782-a781-39688066225d'::uuid, 'tech_eng', 'Инженер отдела технической эксплуатации', 'Инженер отдела технической эксплуатации', '0a99623d-b7d6-428d-a9c5-d538960c70b0'::uuid, 3::int, false, '2026-06-05 04:27:41.812712+00'::timestamptz, '2026-06-05 04:27:41.812712+00'::timestamptz),
  ('b9e1c46e-f37f-4b1d-bde9-4bbad6151c96'::uuid, 'head_prod_dep', 'Начальник производственного отдела', 'Начальник производственного отдела', '8f169fb3-7fe7-49c0-bf08-3d6c179a44da'::uuid, 1::int, true, '2026-06-05 04:28:05.76483+00'::timestamptz, '2026-06-05 04:28:05.76483+00'::timestamptz),
  ('9d6ccae3-fb98-4889-b3e6-2f582b15c6ee'::uuid, 'brigadier', 'Бригадир', 'Бригадир', '8f169fb3-7fe7-49c0-bf08-3d6c179a44da'::uuid, 2::int, false, '2026-06-05 04:28:23.620655+00'::timestamptz, '2026-06-05 04:28:23.620655+00'::timestamptz),
  ('2336a846-e963-4b0d-a8a3-2fa9ff911a5d'::uuid, 'senior_energy', 'Старший энергетик', 'Старший энергетик', '8f169fb3-7fe7-49c0-bf08-3d6c179a44da'::uuid, 2::int, false, '2026-06-05 04:28:42.185209+00'::timestamptz, '2026-06-05 04:28:42.185209+00'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  title_ru = EXCLUDED.title_ru,
  title_kk = EXCLUDED.title_kk,
  department_id = EXCLUDED.department_id,
  level = EXCLUDED.level,
  is_head = EXCLUDED.is_head,
  updated_at = EXCLUDED.updated_at;

-- Re-link nomenclature items to departments (from prior export)
UPDATE public.nomenclature_items n SET department_id = v.dept_id
FROM (VALUES
  ('dd2fd3ec-04a9-45a8-ac55-13215f26401d'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('76618250-51a5-4e0c-95fc-da220f51df3a'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('7ab62545-1d94-46a3-9bbd-5fec648a71aa'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('55e360e8-e13e-43af-8cec-7179914808fe'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('97cf4eb8-31b0-4cd7-bbf1-5f322245bf2f'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('69696112-c875-479a-9b99-2837877a86ff'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('a5691545-6287-476c-8579-3f7bfa80df17'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('c71331b2-23a2-4f16-a433-0e35e4a56a2b'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('6352e65a-be26-4181-b881-1ba8920b3320'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('f21a3b24-7c3d-4e47-9a9b-ab36f0ec0c1c'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('a0c35486-3288-4ec3-845d-374affeac753'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('738313fe-6a92-426f-b9e8-4ff468505575'::uuid, '26b0c55d-8607-4f31-af78-776950fe5b8c'::uuid),
  ('3255a291-1620-4725-be16-8a540edacfdc'::uuid, '26b0c55d-8607-4f31-af78-776950fe5b8c'::uuid),
  ('253a8247-d2f0-42ae-8004-c42202164d41'::uuid, '26b0c55d-8607-4f31-af78-776950fe5b8c'::uuid),
  ('c93259c0-dfa4-4d54-a61b-90abab4181b9'::uuid, '26b0c55d-8607-4f31-af78-776950fe5b8c'::uuid),
  ('f9d546ec-9616-4ea0-a7c2-13028e8b7620'::uuid, '26b0c55d-8607-4f31-af78-776950fe5b8c'::uuid),
  ('b415eeec-ac28-4895-b155-6988d9621950'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('86f98c36-94c6-4097-ba77-cd750fbaadbf'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('9c7932ee-8a34-4dd5-95f6-4773765f7355'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('afd55e59-1988-43d3-b59f-4882ddef97e2'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('fac10e7f-52ce-49cc-9b39-1f9821571112'::uuid, 'bd22ccb4-f044-412c-9c52-377641fc642e'::uuid),
  ('8014ae8b-266e-40a0-8e70-04ee42dc36af'::uuid, 'bd22ccb4-f044-412c-9c52-377641fc642e'::uuid),
  ('9efcdf76-555e-473a-b03f-915c837868bd'::uuid, 'bd22ccb4-f044-412c-9c52-377641fc642e'::uuid),
  ('d3014515-54df-4327-905e-3106c5e7ade4'::uuid, '2d1b9434-2e90-485c-b918-037b8c24fefa'::uuid),
  ('ebe1ead5-ebcf-42bd-8621-759c0eeaf9d7'::uuid, 'bd22ccb4-f044-412c-9c52-377641fc642e'::uuid),
  ('787bfd04-8e1a-487c-b6f7-510db7d32878'::uuid, '2d1b9434-2e90-485c-b918-037b8c24fefa'::uuid),
  ('9670f31d-7042-4988-9edd-b295ae21b7fc'::uuid, 'e5c531e6-b3ae-47bf-a757-298430a1296d'::uuid),
  ('ea9ad579-5d28-44ea-9709-ffe1d665778d'::uuid, 'e5c531e6-b3ae-47bf-a757-298430a1296d'::uuid),
  ('ea04c169-3eb8-4220-a382-0ed7fee9edf0'::uuid, 'e5c531e6-b3ae-47bf-a757-298430a1296d'::uuid),
  ('6c526772-db83-4bcf-be37-e70e32a9339f'::uuid, 'e5c531e6-b3ae-47bf-a757-298430a1296d'::uuid),
  ('d84ac0a4-6744-4c5b-9e37-532a5364636d'::uuid, 'e5c531e6-b3ae-47bf-a757-298430a1296d'::uuid),
  ('756ce796-eb15-4469-b8ed-f62fc6614f07'::uuid, '8f169fb3-7fe7-49c0-bf08-3d6c179a44da'::uuid),
  ('c1cf204a-1880-44ad-8345-63a64ba8c472'::uuid, '8f169fb3-7fe7-49c0-bf08-3d6c179a44da'::uuid),
  ('7d1c98bc-d8e8-4026-8f60-7d8a5b6ff923'::uuid, '8f169fb3-7fe7-49c0-bf08-3d6c179a44da'::uuid),
  ('b3347139-c4f8-4aaa-bb57-040ec128db94'::uuid, '8f169fb3-7fe7-49c0-bf08-3d6c179a44da'::uuid),
  ('3015da13-b31b-4e1b-ba7d-c5d5c928fe71'::uuid, '8f169fb3-7fe7-49c0-bf08-3d6c179a44da'::uuid),
  ('43338d1a-fe4e-435d-ae45-d6973e7836f6'::uuid, '0a99623d-b7d6-428d-a9c5-d538960c70b0'::uuid),
  ('25c6a6a5-bb17-43e7-afef-784de902d78d'::uuid, '0a99623d-b7d6-428d-a9c5-d538960c70b0'::uuid),
  ('1329e820-19ec-46ed-b25e-137968cff6f3'::uuid, '2d1b9434-2e90-485c-b918-037b8c24fefa'::uuid),
  ('08d9f144-cd92-4c30-8bc2-b89dd71ab3b3'::uuid, '0a99623d-b7d6-428d-a9c5-d538960c70b0'::uuid),
  ('8e2ec434-005e-4a71-bdea-e055016e19ef'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('7f5caa2d-8205-4b3b-9685-e0b840c71c97'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('05025cbc-2993-44c2-9c5b-6dcd7ad83d75'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('c442e533-f4aa-462e-ab8c-c7e45f0f20ee'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('45141b77-b53b-480a-a38c-70aad686e0bb'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('bf98af11-8f2b-4865-bda6-493d1d1f6ba7'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid),
  ('0bc9bf24-e213-4070-88c1-50e6309ac168'::uuid, '78005b21-f7cb-4d0c-9ea1-3da26e0a7e66'::uuid)
) AS v(nom_id, dept_id)
WHERE n.id = v.nom_id;
