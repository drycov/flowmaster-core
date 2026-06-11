import type { Context } from "hono";
import { getSupabase } from "./supabase.js";
import { getTelegramWebhookSecret } from "./vendor-admin-config.js";
import { handleTelegramVendorAdminStart } from "./vendor-admin-verify.js";
import { sendVendorTelegramMessage } from "./vendor-telegram.server.js";

type TelegramUpdate = {
  message?: {
    chat?: { id?: number };
    text?: string;
  };
};

export async function handleTelegramWebhook(c: Context): Promise<Response> {
  const secret = getTelegramWebhookSecret();
  if (secret) {
    const header = c.req.header("X-Telegram-Bot-Api-Secret-Token");
    if (header !== secret) return c.json({ ok: false }, 401);
  }

  let update: TelegramUpdate;
  try {
    update = await c.req.json();
  } catch {
    return c.json({ ok: true });
  }

  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim();
  if (!chatId || !text?.startsWith("/start")) {
    return c.json({ ok: true });
  }

  const payload = text.slice("/start".length).trim();

  let reply: string;
  if (payload.startsWith("vendor_admin_")) {
    reply = await handleTelegramVendorAdminStart(getSupabase(), String(chatId), payload);
  } else {
    reply =
      "🛡 Бот вендора ZEUS — подтверждение входа в Cloud Admin.\n" +
      "Откройте /admin на license server, войдите email+паролем и перейдите по ссылке из браузера.\n" +
      "Это не бот клиентского EDMS.";
  }

  await sendVendorTelegramMessage(String(chatId), reply);
  return c.json({ ok: true });
}
