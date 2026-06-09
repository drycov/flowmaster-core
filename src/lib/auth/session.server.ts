import { createHash, createHmac, randomBytes } from "node:crypto";
import { loadServerEnv } from "@/lib/env.server";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createOpaqueSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sessionExpiresAt(): string {
  return new Date(Date.now() + SESSION_TTL_MS).toISOString();
}

function base64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function getJwtSecret(): string {
  loadServerEnv();
  const secret =
    process.env.SUPABASE_JWT_SECRET ||
    process.env.APP_SESSION_SECRET ||
    process.env.VITE_SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error(
      "Задайте SUPABASE_JWT_SECRET в .env (Supabase → Settings → API → JWT Secret)",
    );
  }
  return secret;
}

/** Supabase-compatible access token — PostgREST auth.uid() reads `sub` */
export function signAccessToken(
  userId: string,
  email: string,
  jwtSecret: string,
  ttlSec = 7 * 24 * 3600,
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    aud: "authenticated",
    exp: now + ttlSec,
    iat: now,
    iss: "supabase",
    sub: userId,
    email,
    role: "authenticated",
  };

  const encodedHeader = base64urlJson(header);
  const encodedPayload = base64urlJson(payload);
  const signature = createHmac("sha256", jwtSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyAccessToken(
  token: string,
  jwtSecret: string,
): { sub: string; email?: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const expected = createHmac("sha256", jwtSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  if (signature !== expected) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as { sub?: string; email?: string; exp?: number };

    if (!payload.sub || !payload.exp || payload.exp * 1000 < Date.now()) {
      return null;
    }

    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
