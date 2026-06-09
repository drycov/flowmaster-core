import { loadServerEnv } from "@/lib/env.server";

export type LicenseMode = "offline" | "online" | "hybrid";

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

export function isOnlineLicenseRequired(): boolean {
  return getLicenseMode() === "online";
}

export function shouldUseLicenseServer(): boolean {
  const mode = getLicenseMode();
  if (mode === "offline") return false;
  return !!getLicenseServerUrl();
}

export function getLicenseServerAdminSecret(): string | null {
  loadServerEnv();
  return process.env.LICENSE_SERVER_ADMIN_SECRET?.trim() || null;
}

export function getAppVersion(): string {
  return process.env.APP_VERSION?.trim() || process.env.npm_package_version || "unknown";
}
