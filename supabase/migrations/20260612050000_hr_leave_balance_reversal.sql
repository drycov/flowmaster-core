-- Reverse leave balance when approved request is cancelled or rejected

CREATE OR REPLACE FUNCTION public.leave_requests_after_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int;
  v_deducts boolean;
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.status = 'pending'
    AND NEW.status = 'approved'
    AND NEW.business_days > 0
  THEN
    SELECT deducts_balance INTO v_deducts
    FROM public.ref_absence_types
    WHERE id = NEW.absence_type_id;

    IF COALESCE(v_deducts, false) THEN
      v_year := EXTRACT(YEAR FROM NEW.date_from)::int;
      INSERT INTO public.leave_balances (user_id, year, entitled_days, used_days)
      VALUES (NEW.user_id, v_year, 24, NEW.business_days)
      ON CONFLICT (user_id, year)
      DO UPDATE SET used_days = public.leave_balances.used_days + EXCLUDED.used_days;
    END IF;
  ELSIF TG_OP = 'UPDATE'
    AND OLD.status = 'approved'
    AND NEW.status IN ('cancelled', 'rejected')
    AND OLD.business_days > 0
  THEN
    SELECT deducts_balance INTO v_deducts
    FROM public.ref_absence_types
    WHERE id = OLD.absence_type_id;

    IF COALESCE(v_deducts, false) THEN
      v_year := EXTRACT(YEAR FROM OLD.date_from)::int;
      UPDATE public.leave_balances
         SET used_days = GREATEST(used_days - OLD.business_days, 0)
       WHERE user_id = OLD.user_id
         AND year = v_year;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
