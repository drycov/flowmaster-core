import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let loaded = false;
let fileCache: Record<string, string> | undefined;

function parseEnvValue(raw: string): string {
  const val = raw.trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    return val.slice(1, -1);
  }
  return val;
}

function readEnvFile(): Record<string, string> {
  if (fileCache) return fileCache;

  fileCache = {};
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return fileCache;

  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    fileCache[key] = parseEnvValue(line.slice(eq + 1));
  }

  return fileCache;
}

/** Load .env into process.env (only unset keys) — for local Vite SSR / server functions. */
export function loadServerEnv() {
  if (loaded) return;
  loaded = true;

  for (const [key, value] of Object.entries(readEnvFile())) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/**
 * Server-side Supabase env.
 * Reads process.env first, then .env from disk (SSR / server-fn safe).
 */
export function getSupabaseEnv() {
  loadServerEnv();
  const fromFile = readEnvFile();

  return {
    url:
      process.env.SUPABASE_URL ??
      fromFile.SUPABASE_URL ??
      process.env.VITE_SUPABASE_URL ??
      fromFile.VITE_SUPABASE_URL,
    publishableKey:
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      fromFile.SUPABASE_PUBLISHABLE_KEY ??
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
      fromFile.VITE_SUPABASE_PUBLISHABLE_KEY,
    serviceRoleKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? fromFile.SUPABASE_SERVICE_ROLE_KEY,
    jwtSecret:
      process.env.SUPABASE_JWT_SECRET ??
      fromFile.SUPABASE_JWT_SECRET ??
      process.env.APP_SESSION_SECRET ??
      fromFile.APP_SESSION_SECRET,
  };
}
