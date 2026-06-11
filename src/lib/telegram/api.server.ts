import { loadSystemSettings, saveTelegramWebhookSecret } from "@/lib/auth/policy";
import { resolveAppOrigin } from "@/lib/app-origin.server";

export type TelegramApiResult<T = unknown> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
};

export type TelegramMessage = {
  message_id: number;
  chat: { id: number; type: string };
  from?: TelegramUser;
  text?: string;
};

export type TelegramCallbackQuery = {
  id: string;
  from?: TelegramUser;
  message?: TelegramMessage;
  data?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

export async function telegramWebhookUrl(): Promise<string | null> {
  const origin = await resolveAppOrigin();
  if (!origin) return null;
  return `${origin}/api/public/hooks/telegram-webhook`;
}

async function getBotToken(): Promise<string | null> {
  const { telegram } = await loadSystemSettings();
  return telegram.bot_token || null;
}

export async function callTelegramApi<T = unknown>(
  method: string,
  body?: Record<string, unknown>,
): Promise<TelegramApiResult<T>> {
  const token = await getBotToken();
  if (!token) {
    return { ok: false, description: "Telegram не настроен" };
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = (await res.json().catch(() => ({}))) as TelegramApiResult<T>;
  if (!res.ok || !payload.ok) {
    return {
      ok: false,
      description: payload.description ?? `Telegram HTTP ${res.status}`,
    };
  }
  return payload;
}

export async function getTelegramBotInfo() {
  return callTelegramApi<{ username?: string; first_name?: string }>("getMe");
}

export async function registerTelegramWebhook(secret?: string) {
  const url = await telegramWebhookUrl();
  if (!url) {
    return { ok: false, error: "Укажите публичный URL приложения в настройках системы → Общие" };
  }

  const { stopTelegramPolling } = await import("./polling.server");
  stopTelegramPolling();

  const webhookSecret = secret?.trim() || crypto.randomUUID().replace(/-/g, "").slice(0, 32);

  const result = await callTelegramApi("setWebhook", {
    url,
    secret_token: webhookSecret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });

  if (!result.ok) {
    return { ok: false, error: result.description ?? "Не удалось зарегистрировать webhook" };
  }

  await saveTelegramWebhookSecret(webhookSecret);

  const { syncTelegramBotProfile } = await import("./bot-profile.server");
  const profile = await syncTelegramBotProfile();
  if (!profile.ok) {
    console.warn("[telegram] bot profile sync failed:", profile.error);
  }

  return {
    ok: true,
    webhook_url: url,
    webhook_secret: webhookSecret,
    profile_synced: profile.ok,
  };
}

export async function deleteTelegramWebhook() {
  const result = await callTelegramApi("deleteWebhook", { drop_pending_updates: true });
  if (!result.ok) {
    return { ok: false, error: result.description ?? "Не удалось удалить webhook" };
  }
  await saveTelegramWebhookSecret("");
  const { ensureTelegramPolling } = await import("./polling.server");
  void ensureTelegramPolling();
  return { ok: true };
}
