import { createHmac, timingSafeEqual } from "node:crypto";

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(padLen), "base64");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

import type { OnlyOfficeEditorConfig } from "@/lib/office/config.types";

export type OnlyOfficeCallbackPayload = {
  key?: string;
  status?: number;
  url?: string;
};

export function isOnlyOfficeJwtEnabled(): boolean {
  return (
    process.env.ONLYOFFICE_JWT_ENABLED === "true" &&
    Boolean(process.env.ONLYOFFICE_JWT_SECRET?.trim())
  );
}

/** Sign ONLYOFFICE editor config when JWT is enabled on Document Server. */
export function signOnlyOfficeConfig(config: OnlyOfficeEditorConfig): OnlyOfficeEditorConfig {
  const enabled = isOnlyOfficeJwtEnabled();
  if (!enabled) return config;

  const secret = process.env.ONLYOFFICE_JWT_SECRET!.trim();
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify(config));
  const data = `${header}.${payload}`;
  const signature = base64UrlEncode(createHmac("sha256", secret).update(data).digest());
  return { token: `${data}.${signature}` };
}

/** Verify HS256 JWT from Document Server (callback or Authorization header). */
export function verifyOnlyOfficeJwtToken(token: string): Record<string, unknown> | null {
  const secret = process.env.ONLYOFFICE_JWT_SECRET?.trim();
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const data = `${header}.${payload}`;
  const expected = base64UrlEncode(createHmac("sha256", secret).update(data).digest());
  if (!safeEqual(signature, expected)) return null;

  try {
    return JSON.parse(base64UrlDecode(payload).toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseOnlyOfficeCallbackPayload(
  decoded: Record<string, unknown>,
): OnlyOfficeCallbackPayload | null {
  const key = decoded.key;
  const status = decoded.status;
  if (typeof key !== "string" || !key.trim()) return null;
  if (typeof status !== "number" && typeof status !== "string") return null;
  const statusNum = typeof status === "number" ? status : Number(status);
  if (!Number.isFinite(statusNum)) return null;
  const url = decoded.url;
  return {
    key: key.trim(),
    status: statusNum,
    url: typeof url === "string" && url.trim() ? url.trim() : undefined,
  };
}
