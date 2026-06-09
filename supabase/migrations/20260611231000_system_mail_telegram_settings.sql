UPDATE public.organization
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
  'mail', COALESCE(settings->'mail', '{}'::jsonb) || jsonb_build_object(
    'enabled', COALESCE((settings->'mail'->>'enabled')::boolean, false),
    'provider', COALESCE(settings->'mail'->>'provider', 'resend'),
    'from_address', COALESCE(settings->'mail'->>'from_address', ''),
    'from_name', COALESCE(settings->'mail'->>'from_name', 'ЕСЭДО'),
    'resend_api_key', COALESCE(settings->'mail'->>'resend_api_key', ''),
    'smtp_host', COALESCE(settings->'mail'->>'smtp_host', ''),
    'smtp_port', COALESCE((settings->'mail'->>'smtp_port')::int, 587),
    'smtp_user', COALESCE(settings->'mail'->>'smtp_user', ''),
    'smtp_password', COALESCE(settings->'mail'->>'smtp_password', ''),
    'smtp_secure', COALESCE((settings->'mail'->>'smtp_secure')::boolean, false)
  ),
  'telegram', COALESCE(settings->'telegram', '{}'::jsonb) || jsonb_build_object(
    'enabled', COALESCE((settings->'telegram'->>'enabled')::boolean, false),
    'bot_token', COALESCE(settings->'telegram'->>'bot_token', ''),
    'default_chat_id', COALESCE(settings->'telegram'->>'default_chat_id', ''),
    'notify_on_tasks', COALESCE((settings->'telegram'->>'notify_on_tasks')::boolean, true),
    'notify_on_approvals', COALESCE((settings->'telegram'->>'notify_on_approvals')::boolean, true)
  )
)
WHERE settings IS NULL OR NOT (settings ? 'mail') OR NOT (settings ? 'telegram');
