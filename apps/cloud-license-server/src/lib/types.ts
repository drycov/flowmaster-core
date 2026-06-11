export const LICENSE_PLANS = ["trial", "standard", "professional", "enterprise"] as const;
export type LicensePlan = (typeof LICENSE_PLANS)[number];

export const LICENSE_FEATURES = [
  "workflows",
  "templates",
  "eds_signing",
  "office",
  "archive",
  "references",
  "nomenclature",
  "audit",
  "knowledge_base",
  "projects",
  "contracts",
  "counterparties",
  "hr",
  "substitutions",
  "correspondence",
  "integrations",
  "reports",
  "monitoring",
] as const;
export type LicenseFeature = (typeof LICENSE_FEATURES)[number];

export type LicenseFeatures = Partial<Record<LicenseFeature, boolean>>;

export type LicenseKeyPayload = {
  v: 1;
  plan: LicensePlan;
  max_users: number;
  features: LicenseFeatures;
  expires_at: string | null;
  customer: string;
  installation_id?: string | null;
  issued_at: string;
};

export type LicenseServerEntitlement = {
  plan: LicensePlan;
  max_users: number;
  features: LicenseFeatures;
  expires_at: string | null;
  customer_name: string;
  issued_at: string | null;
};

export type LicenseConnectRequest = {
  installation_id: string;
  hostname?: string;
  app_version?: string;
};

export type LicenseActivateRequest = {
  license_key: string;
  installation_id: string;
  hostname?: string;
  app_version?: string;
};

export type LicenseActivateResponse = {
  token: string;
  key_id: string;
  entitlement: LicenseServerEntitlement;
  next_heartbeat_hours: number;
};

export type LicenseHeartbeatRequest = {
  token: string;
  installation_id: string;
  active_users?: number;
  hostname?: string;
  app_version?: string;
  telemetry?: LicenseUsageTelemetry;
};

/** Aggregated usage metrics sent during license sync (no PII). */
export type LicenseUsageTelemetry = {
  total_users: number;
  active_users: number;
  max_users_allowed: number;
  documents_total: number;
  documents_30d: number;
  workflows_published: number;
  app_version: string;
  environment: string;
  platform: string;
};

export type LicenseHeartbeatResponse = {
  status: "active" | "revoked" | "suspended";
  entitlement?: LicenseServerEntitlement;
  next_heartbeat_hours: number;
  message?: string;
};

export type LicenseRevokeRequest = {
  key_id?: string;
  installation_id?: string;
  key_hash?: string;
  reason?: string;
};

export type LicenseProvisionRequest = {
  installation_id: string;
  plan: LicensePlan;
  max_users?: number;
  customer_name?: string;
  expires_at?: string | null;
  features?: LicenseFeatures;
};

export type PortalUsageTelemetry = {
  reported_at: string | null;
  app_version: string;
  total_users: number;
  active_users: number;
  max_users_allowed: number;
  documents_total: number;
  documents_30d: number;
  workflows_published: number;
  environment: string;
  platform: string;
};

export type PortalInstallationTariff = {
  title: string;
  subtitle: string;
  price_label: string;
  days_remaining: number | null;
  is_trial: boolean;
  features: { key: string; label: string }[];
  pricing: {
    currency_label: string;
    monthly: number;
    yearly_total: number;
    custom_quote: boolean;
    extra_users: number;
    yearly_months_paid: number;
  } | null;
};

export type PortalInstallationView = {
  installation_id: string;
  plan: LicensePlan | null;
  max_users: number | null;
  status: string;
  customer_name: string;
  expires_at: string | null;
  last_seen_at: string | null;
  hostname: string | null;
  app_version: string | null;
  tariff: PortalInstallationTariff | null;
  telemetry: PortalUsageTelemetry | null;
};
