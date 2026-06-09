-- Default auth policy in organization.settings (public signup off after bootstrap)

UPDATE public.organization
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
  'auth', COALESCE(settings->'auth', '{}'::jsonb) || jsonb_build_object(
    'allow_public_signup', COALESCE((settings->'auth'->>'allow_public_signup')::boolean, false),
    'allow_eds_signup', COALESCE((settings->'auth'->>'allow_eds_signup')::boolean, true),
    'min_password_length', COALESCE((settings->'auth'->>'min_password_length')::int, 8),
    'require_strong_password', COALESCE((settings->'auth'->>'require_strong_password')::boolean, false),
    'session_ttl_hours', COALESCE((settings->'auth'->>'session_ttl_hours')::int, 168),
    'allowed_email_domains', COALESCE(settings->'auth'->'allowed_email_domains', '[]'::jsonb)
  ),
  'general', COALESCE(settings->'general', '{}'::jsonb) || jsonb_build_object(
    'default_locale', COALESCE(settings->'general'->>'default_locale', 'ru')
  )
)
WHERE settings IS NULL OR NOT (settings ? 'auth') OR NOT (settings ? 'general');
