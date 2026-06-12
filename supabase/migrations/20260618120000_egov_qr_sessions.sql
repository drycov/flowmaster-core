-- eGov QR signing sessions (SIGEX proxy URLs stored server-side only)

CREATE TABLE IF NOT EXISTS public.egov_qr_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organization(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  workflow_task_id uuid REFERENCES public.workflow_tasks(id) ON DELETE SET NULL,
  sign_text_hash text NOT NULL,
  data_url text NOT NULL,
  sign_url text NOT NULL,
  qr_code text NOT NULL,
  mobile_launch_url text,
  expire_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'data_sent', 'completed', 'canceled', 'expired', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_egov_qr_sessions_user ON public.egov_qr_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_egov_qr_sessions_doc ON public.egov_qr_sessions (document_id);

GRANT ALL ON public.egov_qr_sessions TO service_role;
ALTER TABLE public.egov_qr_sessions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_egov_qr_sessions_updated ON public.egov_qr_sessions;
CREATE TRIGGER trg_egov_qr_sessions_updated
  BEFORE UPDATE ON public.egov_qr_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
