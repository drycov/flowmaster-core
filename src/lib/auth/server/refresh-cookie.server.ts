import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

export const REFRESH_COOKIE_NAME = "fm_refresh";

export function setRefreshSessionCookie(refreshToken: string, sessionExpiresAt: string): void {
  const maxAge = Math.max(
    0,
    Math.floor((new Date(sessionExpiresAt).getTime() - Date.now()) / 1000),
  );
  setCookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export function clearRefreshSessionCookie(): void {
  deleteCookie(REFRESH_COOKIE_NAME, { path: "/" });
}

export function getRefreshSessionCookie(): string | undefined {
  return getCookie(REFRESH_COOKIE_NAME);
}
