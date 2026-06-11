/* =========================================================
   NCALayer SDK (browser-safe, modular, production-ready)
   ========================================================= */

import forge from "node-forge";
import { extractFirstCertBase64FromCms } from "@/lib/eds/verify-cms";
import { extractIIN, fixUtf8Mojibake, parseCertDerBase64 } from "@/lib/iin-parser";

const NCA_URL = "wss://127.0.0.1:13579/";
const DEBUG = true;

const log = (...a: any[]) => DEBUG && console.log("[NCALayer]", ...a);
const err = (...a: any[]) => DEBUG && console.error("[NCALayer][ERROR]", ...a);

/* =========================================================
   ERRORS
   ========================================================= */

export class NCALayerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NCALayerError";
  }
}

class AbortError extends Error {
  constructor() {
    super("Aborted");
    this.name = "AbortError";
  }
}

/* =========================================================
   TYPES
   ========================================================= */

export interface SignResult {
  signature: string;
}

export interface CertificateInfo {
  subject?: string;
  issuer?: string;
  serial?: string;
  validFrom?: string;
  validTo?: string;

  iin?: string;
  bin?: string;
  cn?: string;
}

// =========================================================
// ДОПОЛНИТЕЛЬНЫЕ ТИПЫ
// =========================================================

export interface SignatureRecord {
  type: "CMS" | "XML" | "AUTH";
  signedAt: string; // ISO 8601
  raw: string; // CMS/XML/Auth signature (base64)

  signer?: {
    iin?: string;
    bin?: string;
    cn?: string;
  };

  certificate?: {
    subject?: string;
    issuer?: string;
    validFrom?: string;
    validTo?: string;
    serial?: string;
    fingerprint?: string; // SHA-256 thumbprint
  };
}

export interface FullSignResult extends SignResult {
  certInfo: CertificateInfo;
  timestamp: string;
  fingerprint: string;
}

/* =========================================================
   HELPERS
   ========================================================= */

function isHandshake(msg: any): boolean {
  return Boolean(msg?.result?.version);
}

function extractSignature(msg: any): string | null {
  const responseObject = msg?.responseObject;
  if (typeof responseObject === "string" && responseObject.length > 10) {
    return responseObject;
  }

  const result = msg?.result;
  if (typeof result === "string" && result.length > 10) {
    return result;
  }

  const signatures = result?.signatures ?? result?.signature;
  if (typeof signatures === "string" && signatures.length > 10) {
    return signatures;
  }
  if (Array.isArray(signatures) && typeof signatures[0] === "string") {
    return signatures[0];
  }

  if (Array.isArray(result) && typeof result[0] === "string") {
    return result[0];
  }

  return null;
}

/**
 * RFC/KZ PKI subject parsing (OID + legacy fallback)
 */
function extractFromSubject(subject: string): Pick<CertificateInfo, "iin" | "bin" | "cn"> {
  if (!subject) return {};

  const iin =
    subject.match(/SERIALNUMBER\s*=\s*IIN(\d{12})/i)?.[1] ||
    subject.match(/SERIALNUMBER\s*=\s*(\d{12})/i)?.[1] ||
    subject.match(/1\.2\.860\.3\.16\.1\.1\s*=\s*(\d{12})/)?.[1] ||
    subject.match(/(?:^|[,+])\s*IIN\s*=\s*(\d{12})/i)?.[1];

  const bin =
    subject.match(/BIN\s*=\s*(\d{12})/i)?.[1] ||
    subject.match(/1\.2\.860\.3\.16\.1\.2\s*=\s*(\d{12})/)?.[1];

  const cn = fixUtf8Mojibake(subject.match(/CN\s*=\s*([^,+]+)/i)?.[1]?.trim() ?? "");

  return { iin, bin, cn: cn || undefined };
}

