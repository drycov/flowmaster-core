import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSupabaseEnv } from "@/lib/env.server";

const INSTALLATION_SEED_PREFIX = "flowmaster-install:";
const PERSIST_DIR = ".flowmaster";
const PERSIST_FILE = "installation-id";

let ensured = false;

function extractProjectRefFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    const ref = host.split(".")[0];
    return ref || null;
  } catch {
    return null;
  }
}

function projectRef(): string | null {
  return (
    process.env.SUPABASE_PROJECT_REF?.trim() ||
    process.env.SUPABASE_PROJECT_ID?.trim() ||
    process.env.VITE_SUPABASE_PROJECT_ID?.trim() ||
    extractProjectRefFromUrl(process.env.SUPABASE_URL) ||
    extractProjectRefFromUrl(process.env.VITE_SUPABASE_URL) ||
    null
  );
}

/** Deterministic UUID (v5-style) from a stable seed — same Supabase project → same installation ID. */
export function installationIdFromSeed(seed: string): string {
  const hash = createHash("sha256").update(seed).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function loadPersistedInstallationId(): string | null {
  const filePath = resolve(process.cwd(), PERSIST_DIR, PERSIST_FILE);
  if (!existsSync(filePath)) return null;
  const id = readFileSync(filePath, "utf8").trim();
  return id || null;
}

function persistInstallationId(id: string): void {
  const dir = resolve(process.cwd(), PERSIST_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, PERSIST_FILE), `${id}\n`, "utf8");
}

function deriveInstallationId(): string {
  const ref = projectRef();
  if (ref) return installationIdFromSeed(`${INSTALLATION_SEED_PREFIX}${ref}`);

  const persisted = loadPersistedInstallationId();
  if (persisted) return persisted;

  const generated = randomUUID();
  try {
    persistInstallationId(generated);
  } catch {
    // Read-only FS (e.g. edge) — ephemeral id for this process.
  }
  return generated;
}

function deriveLicenseSigningSecret(): string | null {
  const env = getSupabaseEnv();
  return (
    process.env.LICENSE_SIGNING_SECRET?.trim() ||
    env.jwtSecret?.trim() ||
    process.env.APP_SESSION_SECRET?.trim() ||
    null
  );
}

/**
 * Populate INSTALLATION_ID and LICENSE_SIGNING_SECRET in process.env when absent.
 * Call once from server entry after .env is loaded.
 */
export function ensureInstallationEnv(): void {
  if (ensured) return;
  ensured = true;

  if (!process.env.INSTALLATION_ID?.trim()) {
    process.env.INSTALLATION_ID = deriveInstallationId();
  }

  if (!process.env.LICENSE_SIGNING_SECRET?.trim()) {
    const secret = deriveLicenseSigningSecret();
    if (secret) process.env.LICENSE_SIGNING_SECRET = secret;
  }
}

export function getLicenseSigningSecret(): string {
  ensureInstallationEnv();
  const secret = process.env.LICENSE_SIGNING_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "Не задан секрет подписи лицензий. Укажите SUPABASE_JWT_SECRET в окружении.",
    );
  }
  return secret;
}
