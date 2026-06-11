#!/usr/bin/env node
/**
 * Register Telegram webhook for vendor Cloud Admin bot (@zeus_cloud_bot).
 *
 *   npm run vendor-telegram:webhook          # set webhook
 *   npm run vendor-telegram:webhook -- --info # check current webhook
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

const token =
  process.env.VENDOR_TELEGRAM_BOT_TOKEN?.trim() || process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret =
  process.env.VENDOR_TELEGRAM_WEBHOOK_SECRET?.trim() ||
  process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
const baseUrl = (
  process.env.VITE_LICENSE_SERVER_URL ||
  process.env.LICENSE_SERVER_URL ||
  "https://z-edms.vercel.app"
).replace(/\/$/, "");
const webhookUrl = `${baseUrl}/api/v1/hooks/telegram`;
const infoOnly = process.argv.includes("--info");

if (!token) {
  console.error("VENDOR_TELEGRAM_BOT_TOKEN required in .env");
  process.exit(1);
}

async function tg(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

if (infoOnly) {
  const info = await tg("getWebhookInfo");
  console.log(JSON.stringify(info, null, 2));
  process.exit(info.ok ? 0 : 1);
}

if (!secret) {
  console.error("VENDOR_TELEGRAM_WEBHOOK_SECRET required (Telegram sends X-Telegram-Bot-Api-Secret-Token)");
  process.exit(1);
}

console.log("Setting webhook:", webhookUrl);
const result = await tg("setWebhook", {
  url: webhookUrl,
  secret_token: secret,
  allowed_updates: ["message"],
  drop_pending_updates: true,
});

if (!result.ok) {
  console.error("setWebhook failed:", result.description ?? result);
  process.exit(1);
}

console.log("OK:", result.description ?? "Webhook set");
const info = await tg("getWebhookInfo");
if (info.ok && info.result) {
  console.log("Current URL:", info.result.url || "(empty)");
  console.log("Pending updates:", info.result.pending_update_count ?? 0);
  if (info.result.last_error_message) {
    console.warn("Last error:", info.result.last_error_message);
  }
}
