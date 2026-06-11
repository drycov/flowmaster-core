export type PublicPlan = {
  plan: string;
  title: string;
  subtitle: string;
  priceLabel: string;
  highlight?: boolean;
  cta: string;
  max_users: number;
  trial_days: number | null;
  features: { key: string; label: string }[];
};

export type PortalInstallation = {
  installation_id: string;
  plan: string | null;
  max_users: number | null;
  status: string;
  customer_name: string;
  expires_at: string | null;
  last_seen_at: string | null;
  hostname: string | null;
  app_version: string | null;
};

export type PortalMe = {
  account: { id: string; email: string; company_name: string } | null;
  installations: PortalInstallation[];
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.error ?? `HTTP ${res.status}`);
  }
  return payload as T;
}

export async function fetchPlans(): Promise<PublicPlan[]> {
  const data = await apiFetch<{ plans: PublicPlan[] }>("/api/v1/portal/plans");
  return data.plans;
}

export async function fetchPortalMe(token: string): Promise<PortalMe> {
  return apiFetch<PortalMe>("/api/v1/portal/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function bootstrapPortal(
  token: string,
  companyName: string,
): Promise<PortalMe & { created: boolean }> {
  return apiFetch("/api/v1/portal/bootstrap", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ company_name: companyName }),
  });
}

export { salesContactHref, SALES_EMAIL } from "./company";
