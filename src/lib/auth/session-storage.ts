import {
  APP_ACCESS_EXPIRES_KEY,
  APP_ACCESS_TOKEN_KEY,
  APP_USER_STORAGE_KEY,
} from "./session-constants";

export type StoredUser = {
  id: string;
  email: string;
  organization_id?: string | null;
};

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(APP_ACCESS_TOKEN_KEY);
}

export function getAccessTokenExpiresAt(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(APP_ACCESS_EXPIRES_KEY);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function setSession(accessToken: string, user: StoredUser, accessExpiresInSec?: number) {
  localStorage.setItem(APP_ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(APP_USER_STORAGE_KEY, JSON.stringify(user));
  if (accessExpiresInSec && accessExpiresInSec > 0) {
    localStorage.setItem(
      APP_ACCESS_EXPIRES_KEY,
      String(Date.now() + accessExpiresInSec * 1000),
    );
  }
  window.dispatchEvent(new Event("app-auth-changed"));
}

export function clearSession() {
  localStorage.removeItem(APP_ACCESS_TOKEN_KEY);
  localStorage.removeItem(APP_USER_STORAGE_KEY);
  localStorage.removeItem(APP_ACCESS_EXPIRES_KEY);
  window.dispatchEvent(new Event("app-auth-changed"));
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(APP_USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}

export function isAccessTokenExpiringSoon(bufferMs = 5 * 60 * 1000): boolean {
  const expiresAt = getAccessTokenExpiresAt();
  if (!expiresAt) return false;
  return expiresAt - Date.now() <= bufferMs;
}
