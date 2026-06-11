-- Optional product modules: office (ONLYOFFICE), reports, monitoring — license feature flags.

UPDATE public.installation_license
SET features = COALESCE(features, '{}'::jsonb) || jsonb_strip_nulls(
  jsonb_build_object(
    'office',
    CASE
      WHEN features ? 'office' THEN (features->>'office')::boolean
      WHEN plan IN ('trial', 'professional', 'enterprise') THEN true
      ELSE false
    END,
    'reports',
    CASE
      WHEN features ? 'reports' THEN (features->>'reports')::boolean
      WHEN plan IN ('trial', 'professional', 'enterprise') THEN true
      ELSE false
    END,
    'monitoring',
    CASE
      WHEN features ? 'monitoring' THEN (features->>'monitoring')::boolean
      WHEN plan IN ('trial', 'enterprise') THEN true
      ELSE false
    END
  )
);

NOTIFY pgrst, 'reload schema';
