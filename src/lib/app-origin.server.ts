import { loadSystemSettings } from "@/lib/auth/policy";

let cachedAt = 0;
let cachedAppUrl = "";
let cachedOfficeUrl = "";
const CACHE_TTL_MS = 30_000;

export function invalidateRuntimeSettingsCache(): void {
  cachedAt = 0;
  cachedAppUrl = "";
  cachedOfficeUrl = "";
}

async function refreshCache(): Promise<void> {
  const settings = await loadSystemSettings();
  cachedAppUrl = settings.general.app_url.trim().replace(/\/$/, "");
  cachedOfficeUrl = settings.integrations.office_enabled
    ? settings.integrations.office_url.trim().replace(/\/$/, "")
    : "";
  cachedAt = Date.now();
}

async function ensureCache(): Promise<void> {
  if (Date.now() - cachedAt < CACHE_TTL_MS) return;
  await refreshCache();
}

/** Public URL of this EDMS instance (webhooks, email links, ONLYOFFICE callback). */
export async function resolveAppOrigin(): Promise<string> {
  await ensureCache();
  return cachedAppUrl;
}

export async function resolveOfficeUrl(): Promise<string> {
  await ensureCache();
  return cachedOfficeUrl;
}
