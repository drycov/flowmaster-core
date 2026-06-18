import { loadServerEnv } from "@/lib/env.server";

export type LicenseMode = "offline" | "online" | "hybrid";

export type LicenseProduct = "edms" | "backup_tools";

const LICENSE_PRODUCTS = new Set<LicenseProduct>(["edms", "backup_tools"]);

export function getLicenseMode(): LicenseMode {
  loadServerEnv();
  const raw = (process.env.LICENSE_MODE ?? "offline").trim().toLowerCase();
  if (raw === "online" || raw === "hybrid") return raw;
  return "offline";
}

export function getLicenseServerUrl(): string | null {
  loadServerEnv();
  const url = process.env.LICENSE_SERVER_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

/** Cloud master URL for local license server replica (Phase 2). */
export function getLicenseUpstreamUrl(): string | null {
  loadServerEnv();
  const url = process.env.LICENSE_UPSTREAM_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

/** Client is bound to vendor cloud when LICENSE_SERVER_URL is set (any env profile). */
export function usesCloudLicense(): boolean {
  return !!getLicenseServerUrl();
}

export function isOnlineLicenseRequired(): boolean {
  return usesCloudLicense() || getLicenseMode() === "online";
}

export function shouldUseLicenseServer(): boolean {
  return usesCloudLicense();
}

export function getLicenseServerAdminSecret(): string | null {
  loadServerEnv();
  return process.env.LICENSE_SERVER_ADMIN_SECRET?.trim() || null;
}

/** Vendor deployment: exposes /api/v1/license/* endpoints. */
export function isLicenseServerEnabled(): boolean {
  loadServerEnv();
  const raw = process.env.LICENSE_SERVER_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/** Local vendor console (loopback + support code). Never set on public deploy. */
export function isLicenseServerLocalAdminEnabled(): boolean {
  loadServerEnv();
  const raw = process.env.LICENSE_SERVER_LOCAL_ADMIN?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function getAppVersion(): string {
  return process.env.APP_VERSION?.trim() || process.env.npm_package_version || "unknown";
}

/** Product line for z-license connect/heartbeat (default: edms). */
export function getLicenseProduct(): LicenseProduct {
  loadServerEnv();
  const raw = (process.env.LICENSE_PRODUCT ?? "edms").trim().toLowerCase();
  if (LICENSE_PRODUCTS.has(raw as LicenseProduct)) {
    return raw as LicenseProduct;
  }
  return "edms";
}
