#!/usr/bin/env node
/**
 * First-time Docker setup: copy .env.docker.example → .env and generate Supabase secrets.
 *
 * Usage:
 *   node scripts/docker-setup.mjs
 *   node scripts/docker-setup.mjs --force   # overwrite existing .env
 */

import { createHmac, randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");
const templatePath = resolve(root, ".env.docker.example");
const force = process.argv.includes("--force");

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

if (!existsSync(templatePath)) {
  console.error("Missing .env.docker.example");
  process.exit(1);
}

if (existsSync(envPath) && !force) {
  console.log(".env already exists — run with --force to regenerate.");
  process.exit(0);
}

const jwtSecret = b64(30);
const anonKey = genToken("anon", jwtSecret);
const serviceRoleKey = genToken("service_role", jwtSecret);

let env = readFileSync(templatePath, "utf8");
const replacements = {
  JWT_SECRET: jwtSecret,
  ANON_KEY: anonKey,
  SERVICE_ROLE_KEY: serviceRoleKey,
  SUPABASE_PUBLISHABLE_KEY: anonKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  SUPABASE_JWT_SECRET: jwtSecret,
  VITE_SUPABASE_PUBLISHABLE_KEY: anonKey,
  SUPABASE_URL: "http://localhost:54321",
  POSTGRES_PASSWORD: hex(16),
  DASHBOARD_PASSWORD: hex(16),
  SECRET_KEY_BASE: b64(48),
  VAULT_ENC_KEY: hex(16),
  PG_META_CRYPTO_KEY: b64(24),
  LOGFLARE_PUBLIC_ACCESS_TOKEN: b64(24),
  LOGFLARE_PRIVATE_ACCESS_TOKEN: b64(24),
  S3_PROTOCOL_ACCESS_KEY_ID: hex(16),
  S3_PROTOCOL_ACCESS_KEY_SECRET: hex(32),
  CRON_SECRET: hex(32),
  POOLER_TENANT_ID: hex(8),
};

for (const [key, value] of Object.entries(replacements)) {
  const re = new RegExp(`^(${key}=).*`, "m");
  if (re.test(env)) {
    env = env.replace(re, `$1${value}`);
  } else {
    env += `\n${key}=${value}`;
  }
}

writeFileSync(envPath, env, "utf8");
console.log("Created .env with generated secrets.");
console.log("");
console.log("Next steps:");
console.log("  docker compose up -d --build");
console.log("  curl http://localhost/api/health       # через nginx");
console.log("  curl http://localhost:3000/api/health  # напрямую");
console.log("  open http://localhost/auth");
console.log("");
console.log("Supabase API: http://localhost:54321");
console.log("");
console.log("Development (Vite on host):");
console.log("  node scripts/docker-up.mjs --dev");
console.log("  npm run dev");
console.log("");
console.log("Full stack:");
console.log("  node scripts/docker-up.mjs");
console.log("  docker compose --profile cron up -d");
