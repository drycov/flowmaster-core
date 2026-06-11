#!/usr/bin/env node
/**
 * Admin CLI for vendor license server (register key / revoke activation).
 *
 *   node scripts/license-server-admin.mjs register --key "FM1...."
 *   node scripts/license-server-admin.mjs revoke --installation-id <uuid>
 *   node scripts/license-server-admin.mjs revoke --key-hash <sha256>
 *
 * Env (auto-loaded from .env / .env.license-server):
 *   LICENSE_SERVER_URL, LICENSE_SERVER_ADMIN_SECRET
 */

import { loadEnvFiles } from "./lib/load-env.mjs";

loadEnvFiles();

const args = process.argv.slice(2);
const command = args[0];

function flag(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

const baseUrl = (process.env.LICENSE_SERVER_URL ?? process.env.PUBLIC_APP_URL ?? "").replace(/\/$/, "");
const secret = process.env.LICENSE_SERVER_ADMIN_SECRET ?? "";

if (!baseUrl || !secret) {
  console.error("Set LICENSE_SERVER_URL (or PUBLIC_APP_URL) and LICENSE_SERVER_ADMIN_SECRET");
  console.error("Hint: npm run env:license-server -- --install");
  process.exit(1);
}

async function post(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    console.error(data.error ?? data);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
}

if (command === "register") {
  const key = flag("--key");
  if (!key) {
    console.error("Usage: register --key FM1....");
    process.exit(1);
  }
  await post("/api/v1/license/register-key", { license_key: key });
} else if (command === "revoke") {
  const installationId = flag("--installation-id");
  const keyId = flag("--key-id");
  const keyHash = flag("--key-hash");
  const reason = flag("--reason") ?? "Revoked by vendor";
  if (!installationId && !keyId && !keyHash) {
    console.error("Usage: revoke --installation-id <id> | --key-id <id> | --key-hash <hash>");
    process.exit(1);
  }
  await post("/api/v1/license/revoke", {
    installation_id: installationId ?? undefined,
    key_id: keyId ?? undefined,
    key_hash: keyHash ?? undefined,
    reason,
  });
} else {
  console.error("Commands: register | revoke");
  process.exit(1);
}
