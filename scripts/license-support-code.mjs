#!/usr/bin/env node
/**
 * Generate a time-limited vendor support code for local license admin UI.
 *
 *   npm run license:support-code
 *
 * Requires LICENSE_SERVER_ADMIN_SECRET in .env / .env.license-server
 */

import { createHmac } from "node:crypto";
import { loadEnvFiles } from "./lib/load-env.mjs";

const TTL_MS = 15 * 60 * 1000;

function codeForSlot(secret, slot) {
  const hmac = createHmac("sha256", secret).update(`vendor-support:v1:${slot}`).digest();
  const num = hmac.readUInt32BE(0) % 100_000_000;
  return String(num).padStart(8, "0");
}

loadEnvFiles([".env", ".env.license-server"]);

const secret = process.env.LICENSE_SERVER_ADMIN_SECRET?.trim();
if (!secret) {
  console.error("Set LICENSE_SERVER_ADMIN_SECRET (npm run env:license-server -- --install)");
  process.exit(1);
}

const now = Date.now();
const slot = Math.floor(now / TTL_MS);
const code = codeForSlot(secret, slot);
const validUntil = new Date((slot + 1) * TTL_MS);

console.log(code);
console.error(`valid_until=${validUntil.toISOString()}`);
console.error("ttl_minutes=15");
