-- Department-scoped duty roles for UKG branch subdivisions

INSERT INTO public.ref_duty_roles (code, name_ru, name_kk, color, department_id, sort_order)
SELECT
  'dept_duty_' || lower(replace(d.code, '-', '_')),
  'Дежурный — ' || d.name_ru,
  'Кезекші — ' || d.name_kk,
  '#8b5cf6',
  d.id,
  100 + row_number() OVER (ORDER BY d.code)
FROM public.departments d
WHERE d.code LIKE 'UKG-SAT-%'
  AND d.is_active = true
ON CONFLICT (code) DO UPDATE SET
  name_ru = EXCLUDED.name_ru,
  name_kk = EXCLUDED.name_kk,
  department_id = EXCLUDED.department_id,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order,
  is_active = true;

NOTIFY pgrst, 'reload schema';
