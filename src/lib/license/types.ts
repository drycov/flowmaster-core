export const LICENSE_PLANS = ["trial", "standard", "professional", "enterprise"] as const;
export type LicensePlan = (typeof LICENSE_PLANS)[number];

export const LICENSE_STATUSES = ["active", "grace", "expired", "suspended"] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

export const LICENSE_FEATURES = [
  "workflows",
  "templates",
  "eds_signing",
  "archive",
  "references",
  "nomenclature",
  "audit",
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

export type LicenseStatusResponse = {
  has_license: boolean;
  plan: LicensePlan;
  status: LicenseStatus;
  max_users: number;
  active_users: number;
  seats_available: number;
  features: LicenseFeatures;
  is_writable: boolean;
  days_remaining: number | null;
  grace_days_remaining: number | null;
  expires_at: string | null;
  customer_name: string;
  installation_id: string | null;
  grace_days: number;
  activated_at: string | null;
  issued_at?: string | null;
};
