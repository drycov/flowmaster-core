#!/usr/bin/env node
/**
 * Reset owner password and send new one via vendor Telegram bot.
 *
 *   npm run vendor-staff:reset-password
 */

import { randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

function parseTelegramChats(raw) {
  const map = new Map();
  if (!raw?.trim()) return map;
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    const sep = trimmed.lastIndexOf(":");
    if (sep <= 0) continue;
    const email = trimmed.slice(0, sep).trim().toLowerCase();
    const chatId = trimmed.slice(sep + 1).trim();
    if (email && chatId) map.set(email, chatId);
  }
  return map;
}

loadEnvFile(resolve(process.cwd(), ".env"));
loadEnvFile(resolve(process.cwd(), ".env.local"));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const token = process.env.VENDOR_TELEGRAM_BOT_TOKEN?.trim();
const baseUrl = (process.env.VITE_LICENSE_SERVER_URL || "https://z-edms.vercel.app").replace(/\/$/, "");
const chats = parseTelegramChats(process.env.LICENSE_SERVER_VENDOR_ADMIN_TELEGRAM_CHATS);

const { data: owner, error: ownerErr } = await supabase
  .from("vendor_staff")
  .select("id,email,user_id,telegram_chat_id,role")
  .eq("role", "owner")
  .eq("status", "active")
  .maybeSingle();

if (ownerErr) {
  console.error(ownerErr.message);
  process.exit(1);
}
if (!owner?.user_id) {
  console.error("Owner not found in vendor_staff");
  process.exit(1);
}

const password = randomBytes(12).toString("base64url");
const { error: updErr } = await supabase.auth.admin.updateUserById(owner.user_id, {
  password,
  email_confirm: true,
});
if (updErr) {
  console.error(updErr.message);
  process.exit(1);
}

const chatId = owner.telegram_chat_id?.trim() || chats.get(owner.email.toLowerCase());
if (!chatId) {
  console.error("No telegram_chat_id for owner");
  process.exit(1);
}
if (!token) {
  console.error("VENDOR_TELEGRAM_BOT_TOKEN missing");
  process.exit(1);
}

const text = [
  "🛡 Cloud Admin — новый пароль",
  "",
  `Email: ${owner.email}`,
  `Пароль: ${password}`,
  "",
  `Вход: ${baseUrl}/admin`,
].join("\n");

const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ chat_id: chatId, text }),
});

if (!tgRes.ok) {
  const body = await tgRes.text();
  console.error("Telegram send failed:", body);
  console.error("Password was reset but NOT sent. Save manually:", password);
  process.exit(1);
}

console.log("Password reset for", owner.email);
console.log("Sent to Telegram chat", chatId);