function mapNcalayerCertResponse(res: any): CertificateInfo {
  const body = unwrapResponseObject(res);
  const ki = body && typeof body === "object" && !Array.isArray(body) ? body : res;

  let subject = ki?.subjectDn || ki?.subject || ki?.subjectDN || ki?.SubjectDN || "";

  const cn = ki?.subjectCn || ki?.commonName || ki?.SubjectCn || extractFromSubject(subject).cn;

  if (!subject && cn) {
    subject = `CN=${cn}`;
  }

  const parsed = extractFromSubject(subject);

  let iin = parsed.iin;
  let bin = parsed.bin;

  const serial = ki?.serialNumber || ki?.serial;
  if (!iin && typeof serial === "string") {
    const serialIin = serial.match(/IIN(\d{12})/i) || serial.match(/(\d{12})/);
    if (serialIin) iin = serialIin[1];
  }

  return {
    subject: fixUtf8Mojibake(subject),
    issuer: fixUtf8Mojibake(ki?.issuerDn || ki?.issuer || ki?.issuerDN || ""),
    serial: typeof serial === "string" ? serial : undefined,
    validFrom: ki?.certNotBefore || ki?.notBefore,
    validTo: ki?.certNotAfter || ki?.notAfter,
    cn: fixUtf8Mojibake(cn || parsed.cn || ""),
    iin,
    bin: bin || parsed.bin,
  };
}

/* =========================================================
   WEBSOCKET CORE (single connection + FIFO queue)
   ========================================================= */

type Resolver = (msg: any) => void;

class NCALayerConnection {
  private socket: WebSocket | null = null;
  private queue: Resolver[] = [];

  private connect(): Promise<WebSocket> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return Promise.resolve(this.socket);
    }

    return new Promise((resolve, reject) => {
      log("connecting:", NCA_URL);

      const ws = new WebSocket(NCA_URL);
      this.socket = ws;

      ws.onopen = () => {
        log("connected");
        resolve(ws);
      };

      ws.onerror = () => {
        reject(new NCALayerError("NCALayer not available"));
      };

      ws.onmessage = (e) => this.onMessage(e.data);

      ws.onclose = (e) => {
        log("closed", e.code, e.reason);
      };
    });
  }

  private onMessage(raw: any) {
    let msg: any;

    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (isHandshake(msg)) {
      log("handshake ignored");
      return;
    }

    const next = this.queue.shift();
    if (next) next(msg);
  }

  async request<T>(payload: any, signal?: AbortSignal, timeoutMs = 60000): Promise<T> {
    const ws = await this.connect();

    return new Promise<T>((resolve, reject) => {
      let timer: any;

      const abort = () => reject(new AbortError());

      if (signal?.aborted) return abort();
      signal?.addEventListener("abort", abort);

      timer = setTimeout(() => {
        reject(new NCALayerError("timeout"));
      }, timeoutMs);

      this.queue.push((msg) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);

        if (msg?.errorCode) {
          reject(new NCALayerError(msg.errorCode));
          return;
        }

        resolve(msg);
      });

      log("send:", payload);
      ws.send(JSON.stringify(payload));
    });
  }
}

/* =========================================================
   INSTANCE
   ========================================================= */

const connection = new NCALayerConnection();

/* =========================================================
   CERTIFICATE API
   ========================================================= */

export async function getKeyInfo(
  storageName = "PKCS12",
  signal?: AbortSignal,
): Promise<{ certBase64: string; info: CertificateInfo }> {
  const res = await connection.request<any>(
    {
      module: "kz.gov.pki.knca.commonUtils",
      method: "getKeyInfo",
      args: [storageName],
    },
    signal,
    120_000,
  );

  const mapped = keyInfoToCertificateInfo(res);
  if (!mapped.info.subject && !mapped.info.iin) {
    throw new NCALayerError("Не удалось получить данные сертификата");
  }

  return mapped;
}

