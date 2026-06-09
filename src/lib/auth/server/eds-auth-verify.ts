import type { EdsPolicySettings } from "@/lib/auth/policy";
import { extractCmsCertInfo, verifyCmsSignature } from "@/lib/eds/verify-cms";
import { extractIin, type CertInfo } from "./eds";

export function verifyEdsAuthSignature(
  signatureB64: string,
  edsPolicy: EdsPolicySettings,
): { certInfo: CertInfo; iin: string } {
  const cmsCert = extractCmsCertInfo(signatureB64);
  if (!cmsCert) {
    throw new Error("Не удалось разобрать подпись ЭЦП");
  }

  const result = verifyCmsSignature(signatureB64, { at: new Date() });

  if (edsPolicy.require_cert_valid) {
    if (result.status === "expired") {
      throw new Error("Срок действия сертификата истёк");
    }
    if (!result.valid && result.errors.length > 0) {
      throw new Error(result.errors[0]);
    }
  }

  const certInfo: CertInfo = {
    subject: cmsCert.subject,
    issuer: cmsCert.issuer,
    serial: cmsCert.serial,
    iin: cmsCert.iin,
    bin: cmsCert.bin,
    cn: cmsCert.cn,
  };

  const iin = extractIin(certInfo);
  if (!iin) {
    throw new Error("Не удалось определить ИИН из сертификата ЭЦП");
  }

  return { certInfo, iin };
}
