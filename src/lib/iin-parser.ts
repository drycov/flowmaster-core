import forge from "node-forge";

export interface IINInfo {
  iin?: string;
  bin?: string;
  cn?: string;
}

export interface CertDerInfo extends IINInfo {
  subject?: string;
  issuer?: string;
  serial?: string;
  validFrom?: string;
  validTo?: string;
}

const OID_CN = "2.5.4.3";
const OID_SERIAL = "2.5.4.5";
const OID_IIN = "1.2.398.3.3.4.1.1.1";
const OID_IIN_KZ = "1.2.860.3.16.1.1";
const OID_BIN = "1.2.398.3.3.4.1.2";
const OID_BIN_KZ = "1.2.860.3.16.1.2";

const OID_LABEL: Record<string, string> = {
  [OID_CN]: "CN",
  [OID_SERIAL]: "SERIALNUMBER",
  [OID_IIN_KZ]: "IIN",
  [OID_IIN]: "IIN",
  [OID_BIN_KZ]: "BIN",
  [OID_BIN]: "BIN",
  "2.5.4.6": "C",
  "2.5.4.10": "O",
  "2.5.4.11": "OU",
};

function readOid(node: forge.asn1.Asn1): string {
  if (node.type !== forge.asn1.Type.OID) return "";
  return forge.asn1.derToOid(node.value as string);
}

/** KZ GOST certs: UTF-8 CN often stored as Latin-1 bytes → "Ð ÐÐÐÐÐ" instead of "РЫКОВ" */
export function fixUtf8Mojibake(text: string): string {
  if (!text || !/[ÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞß]/.test(text)) return text;
  try {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
    const fixed = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (/[\u0400-\u04FF]/.test(fixed)) return fixed;
  } catch {
    // not UTF-8 mojibake
  }
  return text;
}

function decodeBinaryAsUtf8(raw: string): string {
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) & 0xff;
  return new TextDecoder("utf-8").decode(bytes);
}

function readAsn1String(node: forge.asn1.Asn1): string {
  if (!node || typeof node.value !== "string") return "";
  const raw = node.value;
  if (node.type === 12 || node.type === 30) {
    try {
      return decodeBinaryAsUtf8(raw);
    } catch {
      return fixUtf8Mojibake(raw);
    }
  }
  return fixUtf8Mojibake(raw);
}

function parseRdn(seq: forge.asn1.Asn1): Map<string, string[]> {
  const attrs = new Map<string, string[]>();
  if (seq.type !== forge.asn1.Type.SEQUENCE || !Array.isArray(seq.value)) return attrs;

  for (const set of seq.value as forge.asn1.Asn1[]) {
    if (set.type !== forge.asn1.Type.SET || !Array.isArray(set.value)) continue;
    for (const attr of set.value as forge.asn1.Asn1[]) {
      if (attr.type !== forge.asn1.Type.SEQUENCE || !Array.isArray(attr.value)) continue;
      const [oidNode, valNode] = attr.value as forge.asn1.Asn1[];
      const oid = readOid(oidNode);
      const label = OID_LABEL[oid] || oid;
      const value = readAsn1String(valNode);
      const list = attrs.get(label) ?? [];
      list.push(value);
      attrs.set(label, list);
    }
  }
  return attrs;
}

function formatRdn(attrs: Map<string, string[]>): string {
  const parts: string[] = [];
  for (const [label, values] of attrs) {
    for (const v of values) parts.push(`${label}=${fixUtf8Mojibake(v)}`);
  }
  return parts.join(", ");
}

function extractIds(attrs: Map<string, string[]>): IINInfo {
  let iin = attrs.get("IIN")?.[0];
  if (iin) iin = iin.replace(/\D/g, "").slice(0, 12);

  const serial = attrs.get("SERIALNUMBER")?.[0];
  if (!iin && serial) {
    const m = serial.match(/IIN(\d{12})/i) || serial.match(/(\d{12})/);
    if (m) iin = m[1];
  }

  const bin = attrs.get("BIN")?.[0]?.replace(/\D/g, "").slice(0, 12);
  const cn = fixUtf8Mojibake(attrs.get("CN")?.[0] ?? "");

  return { iin, bin, cn: cn || undefined };
}

function scanDerForIin(certBase64: string): string | undefined {
  try {
    const decoded = atob(certBase64);
    const prefixed = decoded.match(/IIN(\d{12})/i);
    if (prefixed) return prefixed[1];
  } catch {
    // ignore
  }
  return undefined;
}

/** Parse X.509 DER (GOST/RSA) without reading the public key — works when forge.pki fails */
export function parseCertDerBase64(certBase64: string): CertDerInfo | null {
  try {
    const asn1 = forge.asn1.fromDer(forge.util.decode64(certBase64));
    if (asn1.type !== forge.asn1.Type.SEQUENCE || !Array.isArray(asn1.value)) return null;

    const tbs = (asn1.value as forge.asn1.Asn1[])[0];
    if (!tbs || tbs.type !== forge.asn1.Type.SEQUENCE || !Array.isArray(tbs.value)) return null;

    const tbsParts = tbs.value as forge.asn1.Asn1[];
    const hasVersion =
      tbsParts[0]?.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && tbsParts[0]?.type === 0;
    const off = hasVersion ? 1 : 0;

    const issuerNode = tbsParts[off + 2];
    const validityNode = tbsParts[off + 3];
    const subjectNode = tbsParts[off + 4];

    const subjectAttrs = parseRdn(subjectNode);
    const issuerAttrs = issuerNode ? parseRdn(issuerNode) : new Map<string, string[]>();
    const ids = extractIds(subjectAttrs);

    if (!ids.iin) {
      const scanned = scanDerForIin(certBase64);
      if (scanned) ids.iin = scanned;
    }

    let validFrom: string | undefined;
    let validTo: string | undefined;
    if (validityNode?.type === forge.asn1.Type.SEQUENCE && Array.isArray(validityNode.value)) {
      const times = validityNode.value as forge.asn1.Asn1[];
      validFrom = readAsn1String(times[0]);
      validTo = readAsn1String(times[1]);
    }

    return {
      subject: formatRdn(subjectAttrs),
      issuer: formatRdn(issuerAttrs),
      validFrom,
      validTo,
      ...ids,
    };
  } catch {
    const scanned = scanDerForIin(certBase64);
    if (scanned) return { iin: scanned };
    return null;
  }
}

export function extractIIN(certPem: string): IINInfo {
  const cert = forge.pki.certificateFromPem(certPem);

  let iin: string | undefined;
  let bin: string | undefined;

  for (const attr of cert.subject.attributes) {
    if (attr.type === OID_IIN || attr.type === OID_IIN_KZ) {
      iin = String(attr.value).replace(/\D/g, "");
    }

    if (attr.type === OID_BIN || attr.type === OID_BIN_KZ) {
      bin = String(attr.value).replace(/\D/g, "");
    }
  }

  const serialNumber = cert.subject.getField("serialNumber")?.value;

  if (!iin && serialNumber) {
    const match = serialNumber.match(/(\d{12})/);
    if (match) iin = match[1];
  }

  const cnRaw = cert.subject.getField("CN")?.value;
  const cn = cnRaw ? fixUtf8Mojibake(String(cnRaw)) : undefined;

  return { iin, bin, cn };
}
