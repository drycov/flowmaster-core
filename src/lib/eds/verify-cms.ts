import forge from "node-forge";
import { extractIIN, parseCertDerBase64 } from "@/lib/iin-parser";

export type VerificationStatus =
  | "unverified"
  | "valid"
  | "expired"
  | "invalid"
  | "content_changed";

export interface CmsCertInfo {
  subject?: string;
  issuer?: string;
  serial?: string;
  iin?: string;
  bin?: string;
  cn?: string;
  validFrom?: Date;
  validTo?: Date;
}

export interface VerifyCmsOptions {
  signedAt?: string | Date | null;
  contentHash?: string | null;
  expectedContentHash?: string | null;
  expectedIin?: string | null;
  at?: Date;
}

export interface CmsVerificationResult {
  valid: boolean;
  status: VerificationStatus;
  cert: CmsCertInfo;
  errors: string[];
  warnings: string[];
  cryptoVerified: boolean;
}

function formatDn(attrs: forge.pki.CertificateField[]): string {
  return attrs
    .map((attr) => `${attr.shortName || attr.name || attr.type}=${attr.value}`)
    .join(", ");
}

function parseDate(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function certFromForge(cert: forge.pki.Certificate): CmsCertInfo {
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const certBase64 = forge.util.encode64(certDer);
  const certPem = forge.pki.certificateToPem(cert);
  const parsed = parseCertDerBase64(certBase64) ?? extractIIN(certPem);

  return {
    subject: parsed.subject ?? formatDn(cert.subject.attributes),
    issuer: parsed.issuer ?? formatDn(cert.issuer.attributes),
    serial: parsed.serial ?? cert.serialNumber,
    iin: parsed.iin,
    bin: parsed.bin,
    cn: parsed.cn,
    validFrom: cert.validity.notBefore,
    validTo: cert.validity.notAfter,
  };
}

function extractCertFromCms(cmsB64: string): forge.pki.Certificate | null {
  try {
    const asn1 = forge.asn1.fromDer(forge.util.decode64(cmsB64));
    const message = forge.pkcs7.messageFromAsn1(asn1);
    const certs = (message as forge.pkcs7.PkcsSignedData).certificates;
    return certs?.[0] ?? null;
  } catch {
    return null;
  }
}

export function extractCmsCertInfo(cmsB64: string): CmsCertInfo | null {
  const cert = extractCertFromCms(cmsB64);
  if (!cert) return null;
  return certFromForge(cert);
}

export function verifyCmsSignature(
  cmsB64: string,
  opts: VerifyCmsOptions = {},
): CmsVerificationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const at = opts.at ?? new Date();
  const signedAt = parseDate(opts.signedAt) ?? at;

  const cert = extractCertFromCms(cmsB64);
  if (!cert) {
    return {
      valid: false,
      status: "invalid",
      cert: {},
      errors: ["Не удалось разобрать CMS-подпись"],
      warnings,
      cryptoVerified: false,
    };
  }

  const certInfo = certFromForge(cert);
  let cryptoVerified = false;

  try {
    const asn1 = forge.asn1.fromDer(forge.util.decode64(cmsB64));
    const message = forge.pkcs7.messageFromAsn1(asn1) as forge.pkcs7.PkcsSignedData;
    cryptoVerified = message.verify([cert]);
    if (!cryptoVerified) {
      warnings.push("Криптографическая проверка CMS не пройдена (возможен алгоритм GOST)");
    }
  } catch {
    warnings.push("Криптографическая проверка пропущена (GOST / неподдерживаемый алгоритм)");
  }

  if (certInfo.validFrom && signedAt < certInfo.validFrom) {
    errors.push("Сертификат ещё не был действителен на момент подписания");
  }
  if (certInfo.validTo && signedAt > certInfo.validTo) {
    errors.push("Срок действия сертификата истёк на момент подписания");
  }
  if (certInfo.validTo && at > certInfo.validTo) {
    errors.push("Срок действия сертификата истёк");
  }

  if (opts.expectedIin && certInfo.iin && opts.expectedIin !== certInfo.iin) {
    errors.push("ИИН сертификата не совпадает с профилем подписанта");
  }

  if (
    opts.contentHash &&
    opts.expectedContentHash &&
    opts.contentHash !== opts.expectedContentHash
  ) {
    errors.push("Содержимое документа изменилось после подписания");
  }

  let status: VerificationStatus = "valid";
  if (errors.some((e) => e.includes("изменилось"))) {
    status = "content_changed";
  } else if (errors.some((e) => e.includes("истёк"))) {
    status = "expired";
  } else if (errors.length > 0) {
    status = "invalid";
  }

  return {
    valid: status === "valid",
    status,
    cert: certInfo,
    errors,
    warnings,
    cryptoVerified,
  };
}
