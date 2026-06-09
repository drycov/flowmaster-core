-- Inline Telegram buttons for leave approval + reply_markup on outbox

ALTER TABLE public.telegram_outbox
  ADD COLUMN IF NOT EXISTS reply_markup jsonb;

CREATE OR REPLACE FUNCTION public.leave_requests_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type_name text;
  v_employee_name text;
  v_period text;
BEGIN
  SELECT COALESCE(at.name_ru, 'Отсутствие') INTO v_type_name
  FROM public.ref_absence_types at
  WHERE at.id = NEW.absence_type_id;

  v_period := to_char(NEW.date_from, 'DD.MM.YYYY')
    || CASE
      WHEN NEW.date_to <> NEW.date_from THEN ' — ' || to_char(NEW.date_to, 'DD.MM.YYYY')
      ELSE ''
    END;

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' AND NEW.approver_id IS NOT NULL THEN
    SELECT COALESCE(p.full_name_ru, p.email, 'Сотрудник') INTO v_employee_name
    FROM public.profiles p
    WHERE p.id = NEW.user_id;

    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (
      NEW.approver_id,
      'hr',
      'Заявка на согласование: ' || v_type_name,
      v_employee_name || ' · ' || v_period,
      '/hr/leave/approvals?request=' || NEW.id::text
    );
  ELSIF TG_OP = 'UPDATE'
    AND OLD.status = 'pending'
    AND NEW.status IN ('approved', 'rejected')
  THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (
      NEW.user_id,
      'hr',
      CASE NEW.status
        WHEN 'approved' THEN 'Отпуск согласован'
        ELSE 'Заявка не согласована'
      END,
      v_type_name || ' · ' || v_period,
      '/hr/leave'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_notification_telegram()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id text;
  v_text text;
  v_link text;
  v_reply_markup jsonb;
  v_leave_id text;
BEGIN
  IF NOT public.should_send_notification_telegram(NEW.user_id, NEW.type, NEW.title) THEN
    RETURN NEW;
  END IF;

  SELECT pref.telegram_chat_id INTO v_chat_id
  FROM public.user_notification_preferences pref
  WHERE pref.user_id = NEW.user_id;

  IF v_chat_id IS NULL OR btrim(v_chat_id) = '' THEN
    RETURN NEW;
  END IF;

  v_text := '<b>' || replace(NEW.title, '<', '&lt;') || '</b>';
  IF NEW.body IS NOT NULL AND btrim(NEW.body) <> '' THEN
    v_text := v_text || E'\n' || replace(NEW.body, '<', '&lt;');
  END IF;
  v_link := NEW.link;
  v_reply_markup := NULL;

  IF NEW.type = 'hr'
    AND NEW.link LIKE '%request=%'
    AND NEW.title LIKE 'Заявка на согласование%'
  THEN
    v_leave_id := split_part(split_part(NEW.link, 'request=', 2), '&', 1);
    IF v_leave_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_reply_markup := jsonb_build_object(
        'inline_keyboard', jsonb_build_array(
          jsonb_build_array(
            jsonb_build_object('text', '✅ Согласовать', 'callback_data', 'leave:approve:' || v_leave_id),
            jsonb_build_object('text', '❌ Отклонить', 'callback_data', 'leave:reject:' || v_leave_id)
          )
        )
      );
    END IF;
  END IF;

  INSERT INTO public.telegram_outbox (
    notification_id, user_id, chat_id, message_text, app_link, reply_markup, status
  ) VALUES (
    NEW.id,
    NEW.user_id,
    v_chat_id,
    v_text,
    v_link,
    v_reply_markup,
    'pending'
  );

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
