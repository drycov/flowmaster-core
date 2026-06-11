import type { Context } from "hono";
import { timingSafeEqual } from "node:crypto";
import { getSupabase } from "./supabase.js";
import { getTelegramWebhookSecret } from "./vendor-admin-config.js";
import { handleTelegramVendorAdminStart } from "./vendor-admin-verify.js";
import { sendVendorTelegramMessage } from "./vendor-telegram.server.js";

type TelegramUpdate = {
  update_id?: number;
  message?: {
    chat?: { id?: number; username?: string; first_name?: string };
    from?: { id?: number; username?: string };
    text?: string;
    date?: number;
  };
};

function logWebhook(event: string, data: Record<string, unknown>): void {
  console.log(`[telegram-webhook] ${event}`, JSON.stringify(data));
}

function summarizeUpdate(update: TelegramUpdate) {
  return {
    update_id: update.update_id,
    chat_id: update.message?.chat?.id,
    chat_username: update.message?.chat?.username,
    from_id: update.message?.from?.id,
    text: update.message?.text,
  };
}

async function notifyChat(chatId: string, text: string): Promise<void> {
  const result = await sendVendorTelegramMessage(chatId, text);
  logWebhook("bot_status", { chat_id: chatId, text, sent: result.ok, ...(result.ok ? {} : result) });
}

function verifyTelegramWebhookSecret(header: string | undefined, secret: string): boolean {
  if (!header) return false;
  if (header.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(header), Buffer.from(secret));
  } catch {
    return false;
  }
}

export async function handleTelegramWebhook(c: Context): Promise<Response> {
  const secret = getTelegramWebhookSecret();
  const secretHeader = c.req.header("X-Telegram-Bot-Api-Secret-Token");
  const secretOk = secret ? verifyTelegramWebhookSecret(secretHeader, secret) : true;

  let rawBody: string;
  try {
    rawBody = await c.req.text();
  } catch (err) {
    logWebhook("read_error", { error: err instanceof Error ? err.message : String(err) });
    return c.json({ ok: true });
  }

  logWebhook("received", {
    path: c.req.path,
    secret_configured: Boolean(secret),
    secret_ok: secretOk,
    body_preview: rawBody.slice(0, 500),
  });

  if (secret && !secretOk) {
    logWebhook("rejected", {
      reason: "invalid_secret_token",
      header_present: Boolean(secretHeader),
      header_len: secretHeader?.length ?? 0,
      env_secret_len: secret.length,
      hint: "Vercel VENDOR_TELEGRAM_WEBHOOK_SECRET must match setWebhook secret_token; npm run vendor-telegram:webhook",
    });
    return c.json({ ok: false }, 401);
  }

  let update: TelegramUpdate;
  try {
    update = rawBody ? (JSON.parse(rawBody) as TelegramUpdate) : {};
  } catch (err) {
    logWebhook("parse_error", { error: err instanceof Error ? err.message : String(err), rawBody });
    return c.json({ ok: true });
  }

  logWebhook("parsed", summarizeUpdate(update));

  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim();
  if (!chatId || !text?.startsWith("/start")) {
    logWebhook("ignored", { reason: "not_start_command", ...summarizeUpdate(update) });
    return c.json({ ok: true });
  }

  const payload = text.slice("/start".length).trim();
  const chatIdStr = String(chatId);

  if (payload.startsWith("vendor_admin_")) {
    await notifyChat(chatIdStr, "⏳ Webhook получен, проверяю код Cloud Admin…");
    logWebhook("verify_start", { chat_id: chatIdStr, payload_prefix: payload.slice(0, 24) });

    let reply: string;
    try {
      reply = await handleTelegramVendorAdminStart(getSupabase(), chatIdStr, payload);
      logWebhook("verify_done", { chat_id: chatIdStr, ok: reply.startsWith("✅") });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logWebhook("verify_error", { chat_id: chatIdStr, error: message });
      reply = `❌ Ошибка webhook: ${message}`;
    }

    await notifyChat(chatIdStr, reply);
    return c.json({ ok: true });
  }

  const reply =
    "🛡 Бот вендора ZEUS — подтверждение входа в Cloud Admin.\n" +
    "Откройте /admin на license server, войдите email+паролем и перейдите по ссылке из браузера.\n" +
    "Это не бот клиентского EDMS.";

  logWebhook("welcome", { chat_id: chatIdStr });
  await notifyChat(chatIdStr, reply);
  return c.json({ ok: true });
}
