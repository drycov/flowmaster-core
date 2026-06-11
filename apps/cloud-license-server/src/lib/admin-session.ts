import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  getAdminSecret,
  VENDOR_ADMIN_COOKIE,
  VENDOR_ADMIN_SESSION_TTL_MS,
  signVendorAdminSession,
  verifyVendorAdminSession,
} from "./support-code.js";

function cookieSecure(): boolean {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

export function setAdminSessionCookie(c: Context, token: string): void {
  setCookie(c, VENDOR_ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "Strict",
    path: "/",
    maxAge: Math.floor(VENDOR_ADMIN_SESSION_TTL_MS / 1000),
  });
}

export function clearAdminSessionCookie(c: Context): void {
  deleteCookie(c, VENDOR_ADMIN_COOKIE, { path: "/" });
}

export function hasAdminSession(c: Context): boolean {
  const secret = getAdminSecret();
  if (!secret) return false;
  return verifyVendorAdminSession(secret, getCookie(c, VENDOR_ADMIN_COOKIE));
}

export function requireAdminSession(c: Context): Response | null {
  const secret = getAdminSecret();
  if (!secret) {
    return c.json({ error: "Admin UI не настроен (LICENSE_SERVER_ADMIN_SECRET)" }, 503);
  }
  if (!hasAdminSession(c)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return null;
}

export function createAdminSessionToken(): string {
  const secret = getAdminSecret();
  if (!secret) throw new Error("LICENSE_SERVER_ADMIN_SECRET не задан");
  const expiresAt = Date.now() + VENDOR_ADMIN_SESSION_TTL_MS;
  return signVendorAdminSession(secret, expiresAt);
}
