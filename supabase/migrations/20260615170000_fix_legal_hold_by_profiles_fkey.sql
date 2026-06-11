-- App auth stores user ids in public.profiles, not auth.users.
-- legal_hold_by was added after app_db_auth repointing and still referenced auth.users.

UPDATE public.documents d
SET legal_hold_by = NULL
WHERE d.legal_hold_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = d.legal_hold_by
  );

UPDATE public.document_archive da
SET legal_hold_by = NULL
WHERE da.legal_hold_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = da.legal_hold_by
  );

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_legal_hold_by_fkey;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_legal_hold_by_fkey
  FOREIGN KEY (legal_hold_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.document_archive
  DROP CONSTRAINT IF EXISTS document_archive_legal_hold_by_fkey;

ALTER TABLE public.document_archive
  ADD CONSTRAINT document_archive_legal_hold_by_fkey
  FOREIGN KEY (legal_hold_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
