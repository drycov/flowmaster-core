import { APP_ACCESS_TOKEN_KEY, APP_USER_STORAGE_KEY } from "./session-constants";

export type StoredUser = {
  id: string;
  email: string;
};

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(APP_ACCESS_TOKEN_KEY);
}

export function setSession(accessToken: string, user: StoredUser) {
  localStorage.setItem(APP_ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(APP_USER_STORAGE_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("app-auth-changed"));
}

export function clearSession() {
  localStorage.removeItem(APP_ACCESS_TOKEN_KEY);
  localStorage.removeItem(APP_USER_STORAGE_KEY);
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
