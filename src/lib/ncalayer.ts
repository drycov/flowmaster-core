/* =========================================================
   NCALayer SDK (browser-safe, modular, production-ready)
   ========================================================= */

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
  signedAt: string;        // ISO 8601
  raw: string;             // CMS/XML/Auth signature (base64)
  
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
    fingerprint?: string;   // SHA-256 thumbprint
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
  return (
    msg?.responseObject ||
    msg?.result?.signatures ||
    (typeof msg?.result === "string" ? msg.result : null)
  );
}

/**
 * RFC/KZ PKI subject parsing (OID + legacy fallback)
 */
function extractFromSubject(subject: string): Pick<CertificateInfo, "iin" | "bin" | "cn"> {
  if (!subject) return {};

  const iin =
    subject.match(/SERIALNUMBER\s*=\s*(\d{12})/)?.[1] ||
    subject.match(/1\.2\.860\.3\.16\.1\.1\s*=\s*(\d{12})/)?.[1];

  const bin =
    subject.match(/BIN\s*=\s*(\d{12})/)?.[1] ||
    subject.match(/1\.2\.860\.3\.16\.1\.2\s*=\s*(\d{12})/)?.[1];

  const cn = subject.match(/CN\s*=\s*([^,]+)/)?.[1]?.trim();

  return { iin, bin, cn };
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

  async request<T>(
    payload: any,
    signal?: AbortSignal,
    timeoutMs = 60000
  ): Promise<T> {
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

export async function getCertificateInfo(
  certBase64: string,
  signal?: AbortSignal
): Promise<CertificateInfo> {
  const res = await connection.request<any>(
    {
      module: "kz.gov.pki.knca.commonUtils",
      method: "getCertificateInfo",
      args: [certBase64],
    },
    signal
  );

  const subject = res?.subjectDn || res?.subject || "";
  const issuer = res?.issuerDn || res?.issuer || "";

  const parsed = extractFromSubject(subject);

  return {
    subject,
    issuer,
    serial: res?.serialNumber,
    validFrom: res?.notBefore,
    validTo: res?.notAfter,
    ...parsed,
  };
}

/* =========================================================
   SIGN API
   ========================================================= */

export async function signCMS(
  dataB64: string,
  signal?: AbortSignal
): Promise<SignResult> {
  const res = await connection.request<any>(
    {
      module: "kz.gov.pki.knca.commonUtils",
      method: "createCAdESFromBase64",
      args: ["PKCS12", "SIGNATURE", dataB64, true],
    },
    signal
  );

  const signature = extractSignature(res);

  if (!signature) throw new NCALayerError("signature not found");

  return { signature };
}

export async function signXML(
  xml: string,
  signal?: AbortSignal
): Promise<SignResult> {
  const res = await connection.request<any>(
    {
      module: "kz.gov.pki.knca.commonUtils",
      method: "signXml",
      args: [xml],
    },
    signal
  );

  const signature = extractSignature(res);

  if (!signature) throw new NCALayerError("xml signature not found");

  return { signature };
}

export async function auth(
  dataB64: string,
  signal?: AbortSignal
): Promise<SignResult> {
  const res = await connection.request<any>(
    {
      module: "kz.gov.pki.knca.commonUtils",
      method: "signAuth",
      args: [dataB64],
    },
    signal
  );

  const signature = extractSignature(res);

  if (!signature) throw new NCALayerError("auth signature not found");

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
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Получает активный сертификат из NCALayer
 * (без подписи, просто текущий выбранный)
 */
export async function getActiveCertificate(
  signal?: AbortSignal
): Promise<{ certBase64: string; info: CertificateInfo }> {
  const res = await connection.request<any>(
    {
      module: "kz.gov.pki.knca.commonUtils",
      method: "getActiveCertificate",
      args: [],
    },
    signal
  );

  const certBase64 = res?.certificate || res?.result;
  if (!certBase64) throw new NCALayerError("no active certificate found");

  const info = await getCertificateInfo(certBase64, signal);
  
  return { certBase64, info };
}

/**
 * Подпись CMS с полным сбором данных о подписанте
 */
export async function signCMSFull(
  dataB64: string,
  signal?: AbortSignal
): Promise<FullSignResult> {
  // 1. Сначала получаем активный сертификат (кто будет подписывать)
  const activeCert = await getActiveCertificate(signal);
  
  // 2. Выполняем подпись
  const signature = await signCMS(dataB64, signal);
  
  // 3. Формируем полную запись
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
export async function signXMLFull(
  xml: string,
  signal?: AbortSignal
): Promise<FullSignResult> {
  const activeCert = await getActiveCertificate(signal);
  const signature = await signXML(xml, signal);
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
export async function authFull(
  dataB64: string,
  signal?: AbortSignal
): Promise<FullSignResult> {
  const activeCert = await getActiveCertificate(signal);
  const signature = await auth(dataB64, signal);
  const fingerprint = await getCertFingerprint(activeCert.certBase64);
  
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