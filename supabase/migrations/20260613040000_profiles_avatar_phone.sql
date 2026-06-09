-- Profile avatar URL (storage bucket "avatars") and contact phone

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.profiles.avatar_url IS 'Public URL in storage bucket avatars';
COMMENT ON COLUMN public.profiles.phone IS 'User contact phone';

NOTIFY pgrst, 'reload schema';
