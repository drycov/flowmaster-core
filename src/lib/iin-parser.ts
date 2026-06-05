import forge from "node-forge";

export interface IINInfo {
  iin?: string;
  bin?: string;
  cn?: string;
}

const OID_IIN = "1.2.398.3.3.4.1.1.1";
const OID_BIN = "1.2.398.3.3.4.1.2";

export function extractIIN(certPem: string): IINInfo {
  const cert = forge.pki.certificateFromPem(certPem);

  let iin: string | undefined;
  let bin: string | undefined;

  // 1. OID-based extraction (enterprise correct way)
  for (const attr of cert.subject.attributes) {
    if (attr.type === OID_IIN) {
      iin = String(attr.value).replace(/\D/g, "");
    }

    if (attr.type === OID_BIN) {
      bin = String(attr.value).replace(/\D/g, "");
    }
  }

  // 2. fallback: SERIALNUMBER field
  const serialNumber = cert.subject.getField("serialNumber")?.value;

  if (!iin && serialNumber) {
    const match = serialNumber.match(/(\d{12})/);
    if (match) iin = match[1];
  }

  // 3. CN fallback (rare legacy cases)
  const cn = cert.subject.getField("CN")?.value;

  return { iin, bin, cn };
}