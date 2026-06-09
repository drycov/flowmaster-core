-- Seed organization singleton from CSV export
-- Replace default placeholder with SATORY requisites

DELETE FROM public.organization
WHERE id <> '09f62d5d-26cf-48dd-8bd9-f5ff05ce4dfa'::uuid;

INSERT INTO public.organization (
  id, name_ru, name_kk, short_name_ru, short_name_kk, bin,
  legal_address_ru, legal_address_kk, phone, email, website,
  head_user_id, logo_url, reg_number_prefix, created_at, updated_at
) VALUES (
  '09f62d5d-26cf-48dd-8bd9-f5ff05ce4dfa'::uuid,
  'ТОО "SATORY COMPANY LTD"',
  'Satory Company LTD',
  'Satory',
  'Satory',
  '040940014188',
  '050040, ГОРОД АЛМАТЫ, БОСТАНДЫКСКИЙ РАЙОН, УЛ. САТПАЕВА, Д. 29/6, 104А',
  '050040, ГОРОД АЛМАТЫ, БОСТАНДЫКСКИЙ РАЙОН, УЛ. САТПАЕВА, Д. 29/6, 104А',
  '87019899813',
  'r.sadyrova@satory.kz',
  '',
  NULL,
  '',
  'SAT',
  '2026-06-05 03:32:27.018849+00'::timestamptz,
  '2026-06-05 03:51:26.4448+00'::timestamptz
)
ON CONFLICT (id) DO UPDATE SET
  name_ru = EXCLUDED.name_ru,
  name_kk = EXCLUDED.name_kk,
  short_name_ru = EXCLUDED.short_name_ru,
  short_name_kk = EXCLUDED.short_name_kk,
  bin = EXCLUDED.bin,
  legal_address_ru = EXCLUDED.legal_address_ru,
  legal_address_kk = EXCLUDED.legal_address_kk,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  website = EXCLUDED.website,
  head_user_id = EXCLUDED.head_user_id,
  logo_url = EXCLUDED.logo_url,
  reg_number_prefix = EXCLUDED.reg_number_prefix,
  updated_at = EXCLUDED.updated_at;
