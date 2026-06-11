const BASE = "/api/v1/admin";

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error ?? `HTTP ${res.status}`);
  return payload as T;
}

export type AdminSession = { configured: boolean; authenticated: boolean };

export type AdminOverview = {
  keys_total: number;
  keys_active: number;
  keys_revoked: number;
  activations_total: number;
  activations_active: number;
  activations_revoked: number;
  provisions_total: number;
  provisions_active: number;
  checked_at: string;
};

export const LICENSE_PLANS = ["trial", "standard", "professional", "enterprise"] as const;
export type LicensePlan = (typeof LICENSE_PLANS)[number];

export const PLAN_LABELS: Record<LicensePlan, string> = {
  trial: "Пробный",
  standard: "Стандарт",
  professional: "Professional",
  enterprise: "Enterprise",
};

export function fetchAdminSession() {
  return adminFetch<AdminSession>("/session");
}

export function adminLogin(supportCode: string) {
  return adminFetch<{ ok: true }>("/login", {
    method: "POST",
    body: JSON.stringify({ support_code: supportCode }),
  });
}

export function adminLogout() {
  return adminFetch<{ ok: true }>("/logout", { method: "POST" });
}

export function fetchAdminOverview() {
  return adminFetch<AdminOverview>("/overview");
}

export function fetchAdminKeys() {
  return adminFetch<{ items: KeyRow[]; total: number }>("/keys?limit=100&status=all");
}

export function fetchAdminActivations() {
  return adminFetch<{ items: ActivationRow[]; total: number }>(
    "/activations?limit=100&status=all",
  );
}

export function fetchAdminProvisions() {
  return adminFetch<{ items: ProvisionRow[]; total: number }>(
    "/provisions?limit=100&status=all",
  );
}

export type KeyRow = {
  id: string;
  key_hash_short: string;
  plan: LicensePlan;
  plan_label: string;
  max_users: number;
  customer_name: string;
  installation_id: string | null;
  expires_at: string | null;
  status: string;
  max_activations: number;
  active_activations: number;
};

export type ActivationRow = {
  id: string;
  installation_id: string;
  status: string;
  hostname: string;
  app_version: string;
  last_seen_at: string;
  customer_name: string;
  plan: LicensePlan | null;
};

export type ProvisionRow = {
  id: string;
  installation_id: string;
  plan: LicensePlan;
  plan_label: string;
  max_users: number;
  customer_name: string;
  expires_at: string | null;
  status: string;
};

export function provisionInstallation(body: {
  installation_id: string;
  plan: LicensePlan;
  max_users?: number;
  customer_name?: string;
}) {
  return adminFetch("/provision", { method: "POST", body: JSON.stringify(body) });
}

export function registerKey(license_key: string) {
  return adminFetch("/register-key", {
    method: "POST",
    body: JSON.stringify({ license_key }),
  });
}

export function revokeTarget(body: {
  key_id?: string;
  installation_id?: string;
  reason?: string;
}) {
  return adminFetch<{ ok: true; revoked_keys: number; revoked_activations: number }>(
    "/revoke",
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function generateKey(body: {
  installation_id: string;
  plan: LicensePlan;
  max_users?: number;
  customer?: string;
}) {
  return adminFetch<{ ok: true; license_key: string }>("/generate-key", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
