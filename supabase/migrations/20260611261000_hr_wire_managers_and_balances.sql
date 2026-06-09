-- Wire HR: manager_user_id on assignments + seed leave balances for 2026

UPDATE public.profile_assignments pa
   SET manager_user_id = d.head_user_id
  FROM public.departments d
 WHERE pa.department_id = d.id
   AND pa.is_primary = true
   AND pa.end_date IS NULL
   AND d.head_user_id IS NOT NULL
   AND d.head_user_id <> pa.user_id;

INSERT INTO public.leave_balances (user_id, year, entitled_days, used_days)
SELECT DISTINCT pa.user_id, 2026, 24, 0
  FROM public.profile_assignments pa
 WHERE pa.is_primary = true
   AND pa.end_date IS NULL
ON CONFLICT (user_id, year) DO NOTHING;

NOTIFY pgrst, 'reload schema';
