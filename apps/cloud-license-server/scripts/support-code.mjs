#!/usr/bin/env node
/**
 * Support code for Vercel admin UI (/admin).
 * Uses LICENSE_SERVER_ADMIN_SECRET from env or .env in cwd.
 *
 *   npm run support-code
 */

import { createHmac } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const TTL_MS = 15 * 60 * 1000;

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));
loadEnvFile(resolve(process.cwd(), ".env.local"));

function codeForSlot(secret, slot) {
  const hmac = createHmac("sha256", secret).update(`vendor-support:v1:${slot}`).digest();
  return String(hmac.readUInt32BE(0) % 100_000_000).padStart(8, "0");
}

const secret = process.env.LICENSE_SERVER_ADMIN_SECRET?.trim();
if (!secret) {
  console.error("Set LICENSE_SERVER_ADMIN_SECRET in .env");
  process.exit(1);
}

const now = Date.now();
const slot = Math.floor(now / TTL_MS);
const code = codeForSlot(secret, slot);

console.log(code);
console.error(`valid_until=${new Date((slot + 1) * TTL_MS).toISOString()}`);
console.error("Open https://your-app.vercel.app/admin and enter this code");
