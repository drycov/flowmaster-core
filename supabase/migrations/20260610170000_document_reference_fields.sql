-- Link documents to reference catalogs: document types, priorities, correspondents

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS document_type_id UUID REFERENCES public.ref_document_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority_id UUID REFERENCES public.ref_priorities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS correspondent_id UUID REFERENCES public.ref_correspondents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_document_type_id ON public.documents(document_type_id);
CREATE INDEX IF NOT EXISTS idx_documents_priority_id ON public.documents(priority_id);
CREATE INDEX IF NOT EXISTS idx_documents_correspondent_id ON public.documents(correspondent_id);

-- Backfill document_type_id from legacy doc_type code
UPDATE public.documents d
SET document_type_id = dt.id
FROM public.ref_document_types dt
WHERE d.document_type_id IS NULL
  AND d.doc_type = dt.code;

-- Default priority "normal" for documents without priority
UPDATE public.documents d
SET priority_id = p.id
FROM public.ref_priorities p
WHERE d.priority_id IS NULL
  AND p.code = 'normal';
