const DEFAULT_SIGEX_URL = "https://sigex.kz";

export type SigexEgovQrSession = {
  expireAt: number;
  qrCode: string;
  eGovMobileLaunchLink?: string;
  eGovBusinessLaunchLink?: string;
  dataURL: string;
  signURL: string;
};

export type SigexDocumentToSign = {
  id: number;
  nameRu: string;
  nameKz?: string;
  nameEn?: string;
  meta?: Array<{ name: string; value: string }>;
  document: {
    file: {
      mime: string;
      data: string;
    };
  };
};

export type SigexSignPayload = {
  signMethod: "CMS_SIGN_ONLY" | "CMS_WITH_DATA" | "SIGN_BYTES_ARRAY" | "XML" | "MIX_SIGN";
  documentsToSign: SigexDocumentToSign[];
};

export type SigexSignedResponse = {
  signMethod?: string;
  documentsToSign?: Array<{
    id?: number;
    document?: { file?: { mime?: string; data?: string } };
  }>;
  status?: "CANCELED" | string;
  version?: number;
};

function sigexBaseUrl(): string {
  const raw = process.env.SIGEX_API_URL?.trim() || DEFAULT_SIGEX_URL;
  return raw.replace(/\/$/, "");
}

export function isSigexEgovQrEnabled(): boolean {
  if (process.env.SIGEX_EGOV_QR_ENABLED === "false") return false;
  return Boolean(sigexBaseUrl());
}

async function sigexFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 120_000, ...rest } = init;
  const signal = AbortSignal.timeout(timeoutMs);
  return fetch(url, { ...rest, signal });
}

export async function registerSigexEgovQr(args: {
  description: string;
  backUrl?: string;
}): Promise<SigexEgovQrSession> {
  const res = await sigexFetch(`${sigexBaseUrl()}/api/egovQr`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      description: args.description,
      ...(args.backUrl ? { whenDone: { backUrl: args.backUrl } } : {}),
    }),
    timeoutMs: 30_000,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SIGEX egovQr: ${res.status}${text ? ` — ${text.slice(0, 200)}` : ""}`);
  }

  const body = (await res.json()) as Partial<SigexEgovQrSession>;
  if (!body.qrCode || !body.dataURL || !body.signURL) {
    throw new Error("SIGEX egovQr: неполный ответ (qrCode/dataURL/signURL)");
  }

  return body as SigexEgovQrSession;
}

export async function sendSigexEgovQrData(
  dataURL: string,
  payload: SigexSignPayload,
): Promise<{ signURL: string; expireAt?: number }> {
  const res = await sigexFetch(dataURL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
    timeoutMs: 180_000,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SIGEX dataURL: ${res.status}${text ? ` — ${text.slice(0, 200)}` : ""}`);
  }

  const body = (await res.json()) as { signURL?: string; expireAt?: number };
  if (!body.signURL) throw new Error("SIGEX dataURL: signURL отсутствует в ответе");
  return { signURL: body.signURL, expireAt: body.expireAt };
}

export async function fetchSigexEgovQrSignatures(signURL: string): Promise<SigexSignedResponse> {
  const res = await sigexFetch(signURL, {
    method: "GET",
    headers: { Accept: "application/json" },
    timeoutMs: 180_000,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SIGEX signURL: ${res.status}${text ? ` — ${text.slice(0, 200)}` : ""}`);
  }

  return (await res.json()) as SigexSignedResponse;
}

export function buildSigexSignPayload(args: {
  titleRu: string;
  titleKk?: string;
  payloadBase64: string;
  meta?: Array<{ name: string; value: string }>;
}): SigexSignPayload {
  return {
    signMethod: "CMS_SIGN_ONLY",
    documentsToSign: [
      {
        id: 1,
        nameRu: args.titleRu,
        nameKz: args.titleKk,
        nameEn: args.titleRu,
        meta: args.meta,
        document: {
          file: {
            mime: "",
            data: args.payloadBase64,
          },
        },
      },
    ],
  };
}

export function extractCmsFromSigexResponse(response: SigexSignedResponse): string {
  if (response.status === "CANCELED") {
    throw new Error("Подписание отменено в eGov mobile");
  }

  const doc = response.documentsToSign?.[0];
  const data = doc?.document?.file?.data?.trim();
  if (!data) throw new Error("SIGEX: подпись не получена");

  return data;
}
