import { createHmac, randomBytes } from "node:crypto";

export function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signJwt(payload, secret) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function genSupabaseJwt(role, jwtSecret) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 5 * 3600 * 24 * 365;
  return signJwt({ role, iss: "supabase", iat, exp }, jwtSecret);
}

export function hex(bytes) {
  return randomBytes(bytes).toString("hex");
}

export function b64(bytes) {
  return randomBytes(bytes).toString("base64");
}

/** Keys reused across regenerations when present in an existing env file. */
export const SECRET_KEYS = [
  "JWT_SECRET",
  "ANON_KEY",
  "SERVICE_ROLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "POSTGRES_PASSWORD",
  "DASHBOARD_PASSWORD",
  "SECRET_KEY_BASE",
  "VAULT_ENC_KEY",
  "PG_META_CRYPTO_KEY",
  "LOGFLARE_PUBLIC_ACCESS_TOKEN",
  "LOGFLARE_PRIVATE_ACCESS_TOKEN",
  "S3_PROTOCOL_ACCESS_KEY_ID",
  "S3_PROTOCOL_ACCESS_KEY_SECRET",
  "CRON_SECRET",
  "POOLER_TENANT_ID",
  "GRAFANA_ADMIN_PASSWORD",
  "LICENSE_SIGNING_SECRET",
  "INSTALLATION_ID",
];

export function createSupabaseSecrets(existing = new Map(), { rotate = false } = {}) {
  const pick = (key, factory) => {
    if (!rotate && existing.get(key)) return existing.get(key);
    return factory();
  };

  const jwtSecret = pick("JWT_SECRET", () => b64(30));
  const anonKey = pick("ANON_KEY", () => genSupabaseJwt("anon", jwtSecret));
  const serviceRoleKey = pick("SERVICE_ROLE_KEY", () => genSupabaseJwt("service_role", jwtSecret));

  return {
    JWT_SECRET: jwtSecret,
    ANON_KEY: anonKey,
    SERVICE_ROLE_KEY: serviceRoleKey,
    SUPABASE_PUBLISHABLE_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    SUPABASE_JWT_SECRET: jwtSecret,
    VITE_SUPABASE_PUBLISHABLE_KEY: anonKey,
    POSTGRES_PASSWORD: pick("POSTGRES_PASSWORD", () => hex(16)),
    DASHBOARD_PASSWORD: pick("DASHBOARD_PASSWORD", () => hex(16)),
    SECRET_KEY_BASE: pick("SECRET_KEY_BASE", () => b64(48)),
    VAULT_ENC_KEY: pick("VAULT_ENC_KEY", () => hex(16)),
    PG_META_CRYPTO_KEY: pick("PG_META_CRYPTO_KEY", () => b64(24)),
    LOGFLARE_PUBLIC_ACCESS_TOKEN: pick("LOGFLARE_PUBLIC_ACCESS_TOKEN", () => b64(24)),
    LOGFLARE_PRIVATE_ACCESS_TOKEN: pick("LOGFLARE_PRIVATE_ACCESS_TOKEN", () => b64(24)),
    S3_PROTOCOL_ACCESS_KEY_ID: pick("S3_PROTOCOL_ACCESS_KEY_ID", () => hex(16)),
    S3_PROTOCOL_ACCESS_KEY_SECRET: pick("S3_PROTOCOL_ACCESS_KEY_SECRET", () => hex(32)),
    CRON_SECRET: pick("CRON_SECRET", () => hex(32)),
    POOLER_TENANT_ID: pick("POOLER_TENANT_ID", () => hex(8)),
    GRAFANA_ADMIN_PASSWORD: pick("GRAFANA_ADMIN_PASSWORD", () => hex(16)),
    LICENSE_SIGNING_SECRET: pick("LICENSE_SIGNING_SECRET", () => hex(32)),
    LICENSE_SERVER_ADMIN_SECRET: pick("LICENSE_SERVER_ADMIN_SECRET", () => hex(32)),
  };
}
