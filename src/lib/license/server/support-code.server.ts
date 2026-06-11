import { createHmac, timingSafeEqual } from "node:crypto";

/** Support code rotates every 15 minutes (TOTP-style). */
export const VENDOR_SUPPORT_CODE_TTL_MS = 15 * 60 * 1000;

/** Vendor console session after successful code entry. */
export const VENDOR_ADMIN_SESSION_TTL_MS = 4 * 60 * 60 * 1000;

export const VENDOR_ADMIN_COOKIE = "fm_vendor_admin";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function codeForSlot(secret: string, slot: number): string {
  const hmac = createHmac("sha256", secret).update(`vendor-support:v1:${slot}`).digest();
  const num = hmac.readUInt32BE(0) % 100_000_000;
  return String(num).padStart(8, "0");
}

/** Generate current vendor support code (CLI + docs). */
export function generateVendorSupportCode(
  secret: string,
  now = Date.now(),
): { code: string; valid_until: string; slot: number } {
  const slot = Math.floor(now / VENDOR_SUPPORT_CODE_TTL_MS);
  const validUntil = new Date((slot + 1) * VENDOR_SUPPORT_CODE_TTL_MS);
  return {
    code: codeForSlot(secret, slot),
    valid_until: validUntil.toISOString(),
    slot,
  };
}

export function verifyVendorSupportCode(secret: string, code: string, now = Date.now()): boolean {
  const normalized = code.replace(/\s/g, "").trim();
  if (!/^\d{8}$/.test(normalized)) return false;
  const slot = Math.floor(now / VENDOR_SUPPORT_CODE_TTL_MS);
  for (const offset of [-1, 0, 1]) {
    if (safeEqual(normalized, codeForSlot(secret, slot + offset))) return true;
  }
  return false;
}

export function signVendorAdminSession(secret: string, expiresAtMs: number): string {
  const payload = String(expiresAtMs);
  const sig = createHmac("sha256", secret).update(`vendor-session:v1:${payload}`).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyVendorAdminSession(secret: string, token: string | undefined): boolean {
  if (!token?.includes(".")) return false;
  const [payload, sig] = token.split(".", 2);
  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  const expected = signVendorAdminSession(secret, expiresAt);
  return safeEqual(token, expected);
}
