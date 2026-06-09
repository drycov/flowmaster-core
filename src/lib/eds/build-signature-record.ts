import type { FullSignResult } from "@/lib/ncalayer";
import { hashSignPayloadBase64, toSignPayloadBase64 } from "@/lib/eds/sign-payload";

export function buildSignatureInsertData(args: {
  documentId: string;
  signText: string;
  result: FullSignResult;
  workflowTaskId?: string | null;
}) {
  const payloadB64 = toSignPayloadBase64(args.signText);

  return {
    document_id: args.documentId,
    payload: args.result.signature,
    signature_type: "CMS" as const,
    cert_subject: args.result.certInfo.subject ?? null,
    cert_serial: args.result.certInfo.serial ?? null,
    cert_issuer: args.result.certInfo.issuer ?? null,
    signer_iin: args.result.certInfo.iin ?? null,
    signer_bin: args.result.certInfo.bin ?? null,
    cert_valid_from: args.result.certInfo.validFrom ?? null,
    cert_valid_to: args.result.certInfo.validTo ?? null,
    cert_fingerprint: args.result.fingerprint ?? null,
    content_hash: payloadB64 ? hashSignPayloadBase64(payloadB64) : null,
    workflow_task_id: args.workflowTaskId ?? null,
  };
}
