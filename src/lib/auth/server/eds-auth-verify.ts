import type { EdsPolicySettings } from "@/lib/auth/policy";
import { extractCmsCertInfo, verifyCmsSignature } from "@/lib/eds/verify-cms";
import { extractIin, type CertInfo } from "./eds";

export function verifyEdsAuthSignature(
  signatureB64: string,
  edsPolicy: EdsPolicySettings,
  clientCertInfo?: CertInfo,
): { certInfo: CertInfo; iin: string } {
  let cmsCert = extractCmsCertInfo(signatureB64);

  if (!cmsCert && clientCertInfo?.iin) {
    cmsCert = {
      subject: clientCertInfo.subject,
      issuer: clientCertInfo.issuer,
      serial: clientCertInfo.serial,
      iin: clientCertInfo.iin,
      bin: clientCertInfo.bin,
      cn: clientCertInfo.cn,
    };
  }

  if (!cmsCert) {
    throw new Error("Не удалось разобрать подпись ЭЦП");
  }

  if (
    clientCertInfo?.iin &&
    cmsCert.iin &&
    clientCertInfo.iin !== cmsCert.iin
  ) {
    throw new Error("ИИН сертификата не совпадает с данными подписи");
  }

  const result = verifyCmsSignature(signatureB64, {
    at: new Date(),
    expectedIin: clientCertInfo?.iin ?? cmsCert.iin,
  });

  if (edsPolicy.require_cert_valid) {
    if (result.status === "expired") {
      throw new Error("Срок действия сертификата истёк");
    }
    if (!result.valid && result.errors.length > 0) {
      throw new Error(result.errors[0]);
    }
  }

  const certInfo: CertInfo = {
    subject: cmsCert.subject ?? clientCertInfo?.subject,
    issuer: cmsCert.issuer ?? clientCertInfo?.issuer,
    serial: cmsCert.serial ?? clientCertInfo?.serial,
    iin: cmsCert.iin ?? clientCertInfo?.iin,
    bin: cmsCert.bin ?? clientCertInfo?.bin,
    cn: cmsCert.cn ?? clientCertInfo?.cn,
  };

  const iin = extractIin(certInfo);
  if (!iin) {
    throw new Error("Не удалось определить ИИН из сертификата ЭЦП");
  }

  return { certInfo, iin };
}
