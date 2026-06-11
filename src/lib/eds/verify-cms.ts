import forge from "node-forge";
import { extractIIN, parseCertDerBase64, type CertDerInfo } from "@/lib/iin-parser";

export type VerificationStatus = "unverified" | "valid" | "expired" | "invalid" | "content_changed";

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
  const parsed = (parseCertDerBase64(certBase64) ?? extractIIN(certPem)) as CertDerInfo | null;

  return {
    subject: parsed?.subject ?? formatDn(cert.subject.attributes),
    issuer: parsed?.issuer ?? formatDn(cert.issuer.attributes),
    serial: parsed?.serial ?? cert.serialNumber,
    iin: parsed?.iin,
    bin: parsed?.bin,
    cn: parsed?.cn,
    validFrom: cert.validity.notBefore,
    validTo: cert.validity.notAfter,
  };
}

function looksLikeCertificate(node: forge.asn1.Asn1): boolean {
  if (node.type !== forge.asn1.Type.SEQUENCE || !Array.isArray(node.value)) return false;
  const parts = node.value as forge.asn1.Asn1[];
  return parts.length === 3 && parts[0]?.type === forge.asn1.Type.SEQUENCE;
}

function findFirstCertificate(nodes: forge.asn1.Asn1[]): forge.asn1.Asn1 | null {
  for (const node of nodes) {
    if (node.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && node.type === 0) {
      const inner = Array.isArray(node.value) ? (node.value as forge.asn1.Asn1[])[0] : null;
      if (inner?.type === forge.asn1.Type.SEQUENCE) return inner;
    }
    if (looksLikeCertificate(node)) return node;
    if (Array.isArray(node.value)) {
      const found = findFirstCertificate(node.value as forge.asn1.Asn1[]);
      if (found) return found;
    }
  }
  return null;
}

/** Extract signer cert DER from CMS without full PKCS#7 parse (works for GOST). */
export function extractFirstCertBase64FromCms(cmsB64: string): string | null {
  try {
    const asn1 = forge.asn1.fromDer(forge.util.decode64(cmsB64));
    if (asn1.type !== forge.asn1.Type.SEQUENCE || !Array.isArray(asn1.value)) return null;

    const contentInfoParts = asn1.value as forge.asn1.Asn1[];
    const signedDataWrapper = contentInfoParts.find(
      (p) => p.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && p.type === 0,
    );
    if (!signedDataWrapper || !Array.isArray(signedDataWrapper.value)) return null;

    const signedData = (signedDataWrapper.value as forge.asn1.Asn1[])[0];
    if (
      !signedData ||
      signedData.type !== forge.asn1.Type.SEQUENCE ||
      !Array.isArray(signedData.value)
    ) {
      return null;
    }

    for (const part of signedData.value as forge.asn1.Asn1[]) {
      if (part.tagClass !== forge.asn1.Class.CONTEXT_SPECIFIC || part.type !== 0) continue;
      const cert = findFirstCertificate(
        Array.isArray(part.value) ? (part.value as forge.asn1.Asn1[]) : [part],
      );
      if (!cert) continue;
      return forge.util.encode64(forge.asn1.toDer(cert).getBytes());
    }

    return null;
  } catch {
    return null;
  }
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

function cmsCertInfoFromDer(cmsB64: string): CmsCertInfo | null {
  const certBase64 = extractFirstCertBase64FromCms(cmsB64);
  if (!certBase64) return null;

  const parsed = parseCertDerBase64(certBase64);
  if (!parsed) return null;

  return {
    subject: parsed.subject,
    issuer: parsed.issuer,
    serial: parsed.serial,
    iin: parsed.iin,
    bin: parsed.bin,
    cn: parsed.cn,
    validFrom: parseDate(parsed.validFrom),
    validTo: parseDate(parsed.validTo),
  };
}

export function extractCmsCertInfo(cmsB64: string): CmsCertInfo | null {
  const cert = extractCertFromCms(cmsB64);
  if (cert) return certFromForge(cert);
  return cmsCertInfoFromDer(cmsB64);
}

export function verifyCmsSignature(
  cmsB64: string,
  opts: VerifyCmsOptions = {},
): CmsVerificationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const at = opts.at ?? new Date();
  const signedAt = parseDate(opts.signedAt) ?? at;

  const forgeCert = extractCertFromCms(cmsB64);
  const certInfo = forgeCert ? certFromForge(forgeCert) : (extractCmsCertInfo(cmsB64) ?? {});

  if (!certInfo.iin && !certInfo.subject && !certInfo.serial) {
    return {
      valid: false,
      status: "invalid",
      cert: {},
      errors: ["Не удалось разобрать CMS-подпись"],
      warnings,
      cryptoVerified: false,
    };
  }

  let cryptoVerified = false;

  if (forgeCert) {
    try {
      const asn1 = forge.asn1.fromDer(forge.util.decode64(cmsB64));
      const message = forge.pkcs7.messageFromAsn1(asn1) as forge.pkcs7.PkcsSignedData;
      cryptoVerified = message.verify([forgeCert]);
      if (!cryptoVerified) {
        warnings.push("Криптографическая проверка CMS не пройдена (возможен алгоритм GOST)");
      }
    } catch {
      warnings.push("Криптографическая проверка пропущена (GOST / неподдерживаемый алгоритм)");
    }
  } else {
    warnings.push("Криптографическая проверка пропущена (GOST CMS, извлечён DER сертификата)");
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
