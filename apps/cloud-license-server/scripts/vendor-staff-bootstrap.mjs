#!/usr/bin/env node
/**
 * Trigger first owner bootstrap from LICENSE_SERVER_VENDOR_ADMIN_TELEGRAM_CHATS.
 * Password is sent to Telegram DM only (not returned by API).
 *
 *   npm run vendor-staff:bootstrap
 *
 * Requires LICENSE_SERVER_ADMIN_SECRET in .env (Bearer auth).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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

const baseUrl = (process.env.VITE_LICENSE_SERVER_URL || process.env.LICENSE_SERVER_URL || "http://127.0.0.1:3848").replace(/\/$/, "");
const secret = process.env.LICENSE_SERVER_ADMIN_SECRET?.trim();

if (!secret) {
  console.error("LICENSE_SERVER_ADMIN_SECRET required in .env");
  process.exit(1);
}

const res = await fetch(`${baseUrl}/api/v1/admin/staff/bootstrap`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secret}`,
  },
});

const payload = await res.json();
if (!res.ok) {
  console.error(payload.error ?? res.status);
  process.exit(1);
}

if (payload.skipped) {
  console.log("Skipped:", payload.reason ?? "already bootstrapped");
  process.exit(0);
}

console.log("Owner created:", payload.staff.email, `(${payload.staff.role})`);
console.log("Password sent via Telegram:", payload.password_sent ? "yes" : "no — check bot token and chat id");
