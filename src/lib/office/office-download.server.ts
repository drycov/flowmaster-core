import { isIP } from "node:net";
import { resolveOfficeUrl } from "@/lib/app-origin.server";

const MAX_OFFICE_DOWNLOAD_BYTES = 80 * 1024 * 1024;

function normalizeOrigin(raw: string): string | null {
  try {
    return new URL(raw.trim()).origin;
  } catch {
    return null;
  }
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "metadata.google.internal") return true;

  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    const parts = host.split(".").map(Number);
    if (parts[0] === 127) return true;
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true;
    return false;
  }
  if (ipVersion === 6) {
    const h = host.toLowerCase();
    if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80:")) {
      return true;
    }
  }
  return false;
}

async function allowedDownloadOrigins(): Promise<Set<string>> {
  const allowed = new Set<string>();

  for (const envKey of ["ONLYOFFICE_STORAGE_INTERNAL_URL", "ONLYOFFICE_CALLBACK_BASE_URL"]) {
    const origin = normalizeOrigin(process.env[envKey] ?? "");
    if (origin) allowed.add(origin);
  }

  const officeUrl = await resolveOfficeUrl();
  const officeOrigin = normalizeOrigin(officeUrl);
  if (officeOrigin) allowed.add(officeOrigin);

  // Docker service names used by Document Server cache / internal fetch
  for (const origin of [
    "http://onlyoffice",
    "http://onlyoffice:80",
    "http://documentserver",
    "http://nginx",
    "http://kong:8000",
  ]) {
    allowed.add(origin);
  }

  const publicApp = normalizeOrigin(
    process.env.PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "",
  );
  if (publicApp) allowed.add(publicApp);

  return allowed;
}

/** Reject download URLs outside ONLYOFFICE / storage allowlist (SSRF guard). */
export async function assertAllowedOfficeDownloadUrl(downloadUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(downloadUrl);
  } catch {
    throw new Error("invalid download url");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("download url protocol not allowed");
  }

  if (parsed.username || parsed.password) {
    throw new Error("download url credentials not allowed");
  }

  if (isBlockedHost(parsed.hostname)) {
    throw new Error("download url host not allowed");
  }

  const allowed = await allowedDownloadOrigins();
  if (!allowed.has(parsed.origin)) {
    throw new Error("download url origin not allowed");
  }
}

export async function fetchOfficeDownload(downloadUrl: string): Promise<Buffer> {
  await assertAllowedOfficeDownloadUrl(downloadUrl);

  const res = await fetch(downloadUrl, {
    redirect: "manual",
    signal: AbortSignal.timeout(120_000),
  });

  if (res.status >= 300 && res.status < 400) {
    throw new Error("download redirects not allowed");
  }
  if (!res.ok) {
    throw new Error(`download failed: ${res.status}`);
  }

  const lengthHeader = res.headers.get("content-length");
  if (lengthHeader) {
    const length = Number(lengthHeader);
    if (Number.isFinite(length) && length > MAX_OFFICE_DOWNLOAD_BYTES) {
      throw new Error("download too large");
    }
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_OFFICE_DOWNLOAD_BYTES) {
    throw new Error("download too large");
  }

  return buffer;
}
