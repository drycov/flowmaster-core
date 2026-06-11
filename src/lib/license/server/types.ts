import type { LicenseFeatures, LicensePlan } from "../types";

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
