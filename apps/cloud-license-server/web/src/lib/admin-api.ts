import { getAccessToken } from "./supabase";

const BASE = "/api/v1/admin";

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error ?? `HTTP ${res.status}`);
  return payload as T;
}

export type AdminVerifyMethods = {
  required: boolean;
  telegram: boolean;
  webhook: boolean;
};

export type VendorStaffRole = "owner" | "admin" | "staff";

export type AdminSession = {
  configured: boolean;
  authenticated: boolean;
  identity: { email: string; full_name?: string; role?: VendorStaffRole } | null;
  step: "none" | "password" | "verify" | "ready";
  verify: AdminVerifyMethods;
};

export type VendorStaffRow = {
  id: string;
  email: string;
  full_name: string;
  role: VendorStaffRole;
  telegram_chat_id: string;
  status: "active" | "disabled";
  last_login_at: string | null;
  created_at: string;
};

export type VerifyStartResponse = {
  ok: true;
  skipped?: boolean;
  token?: string;
  expires_at?: string;
  telegram?: {
    enabled: boolean;
    bot_username: string | null;
    deep_link: string | null;
    start_command: string;
  };
  webhook?: { enabled: boolean; dispatched: boolean };
  verify: AdminVerifyMethods;
};

export type AdminOverview = {
  keys_total: number;
  keys_active: number;
  keys_revoked: number;
  activations_total: number;
  activations_active: number;
  activations_revoked: number;
  provisions_total: number;
  provisions_active: number;
  portal_clients_total: number;
  trials_expiring_7d: number;
  online_last_7d: number;
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

export function startAdminVerify() {
  return adminFetch<VerifyStartResponse>("/verify/start", { method: "POST" });
}

export function pollAdminVerify(token: string) {
  return adminFetch<{ status: string; ok: boolean; session_ready?: boolean }>(
    `/verify/poll?token=${encodeURIComponent(token)}`,
  );
}

export function adminLogout() {
  return adminFetch<{ ok: true }>("/logout", { method: "POST" });
}

export function fetchVendorStaff() {
  return adminFetch<{ items: VendorStaffRow[]; total: number }>("/staff");
}

export function createVendorStaff(body: {
  email: string;
  password: string;
  full_name?: string;
  role?: VendorStaffRole;
  telegram_chat_id?: string;
}) {
  return adminFetch<{ ok: true; staff: VendorStaffRow }>("/staff", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateVendorStaff(
  id: string,
  body: {
    full_name?: string;
    role?: VendorStaffRole;
    telegram_chat_id?: string;
    status?: "active" | "disabled";
  },
) {
  return adminFetch<{ ok: true; staff: VendorStaffRow }>(`/staff/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
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

export function fetchAdminClients() {
  return adminFetch<{ items: ClientRow[]; total: number }>("/clients?limit=100");
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
  active_users: number;
  total_users: number;
  documents_total: number;
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
  last_seen_at: string | null;
  active_users: number;
  documents_total: number;
  days_until_expiry: number | null;
  account_email: string | null;
};

export type ClientRow = {
  id: string;
  email: string;
  company_name: string;
  created_at: string;
  installations_count: number;
  installation_ids: string[];
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
