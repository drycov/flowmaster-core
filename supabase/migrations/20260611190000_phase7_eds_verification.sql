-- Phase 7: EDS verification metadata + signing policies

ALTER TABLE public.document_signatures
  ADD COLUMN IF NOT EXISTS signer_iin text,
  ADD COLUMN IF NOT EXISTS signer_bin text,
  ADD COLUMN IF NOT EXISTS cert_valid_from timestamptz,
  ADD COLUMN IF NOT EXISTS cert_valid_to timestamptz,
  ADD COLUMN IF NOT EXISTS cert_fingerprint text,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'valid', 'expired', 'invalid', 'content_changed')),
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_details jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_sig_verification
  ON public.document_signatures (document_id, verification_status);

ALTER TABLE public.organization
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.organization
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
  'eds', jsonb_build_object(
    'require_iin_match', true,
    'require_cert_valid', true,
    'allow_org_certificate', true
  )
)
WHERE settings IS NULL OR NOT (settings ? 'eds');
