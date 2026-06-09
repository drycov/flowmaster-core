-- Combined auth: email + EDS on one profile (auth_method 'both', challenge purpose 'link')

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_auth_method_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_auth_method_check
  CHECK (auth_method IN ('email', 'eds', 'both'));

ALTER TABLE public.auth_challenges DROP CONSTRAINT IF EXISTS auth_challenges_purpose_check;
ALTER TABLE public.auth_challenges
  ADD CONSTRAINT auth_challenges_purpose_check
  CHECK (purpose IN ('login', 'register', 'link'));

NOTIFY pgrst, 'reload schema';
