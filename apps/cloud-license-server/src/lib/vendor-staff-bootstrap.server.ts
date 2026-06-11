import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getTelegramBotToken,
  getVendorTelegramChatByEmail,
} from "./vendor-admin-config.js";
import { sendVendorTelegramMessage } from "./vendor-telegram.server.js";
import {
  bootstrapFirstOwner,
  countActiveVendorStaff,
  type VendorStaffPublic,
} from "./vendor-staff.server.js";

export type OwnerBootstrapResult = {
  staff: VendorStaffPublic;
  password_sent: boolean;
};

export function generateBootstrapPassword(): string {
  return randomBytes(12).toString("base64url");
}

function adminLoginUrl(): string {
  const base = process.env.VITE_LICENSE_SERVER_URL?.trim() || "https://z-edms.vercel.app";
  return `${base.replace(/\/$/, "")}/admin`;
}

function firstTelegramStaffEntry(): { email: string; chatId: string } | null {
  const map = getVendorTelegramChatByEmail();
  const first = map.entries().next();
  if (first.done) return null;
  const [email, chatId] = first.value;
  return { email, chatId };
}

/** Create first owner from LICENSE_SERVER_VENDOR_ADMIN_TELEGRAM_CHATS and DM password. */
export async function bootstrapOwnerFromTelegramEnv(
  supabase: SupabaseClient,
): Promise<OwnerBootstrapResult | null> {
  if ((await countActiveVendorStaff(supabase)) > 0) return null;

  const entry = firstTelegramStaffEntry();
  if (!entry) return null;

  if (!getTelegramBotToken()) {
    throw new Error("VENDOR_TELEGRAM_BOT_TOKEN обязателен для bootstrap owner");
  }

  const password = generateBootstrapPassword();
  const fullName = entry.email.split("@")[0] ?? entry.email;

  const staff = await bootstrapFirstOwner(supabase, {
    email: entry.email,
    password,
    full_name: fullName,
    telegram_chat_id: entry.chatId,
  });

  const text = [
    "🛡 Cloud Admin — создан owner",
    "",
    `Email: ${staff.email}`,
    `Пароль: ${password}`,
    "",
    `Вход: ${adminLoginUrl()}`,
    "",
    "Сохраните пароль. После входа подтвердите доступ в Telegram.",
  ].join("\n");

  const sendResult = await sendVendorTelegramMessage(entry.chatId, text);
  const password_sent = sendResult.ok;
  if (!password_sent) {
    console.error(`[vendor-staff] owner created but Telegram DM failed for chat ${entry.chatId}`);
  }

  return { staff, password_sent };
}

let bootstrapInFlight: Promise<OwnerBootstrapResult | null> | null = null;

/** Idempotent: runs once per process while vendor_staff is empty. */
export function ensureVendorOwnerBootstrapped(): Promise<OwnerBootstrapResult | null> {
  if (!bootstrapInFlight) {
    bootstrapInFlight = (async () => {
      try {
        const { getSupabase } = await import("./supabase.js");
        return await bootstrapOwnerFromTelegramEnv(getSupabase());
      } catch (err) {
        bootstrapInFlight = null;
        throw err;
      }
    })();
  }
  return bootstrapInFlight;
}
