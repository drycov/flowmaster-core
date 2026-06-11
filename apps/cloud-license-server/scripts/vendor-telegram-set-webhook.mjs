#!/usr/bin/env node
/**
 * Vendor Telegram bot webhook.
 *
 *   npm run vendor-telegram:webhook           # register webhook
 *   npm run vendor-telegram:webhook -- --check  # full diagnostics
 *   npm run vendor-telegram:webhook -- --info   # raw getWebhookInfo
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
const adminSecret = process.env.LICENSE_SERVER_ADMIN_SECRET?.trim();
const checkOnly = process.argv.includes("--check");
const infoOnly = process.argv.includes("--info");

async function tg(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

function printChecks(result) {
  console.log(`Expected URL: ${result.expected_url}`);
  console.log(`Overall: ${result.ok ? "OK" : "FAILED"}\n`);
  for (const item of result.checks) {
    console.log(`${item.ok ? "✓" : "✗"} ${item.name}: ${item.detail}`);
  }
}

if (checkOnly) {
  const checkPaths = [
    `${baseUrl}/api/v1/hooks/telegram/check`,
    `${baseUrl}/api/v1/admin/telegram/webhook/check`,
  ];

  if (adminSecret) {
    for (const checkUrl of checkPaths) {
      const res = await fetch(checkUrl, {
        headers: { Authorization: `Bearer ${adminSecret}` },
      });
      const raw = await res.text();
      try {
        const payload = JSON.parse(raw);
        if (!payload.error && Array.isArray(payload.checks)) {
          console.log(`Check via ${checkUrl}`);
          printChecks(payload);
          process.exit(payload.ok ? 0 : 1);
        }
      } catch {
        if (checkUrl === checkPaths[checkPaths.length - 1]) {
          console.warn(`API check unavailable (HTTP ${res.status}), running local checks…`);
        }
      }
    }
  }

  if (!token) {
    console.error("VENDOR_TELEGRAM_BOT_TOKEN required (or LICENSE_SERVER_ADMIN_SECRET for API check)");
    process.exit(1);
  }

  const checks = [];
  let ok = true;

  function add(name, pass, detail) {
    checks.push({ name, ok: pass, detail });
    if (!pass) ok = false;
  }

  add("bot_token", Boolean(token), token ? "configured" : "missing");
  add("webhook_secret", Boolean(secret), secret ? "configured" : "missing");

  const me = await tg("getMe");
  add("bot_getMe", me.ok === true, me.ok ? `@${me.result?.username}` : me.description ?? "failed");

  const info = await tg("getWebhookInfo");
  const registered = info.result?.url?.trim() ?? "";
  add(
    "webhook_url",
    registered === webhookUrl,
    registered ? `${registered}${registered === webhookUrl ? "" : ` (expected ${webhookUrl})`}` : "not set",
  );
  add(
    "telegram_delivery",
    !info.result?.last_error_message,
    info.result?.last_error_message ?? "no delivery errors",
  );
  add(
    "pending_updates",
    (info.result?.pending_update_count ?? 0) === 0,
    String(info.result?.pending_update_count ?? 0),
  );

  if (secret) {
    const good = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": secret,
      },
      body: JSON.stringify({ update_id: 0 }),
    });
    add("endpoint_probe", good.status === 200, `HTTP ${good.status}`);

    const bad = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ update_id: 0 }),
    });
    add("endpoint_secret_guard", bad.status === 401, `HTTP ${bad.status} (expected 401)`);
  }

  const delivery = checks.find((c) => c.name === "telegram_delivery");
  const probe = checks.find((c) => c.name === "endpoint_probe");
  if (delivery && !delivery.ok && delivery.detail.includes("401") && probe?.ok) {
    add(
      "vercel_secret_sync",
      false,
      "Telegram → 401, probe с локальным secret → 200: на Vercel другой VENDOR_TELEGRAM_WEBHOOK_SECRET",
    );
  }

  printChecks({ ok, expected_url: webhookUrl, checks });
  process.exit(ok ? 0 : 1);
}

if (!token) {
  console.error("VENDOR_TELEGRAM_BOT_TOKEN required in .env");
  process.exit(1);
}

if (infoOnly) {
  const info = await tg("getWebhookInfo");
  console.log(JSON.stringify(info, null, 2));
  process.exit(info.ok ? 0 : 1);
}

const useLocal = process.argv.includes("--local");
const registerPaths = [
  `${baseUrl}/api/v1/hooks/telegram/register`,
  `${baseUrl}/api/v1/admin/telegram/webhook/register`,
];

if (adminSecret && !useLocal) {
  for (const registerUrl of registerPaths) {
    const res = await fetch(registerUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminSecret}` },
    });
    const raw = await res.text();
    try {
      const payload = JSON.parse(raw);
      if (payload.ok && payload.url) {
        console.log(`Registered via ${registerUrl}`);
        console.log("URL:", payload.url);
        console.log("Vercel secret_len:", payload.secret_len);
        if (secret) console.log("Local secret_len:", secret.length);
        if (payload.webhook_info?.last_error_message) {
          console.warn("Last error:", payload.webhook_info.last_error_message);
        }
        process.exit(0);
      }
      if (payload.error && registerUrl === registerPaths[registerPaths.length - 1]) {
        console.warn(`API register failed: ${payload.error}, falling back to local setWebhook…`);
      }
    } catch {
      if (registerUrl === registerPaths[registerPaths.length - 1]) {
        console.warn(`API register unavailable (HTTP ${res.status}), falling back to local setWebhook…`);
      }
    }
  }
}

if (!secret) {
  console.error("VENDOR_TELEGRAM_WEBHOOK_SECRET required (Telegram sends X-Telegram-Bot-Api-Secret-Token)");
  process.exit(1);
}

console.log("Setting webhook locally (--local):", webhookUrl);
console.log("Local secret_len:", secret.length);
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
