import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hashSignPayloadBase64, toSignPayloadBase64 } from "@/lib/eds/sign-payload";
import { verifyCmsSignature, type VerificationStatus } from "@/lib/eds/verify-cms";

type SignatureRow = {
  id: string;
  document_id: string;
  signer_id: string;
  payload: string | null;
  signed_at: string | null;
  signer_iin: string | null;
  content_hash: string | null;
  cert_valid_from: string | null;
  cert_valid_to: string | null;
};

type DocumentRow = {
  id: string;
  body: string | null;
};

async function resolveExpectedContentHash(
  doc: DocumentRow,
  signText?: string | null,
): Promise<string | null> {
  const text = signText?.trim() ? signText : doc.id;
  const b64 = toSignPayloadBase64(text);
  return b64 ? hashSignPayloadBase64(b64) : null;
}

export async function runSignatureVerification(
  signature: SignatureRow,
  doc: DocumentRow,
  signerProfileIin?: string | null,
  signText?: string | null,
) {
  if (!signature.payload) {
    return {
      status: "invalid" as VerificationStatus,
      verified_at: new Date().toISOString(),
      details: { errors: ["Пустая подпись"], warnings: [], cryptoVerified: false },
    };
  }

  const expectedContentHash = await resolveExpectedContentHash(doc, signText);
  const result = verifyCmsSignature(signature.payload, {
    signedAt: signature.signed_at,
    contentHash: signature.content_hash,
    expectedContentHash,
    expectedIin: signerProfileIin ?? signature.signer_iin,
    at: new Date(),
  });

  return {
    status: result.status,
    verified_at: new Date().toISOString(),
    details: {
      errors: result.errors,
      warnings: result.warnings,
      cryptoVerified: result.cryptoVerified,
      cert: result.cert,
    },
  };
}

export const verifyDocumentSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ signature_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: signature, error: sigErr } = await supabase
      .from("document_signatures")
      .select(
        "id, document_id, signer_id, payload, signed_at, signer_iin, content_hash, cert_valid_from, cert_valid_to",
      )
      .eq("id", data.signature_id)
      .single();

    if (sigErr || !signature) throw new Error("Подпись не найдена");

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, body")
      .eq("id", signature.document_id)
      .single();

    if (docErr || !doc) throw new Error("Документ не найден");

    const { data: signerProfile } = await supabase
      .from("profiles")
      .select("iin")
      .eq("id", signature.signer_id)
      .maybeSingle();

    const verification = await runSignatureVerification(
      signature as SignatureRow,
      doc as DocumentRow,
      signerProfile?.iin,
    );

    const { error: updErr } = await supabase
      .from("document_signatures")
      .update({
        verification_status: verification.status,
        verified_at: verification.verified_at,
        verification_details: verification.details,
      } as never)
      .eq("id", data.signature_id);

    if (updErr) throw new Error(updErr.message);

    return {
      signature_id: data.signature_id,
      verification_status: verification.status,
      verified_at: verification.verified_at,
      details: verification.details,
      verified_by: userId,
    };
  });