function isFailedNcalayerResponse(res: any): boolean {
  if (res?.errorCode) return true;
  const code = res?.code;
  if (code === 500 || code === "500") return true;
  if (typeof res?.message === "string" && /NoSuchMethod|Exception/i.test(res.message)) {
    return true;
  }
  return false;
}

let getCertificateInfoRpcUnavailable = false;

export async function getCertificateInfo(
  certBase64: string,
  signal?: AbortSignal,
): Promise<CertificateInfo> {
  const derInfo = parseCertDerBase64(certBase64);
  if (derInfo && (derInfo.iin || derInfo.subject || derInfo.cn)) {
    log("certificate info from DER parse");
    return derInfo;
  }

  if (getCertificateInfoRpcUnavailable) {
    throw new NCALayerError("Не удалось прочитать сертификат");
  }

  try {
    const res = await connection.request<any>(
      {
        module: "kz.gov.pki.knca.commonUtils",
        method: "getCertificateInfo",
        args: [certBase64],
      },
      signal,
    );

    if (isFailedNcalayerResponse(res)) {
      if (/NoSuchMethod/i.test(String(res?.message))) {
        getCertificateInfoRpcUnavailable = true;
      }
      throw new NCALayerError(String(res?.message || res?.code || "getCertificateInfo failed"));
    }

    const info = mapNcalayerCertResponse(res);
    if (info.subject || info.cn || info.iin) return info;
    throw new NCALayerError("getCertificateInfo returned empty data");
  } catch (rpcError) {
    if (derInfo) return derInfo;
    if (rpcError instanceof NCALayerError) throw rpcError;
    throw new NCALayerError("Не удалось прочитать сертификат");
  }
}

/* =========================================================
   SIGN API
   ========================================================= */

type CAdESSignType = "SIGNATURE" | "AUTHENTICATION";

async function createCAdESFromBase64(
  dataB64: string,
  signType: CAdESSignType,
  signal?: AbortSignal,
): Promise<any> {
  return connection.request<any>(
    {
      module: "kz.gov.pki.knca.commonUtils",
      method: "createCAdESFromBase64",
      args: ["PKCS12", signType, dataB64, true],
    },
    signal,
    signType === "AUTHENTICATION" ? 120_000 : 60_000,
  );
}

export async function signCMS(dataB64: string, signal?: AbortSignal): Promise<SignResult> {
  const res = await createCAdESFromBase64(dataB64, "SIGNATURE", signal);
  const signature = extractSignature(res);

  if (!signature) {
    err("signCMS response:", res);
    throw new NCALayerError("signature not found");
  }

  return { signature };
}

export async function signXML(xml: string, signal?: AbortSignal): Promise<SignResult> {
  const res = await connection.request<any>(
    {
      module: "kz.gov.pki.knca.commonUtils",
      method: "signXml",
      args: [xml],
    },
    signal,
  );

  const signature = extractSignature(res);

  if (!signature) throw new NCALayerError("xml signature not found");

  return { signature };
}

/**
 * Аутентификация ЭЦП — открывает диалог выбора сертификата (PKCS12 / токен).
 * Использует createCAdESFromBase64 + AUTHENTICATION (официальный API НУЦ РК).
 */
export async function auth(dataB64: string, signal?: AbortSignal): Promise<SignResult> {
  const res = await createCAdESFromBase64(dataB64, "AUTHENTICATION", signal);
  const signature = extractSignature(res);

  if (!signature) {
    err("auth response:", res);
    throw new NCALayerError("auth signature not found");
  }

  return { signature };
}

/* =========================================================
   РАСШИРЕННЫЕ API (сбор полных данных)
   ========================================================= */

/**
 * Вычисляет SHA-256 fingerprint сертификата
 */
