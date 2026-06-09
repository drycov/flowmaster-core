import {
  clearRefreshSessionCookie,
  setRefreshSessionCookie,
} from "@/lib/auth/server/refresh-cookie.server";
import type { AppSessionResult } from "@/lib/auth/server/sessions";

export type PublicAuthSession = Omit<AppSessionResult, "refresh_token">;

export function publishAuthSession(session: AppSessionResult): PublicAuthSession {
  setRefreshSessionCookie(session.refresh_token, session.expires_at);
  const { refresh_token: _ignored, ...publicSession } = session;
  return publicSession;
}

export function clearAuthCookies(): void {
  clearRefreshSessionCookie();
}
