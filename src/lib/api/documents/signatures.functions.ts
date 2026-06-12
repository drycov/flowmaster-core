import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceModuleLicense } from "../_helpers";
import { persistDocumentSignature } from "@/lib/eds/persist-signature.server";

export const addSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      document_id: z.string().uuid(),
      version_id: z.string().uuid().optional().nullable(),
      payload: z.string().min(1),
      cert_subject: z.string().optional().nullable(),
      cert_serial: z.string().optional().nullable(),
      cert_issuer: z.string().optional().nullable(),
      signature_type: z.string().default("CMS"),
      workflow_task_id: z.string().uuid().optional().nullable(),
      signer_iin: z.string().optional().nullable(),
      signer_bin: z.string().optional().nullable(),
      cert_valid_from: z.string().optional().nullable(),
      cert_valid_to: z.string().optional().nullable(),
      cert_fingerprint: z.string().optional().nullable(),
      content_hash: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    await enforceModuleLicense(context.supabase, "eds_signing", "write");
    return persistDocumentSignature(context.supabase, context.userId, {
      ...data,
      signing_provider: "ncalayer",
    });
  });
