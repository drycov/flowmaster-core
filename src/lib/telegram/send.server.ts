import { loadSystemSettings } from "@/lib/auth/policy";
import { callTelegramApi, getTelegramBotInfo, registerTelegramWebhook } from "./api.server";

export type TelegramSendResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  mode?: "webhook" | "polling";
  webhook_registered?: boolean;
};

export async function resolveTelegramConfig() {
  const { telegram } = await loadSystemSettings();
  return telegram;
}

export type TelegramReplyMarkup = Record<string, unknown>;

export async function sendTelegramMessage(
  text: string,
  chatId?: string,
  options?: {
    requireEnabled?: boolean;
    reply_markup?: TelegramReplyMarkup;
    remove_keyboard?: boolean;
  },
): Promise<TelegramSendResult> {
  const config = await resolveTelegramConfig();
  const requireEnabled = options?.requireEnabled !== false;
  if (!config.bot_token || (requireEnabled && !config.enabled)) {
    return { ok: false, skipped: true, error: "Telegram не настроен" };
  }

  const targetChat = chatId?.trim() || config.default_chat_id;
  if (!targetChat) {
    return { ok: false, skipped: true, error: "Не указан chat_id" };
  }

  let reply_markup: TelegramReplyMarkup | undefined = options?.reply_markup;
  if (options?.remove_keyboard) {
    reply_markup = { remove_keyboard: true };
  }

  const result = await callTelegramApi("sendMessage", {
    chat_id: targetChat,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(reply_markup ? { reply_markup } : {}),
  });

  if (!result.ok) {
    return { ok: false, error: result.description ?? "Telegram send failed" };
  }

  return { ok: true };
}

export async function testTelegramBot(): Promise<
  TelegramSendResult & { webhook_registered?: boolean }
> {
  const config = await resolveTelegramConfig();
  if (!config.bot_token) {
    return { ok: false, error: "Укажите токен бота" };
  }

  const botInfo = await getTelegramBotInfo();
  if (!botInfo.ok) {
    return { ok: false, error: botInfo.description ?? "Неверный токен бота" };
  }

  let webhookRegistered = await import("./polling.server").then((m) => m.isTelegramWebhookActive());
  if (!webhookRegistered) {
    const hook = await registerTelegramWebhook();
    if (hook.ok) {
      webhookRegistered = true;
    } else {
      const { ensureTelegramPolling } = await import("./polling.server");
      void ensureTelegramPolling();
    }
  }

  const mode = webhookRegistered ? ("webhook" as const) : ("polling" as const);

  if (config.default_chat_id) {
    const sent = await sendTelegramMessage(
      `✅ Тестовое сообщение от ЕСЭДО (@${botInfo.result?.username ?? "bot"}, режим: ${mode})`,
      config.default_chat_id,
      { requireEnabled: false },
    );
    return { ...sent, webhook_registered: webhookRegistered, mode };
  }

  return { ok: true, webhook_registered: webhookRegistered, mode };
}