async function getCertFingerprint(certBase64: string): Promise<string> {
  // Декодируем Base64 DER сертификата
  const derString = atob(certBase64);
  const derBytes = new Uint8Array(derString.length);
  for (let i = 0; i < derString.length; i++) {
    derBytes[i] = derString.charCodeAt(i);
  }

  // SHA-256 хеш
  const hashBuffer = await crypto.subtle.digest("SHA-256", derBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function unwrapResponseObject(res: any): any {
  const obj = res?.responseObject;
  if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
  return res;
}

function pemToCertBase64(pem: string): string {
  return pem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s/g, "");
}

function extractCertBase64(res: any): string | null {
  const body = unwrapResponseObject(res);
  const candidate =
    body?.certificate ||
    body?.pem ||
    (typeof body === "string" ? body : null) ||
    res?.certificate ||
    (typeof res?.responseObject === "string" ? res.responseObject : null) ||
    (typeof res?.result === "string" ? res.result : null) ||
    (Array.isArray(res?.result) ? res.result[0] : null);

  if (typeof candidate !== "string" || candidate.length < 20) return null;
  if (candidate.includes("BEGIN CERTIFICATE")) return pemToCertBase64(candidate);
  return candidate;
}

function keyInfoToCertificateInfo(res: any): { certBase64: string; info: CertificateInfo } {
  const ki = unwrapResponseObject(res);
  const pem = typeof ki?.pem === "string" ? ki.pem : "";
  const certBase64 = pem ? pemToCertBase64(pem) : "";

  return {
    certBase64,
    info: mapNcalayerCertResponse(res),
  };
}

/**
 * Диалог выбора сертификата в NCALayer (PKCS12 / eToken)
 */
export async function browseCertificate(
  purpose: "AUTHENTICATION" | "SIGN" = "AUTHENTICATION",
  signal?: AbortSignal,
): Promise<{ certBase64: string; info: CertificateInfo }> {
  const res = await connection.request<any>(
    {
      module: "kz.gov.pki.knca.commonUtils",
      method: "browseKeyStore",
      args: ["PKCS12", purpose, false],
    },
    signal,
    120_000,
  );

  const certBase64 = extractCertBase64(res);
  if (!certBase64) throw new NCALayerError("Сертификат не выбран");

  const info = await getCertificateInfo(certBase64, signal);
  return { certBase64, info };
}

/**
 * Получает активный сертификат (если уже выбран в NCALayer)
 */
export async function getActiveCertificate(
  signal?: AbortSignal,
): Promise<{ certBase64: string; info: CertificateInfo }> {
  const res = await connection.request<any>(
    {
      module: "kz.gov.pki.knca.commonUtils",
      method: "getActiveCertificate",
      args: [],
    },
    signal,
  );

  const certBase64 = extractCertBase64(res);
  if (!certBase64) throw new NCALayerError("no active certificate found");

  const info = await getCertificateInfo(certBase64, signal);
  return { certBase64, info };
}

function formatDn(attrs: forge.pki.CertificateField[]): string {
  return attrs
    .map((attr) => `${attr.shortName || attr.name || attr.type}=${attr.value}`)
    .join(", ");
}

/** Извлечь сертификат подписанта из CMS (без второго диалога NCALayer) */
function certInfoFromCmsSignature(
  cmsB64: string,
): { certBase64: string; info: CertificateInfo } | null {
  try {
    const asn1 = forge.asn1.fromDer(forge.util.decode64(cmsB64));
    const message = forge.pkcs7.messageFromAsn1(asn1);
    const certs = (message as forge.pkcs7.PkcsSignedData).certificates;
    if (!certs?.length) return null;

    const cert = certs[0];
    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const certBase64 = forge.util.encode64(certDer);
    const certPem = forge.pki.certificateToPem(cert);
    const { iin, bin, cn } = extractIIN(certPem);
    const subject = formatDn(cert.subject.attributes);

    return {
      certBase64,
      info: {
        subject,
        issuer: formatDn(cert.issuer.attributes),
        serial: cert.serialNumber,
        validFrom: cert.validity.notBefore.toString(),
        validTo: cert.validity.notAfter.toString(),
        iin,
        bin,
        cn,
      },
    };
  } catch (e) {
    log("CMS cert extract failed", e);
    return null;
  }
}

/** Сертификат из CMS: DER extract + ASN.1 parse (GOST), NCALayer — опционально */
async function certInfoFromCmsViaNcalayer(
  cmsB64: string,
  signal?: AbortSignal,
): Promise<{ certBase64: string; info: CertificateInfo } | null> {
  const certBase64 = extractFirstCertBase64FromCms(cmsB64);
  if (!certBase64) return null;

  try {
    const info = await getCertificateInfo(certBase64, signal);
    log("certificate resolved from CMS");
    return { certBase64, info };
  } catch (e) {
    log("CMS certificate info failed", e);
    return null;
  }
}

/** Сертификат после подписи: CMS DER + NCALayer (GOST) → активный → browse */
async function resolveCertificateAfterSign(
  purpose: "AUTHENTICATION" | "SIGN",
  cmsSignature: string,
  signal?: AbortSignal,
): Promise<{ certBase64: string; info: CertificateInfo }> {
  const fromNcalayer = await certInfoFromCmsViaNcalayer(cmsSignature, signal);
  if (fromNcalayer?.certBase64) {
    return fromNcalayer;
  }

  const fromCms = certInfoFromCmsSignature(cmsSignature);
  if (fromCms) {
    log("certificate resolved from CMS signature (forge/RSA)");
    return fromCms;
  }

  try {
    return await getActiveCertificate(signal);
  } catch {
    if (purpose === "SIGN") {
      return browseCertificate(purpose, signal);
    }
    throw new NCALayerError(
      "Не удалось извлечь сертификат из подписи. Убедитесь, что сертификат содержит ИИН.",
    );
  }
}

/**
 * Подпись CMS с полным сбором данных о подписанте
 */
export async function signCMSFull(dataB64: string, signal?: AbortSignal): Promise<FullSignResult> {
  const signature = await signCMS(dataB64, signal);
  const activeCert = await resolveCertificateAfterSign("SIGN", signature.signature, signal);
  const fingerprint = await getCertFingerprint(activeCert.certBase64);

  return {
    signature: signature.signature,
    certInfo: activeCert.info,
    timestamp: new Date().toISOString(),
    fingerprint,
  };
}

/**
 * Подпись XML с полными данными
 */
export async function signXMLFull(xml: string, signal?: AbortSignal): Promise<FullSignResult> {
  const signature = await signXML(xml, signal);
  const activeCert = await resolveCertificateAfterSign("SIGN", signature.signature, signal);
  const fingerprint = await getCertFingerprint(activeCert.certBase64);

  return {
    signature: signature.signature,
    certInfo: activeCert.info,
    timestamp: new Date().toISOString(),
    fingerprint,
  };
}

/**
 * Аутентификация с полными данными
 */
export async function authFull(dataB64: string, signal?: AbortSignal): Promise<FullSignResult> {
  const signature = await auth(dataB64, signal);
  const activeCert = await resolveCertificateAfterSign(
    "AUTHENTICATION",
    signature.signature,
    signal,
  );

  if (!activeCert.info.iin && !extractFromSubject(activeCert.info.subject || "").iin) {
    throw new NCALayerError(
      "В сертификате не найден ИИН. Используйте сертификат физлица с полем ИИН.",
    );
  }

  const fingerprint = activeCert.certBase64 ? await getCertFingerprint(activeCert.certBase64) : "";

  return {
    signature: signature.signature,
    certInfo: activeCert.info,
    timestamp: new Date().toISOString(),
    fingerprint,
  };
}

/* =========================================================
   PUBLIC FACADE
   ========================================================= */

export const NCALayerAPI = {
  signCMS,
  signXML,
  auth,
  getCertificateInfo,
};
