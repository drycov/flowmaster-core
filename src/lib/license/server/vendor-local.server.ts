import { deleteCookie, getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import {
  isLicenseServerEnabled,
  getLicenseServerAdminSecret,
  isLicenseServerLocalAdminEnabled,
} from "./config.server";
import {
  VENDOR_ADMIN_COOKIE,
  VENDOR_ADMIN_SESSION_TTL_MS,
  signVendorAdminSession,
  verifyVendorAdminSession,
  verifyVendorSupportCode,
} from "./support-code.server";

/** Local vendor console — never enabled on public EDMS / license-server deploy. */
export function assertLicenseServerLocalAdminEnabled(): void {
  if (!isLicenseServerLocalAdminEnabled()) {
    throw new Error("Vendor admin UI отключён");
  }
}

export function assertVendorLocalAdminContext(): void {
  assertLicenseServerLocalAdminEnabled();
  if (!isLicenseServerEnabled()) {
    throw new Error("LICENSE_SERVER_ENABLED требуется для vendor admin");
  }
  const secret = getLicenseServerAdminSecret();
  if (!secret) {
    throw new Error("LICENSE_SERVER_ADMIN_SECRET не задан");
  }
}

/** Restrict HTTP access to loopback (SSH tunnel → 127.0.0.1 on server). */
export function assertVendorLoopbackRequest(): void {
  if (process.env.LICENSE_SERVER_LOCAL_SKIP_LOOPBACK === "1") return;
  const req = getRequest();
  const host = (req?.headers.get("host") ?? "").split(":")[0]?.toLowerCase();
  const allowed = new Set(["127.0.0.1", "localhost", "::1"]);
  if (!host || !allowed.has(host)) {
    throw new Error("Vendor admin доступен только через localhost (SSH tunnel)");
  }
}

export function establishVendorAdminSession(supportCode: string): void {
  assertVendorLocalAdminContext();
  assertVendorLoopbackRequest();
  const secret = getLicenseServerAdminSecret()!;
  if (!verifyVendorSupportCode(secret, supportCode)) {
    throw new Error("Неверный или просроченный support code");
  }
  const expiresAt = Date.now() + VENDOR_ADMIN_SESSION_TTL_MS;
  const token = signVendorAdminSession(secret, expiresAt);
  setCookie(VENDOR_ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: false,
    sameSite: "strict",
    path: "/vendor",
    maxAge: Math.floor(VENDOR_ADMIN_SESSION_TTL_MS / 1000),
  });
}

export function clearVendorAdminSession(): void {
  deleteCookie(VENDOR_ADMIN_COOKIE, { path: "/vendor" });
}

export function hasValidVendorAdminSession(): boolean {
  if (!isLicenseServerLocalAdminEnabled()) return false;
  const secret = getLicenseServerAdminSecret();
  if (!secret) return false;
  return verifyVendorAdminSession(secret, getCookie(VENDOR_ADMIN_COOKIE));
}

export function requireVendorAdminSession(): void {
  assertVendorLocalAdminContext();
  assertVendorLoopbackRequest();
  if (!hasValidVendorAdminSession()) {
    throw new Error("Требуется вход по support code");
  }
}
