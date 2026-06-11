#!/usr/bin/env node
/**
 * Production .env for Docker stack (nginx + Supabase + app).
 *
 * Usage:
 *   node scripts/docker-setup-production.mjs
 *   node scripts/docker-setup-production.mjs --domain=esedo.example.kz --email=admin@example.kz
 *   node scripts/docker-setup-production.mjs --install          # copy → .env
 *   node scripts/docker-setup-production.mjs --force            # overwrite .env.production
 */

import { createHmac, randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = resolve(root, ".env.docker.example");
const sourceEnvPath = resolve(root, ".env");
const outPath = resolve(root, ".env.production");

const args = process.argv.slice(2);
const force = args.includes("--force");
const install = args.includes("--install");

function argValue(name) {
  const hit = args.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
}

function b64url(input) {
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

function genToken(role, jwtSecret) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 5 * 3600 * 24 * 365;
  return signJwt({ role, iss: "supabase", iat, exp }, jwtSecret);
}

function hex(bytes) {
  return randomBytes(bytes).toString("hex");
}

function b64(bytes) {
  return randomBytes(bytes).toString("base64");
}

function parseEnv(text) {
  const map = new Map();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return map;
}

function setVar(env, key, value) {
  const re = new RegExp(`^(${key}=).*`, "m");
  if (re.test(env)) return env.replace(re, `$1${value}`);
  return `${env.trimEnd()}\n${key}=${value}\n`;
}

function pick(map, key, fallback) {
  const v = map.get(key);
  return v && v.length > 0 ? v : fallback;
}

if (!existsSync(templatePath)) {
  console.error("Missing .env.docker.example");
  process.exit(1);
}

if (existsSync(outPath) && !force && !install) {
  console.log(".env.production already exists — use --force to regenerate.");
  process.exit(0);
}

const domain = argValue("--domain") ?? process.env.PROXY_DOMAIN ?? "esedo.example.kz";
const certEmail = argValue("--email") ?? process.env.CERTBOT_EMAIL ?? `admin@${domain}`;
const publicUrl = `https://${domain}`;

const existing = existsSync(sourceEnvPath) ? parseEnv(readFileSync(sourceEnvPath, "utf8")) : new Map();

const jwtSecret = pick(existing, "JWT_SECRET", b64(30));
const anonKey = pick(existing, "ANON_KEY", genToken("anon", jwtSecret));
const serviceRoleKey = pick(existing, "SERVICE_ROLE_KEY", genToken("service_role", jwtSecret));

let env = readFileSync(templatePath, "utf8");

const replacements = {
  NODE_ENV: "production",
  LOG_LEVEL: "info",
  APP_URL: publicUrl,
  PUBLIC_APP_URL: publicUrl,
  CRON_SECRET: pick(existing, "CRON_SECRET", hex(32)),
  DISABLE_TELEGRAM_POLLING: "true",
  REPLICA_COUNT: pick(existing, "REPLICA_COUNT", "1"),
  VITE_SUPABASE_URL: publicUrl,
  VITE_SUPABASE_PUBLISHABLE_KEY: anonKey,
  SUPABASE_URL: publicUrl,
  SUPABASE_PUBLISHABLE_KEY: anonKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  SUPABASE_JWT_SECRET: jwtSecret,
  JWT_SECRET: jwtSecret,
  ANON_KEY: anonKey,
  SERVICE_ROLE_KEY: serviceRoleKey,
  POSTGRES_PASSWORD: pick(existing, "POSTGRES_PASSWORD", hex(16)),
  SECRET_KEY_BASE: pick(existing, "SECRET_KEY_BASE", b64(48)),
  VAULT_ENC_KEY: pick(existing, "VAULT_ENC_KEY", hex(16)),
  PG_META_CRYPTO_KEY: pick(existing, "PG_META_CRYPTO_KEY", b64(24)),
  LOGFLARE_PUBLIC_ACCESS_TOKEN: pick(existing, "LOGFLARE_PUBLIC_ACCESS_TOKEN", b64(24)),
  LOGFLARE_PRIVATE_ACCESS_TOKEN: pick(existing, "LOGFLARE_PRIVATE_ACCESS_TOKEN", b64(24)),
  S3_PROTOCOL_ACCESS_KEY_ID: pick(existing, "S3_PROTOCOL_ACCESS_KEY_ID", hex(16)),
  S3_PROTOCOL_ACCESS_KEY_SECRET: pick(existing, "S3_PROTOCOL_ACCESS_KEY_SECRET", hex(32)),
  SUPABASE_PUBLIC_URL: publicUrl,
  API_EXTERNAL_URL: publicUrl,
  SITE_URL: publicUrl,
  DASHBOARD_PASSWORD: pick(existing, "DASHBOARD_PASSWORD", hex(16)),
  POOLER_TENANT_ID: pick(existing, "POOLER_TENANT_ID", hex(8)),
  NGINX_HTTP_PORT: "80",
  NGINX_HTTPS_PORT: "443",
  PROXY_DOMAIN: domain,
  CERTBOT_EMAIL: certEmail,
  APPLY_DB_MIGRATIONS: "1",
  APPLY_DB_SEED: "0",
  ENABLE_EMAIL_AUTOCONFIRM: "false",
  DISABLE_SIGNUP: "false",
  STUDIO_DEFAULT_ORGANIZATION: "ЕСЭДО",
  STUDIO_DEFAULT_PROJECT: "Production",
  SENTRY_ENVIRONMENT: "production",
};

for (const [key, value] of Object.entries(replacements)) {
  env = setVar(env, key, value);
}

// Убрать устаревшие комментарии про localhost/nginx из шаблона
env = env.replace(
  /# ── Nginx reverse proxy ──[\s\S]*?# CERTBOT_EMAIL=admin@example\.kz\n\n/m,
  `# ── Nginx + HTTPS ─────────────────────────────────────────────────────────────
NGINX_HTTP_PORT=80
NGINX_HTTPS_PORT=443
PROXY_DOMAIN=${domain}
CERTBOT_EMAIL=${certEmail}

`,
);

const header = `# ЕСЭДО — production environment (auto-generated)
# Domain: ${domain}
# Regenerate: node scripts/docker-setup-production.mjs --domain=${domain} --force
# Deploy:
#   cp .env.production .env
#   docker compose -f docker-compose.yml -f docker-compose.nginx-tls.yml up -d --build
#   docker compose --profile cron up -d
#

`;

env = header + env.replace(/^# Flowmaster[^\n]*\n(?:# [^\n]*\n)*\n/m, "");

writeFileSync(outPath, env, "utf8");
console.log(`Created ${outPath}`);
console.log(`  Domain:  ${domain}`);
console.log(`  App URL: ${publicUrl}`);
console.log("");

if (install) {
  copyFileSync(outPath, resolve(root, ".env"));
  console.log("Copied → .env");
}

console.log("Next steps:");
console.log(`  1. DNS A-record: ${domain} → server IP`);
console.log("  2. cp .env.production .env   (or re-run with --install)");
console.log(
  "  3. docker compose -f docker-compose.yml -f docker-compose.nginx-tls.yml up -d --build",
);
console.log("  4. docker compose --profile cron up -d");
console.log(`  5. curl https://${domain}/api/health`);
