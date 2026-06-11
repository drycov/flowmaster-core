import {
  getTelegramBotToken,
  getTelegramBotUsername,
  getTelegramWebhookSecret,
  getVendorTelegramChatByEmail,
} from "./vendor-admin-config.js";

export type WebhookCheckItem = {
  name: string;
  ok: boolean;
  detail: string;
};

export type VendorTelegramWebhookCheck = {
  ok: boolean;
  expected_url: string;
  checks: WebhookCheckItem[];
};

export function getExpectedTelegramWebhookUrl(baseUrl?: string): string {
  const base = (
    baseUrl?.trim() ||
    process.env.VITE_LICENSE_SERVER_URL?.trim() ||
    process.env.LICENSE_SERVER_URL?.trim() ||
    "https://z-edms.vercel.app"
  ).replace(/\/$/, "");
  return `${base}/api/v1/hooks/telegram`;
}

async function tgApi<T>(method: string, body?: Record<string, unknown>): Promise<T> {
  const token = getTelegramBotToken();
  if (!token) throw new Error("VENDOR_TELEGRAM_BOT_TOKEN not set");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return res.json() as Promise<T>;
}

export type RegisterTelegramWebhookResult = {
  ok: boolean;
  url: string;
  secret_len: number;
  description?: string;
  webhook_info?: {
    url?: string;
    pending_update_count?: number;
    last_error_message?: string;
  };
};

/** setWebhook using env vars available on this runtime (Vercel/local). */
export async function registerVendorTelegramWebhook(
  baseUrl?: string,
): Promise<RegisterTelegramWebhookResult> {
  const token = getTelegramBotToken();
  const secret = getTelegramWebhookSecret();
  if (!token) throw new Error("VENDOR_TELEGRAM_BOT_TOKEN не задан");
  if (!secret) throw new Error("VENDOR_TELEGRAM_WEBHOOK_SECRET не задан");

  const url = getExpectedTelegramWebhookUrl(baseUrl);
  const result = await tgApi<{ ok: boolean; description?: string }>("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
  if (!result.ok) {
    throw new Error(result.description ?? "setWebhook failed");
  }

  const info = await tgApi<{
    ok: boolean;
    result?: {
      url?: string;
      pending_update_count?: number;
      last_error_message?: string;
    };
  }>("getWebhookInfo");

  return {
    ok: true,
    url,
    secret_len: secret.length,
    description: result.description,
    webhook_info: info.result,
  };
}

export async function checkVendorTelegramWebhook(
  baseUrl?: string,
): Promise<VendorTelegramWebhookCheck> {
  const checks: WebhookCheckItem[] = [];
  const expectedUrl = getExpectedTelegramWebhookUrl(baseUrl);
  const token = getTelegramBotToken();
  const secret = getTelegramWebhookSecret();
  const bindings = getVendorTelegramChatByEmail().size;

  checks.push({
    name: "bot_token",
    ok: Boolean(token),
    detail: token ? "VENDOR_TELEGRAM_BOT_TOKEN задан" : "VENDOR_TELEGRAM_BOT_TOKEN не задан",
  });

  checks.push({
    name: "webhook_secret",
    ok: Boolean(secret),
    detail: secret
      ? "VENDOR_TELEGRAM_WEBHOOK_SECRET задан"
      : "VENDOR_TELEGRAM_WEBHOOK_SECRET не задан",
  });

  checks.push({
    name: "telegram_bindings",
    ok: bindings > 0,
    detail:
      bindings > 0
        ? `${bindings} привязок email:chat_id`
        : "LICENSE_SERVER_VENDOR_ADMIN_TELEGRAM_CHATS пуст",
  });

  const botUsername = getTelegramBotUsername();
  checks.push({
    name: "bot_username",
    ok: Boolean(botUsername),
    detail: botUsername ? `@${botUsername}` : "VENDOR_TELEGRAM_BOT_USERNAME не задан",
  });

  if (token) {
    try {
      const me = await tgApi<{ ok: boolean; result?: { username?: string; id?: number } }>("getMe");
      checks.push({
        name: "bot_getMe",
        ok: me.ok === true,
        detail: me.ok
          ? `@${me.result?.username ?? "?"} (id ${me.result?.id ?? "?"})`
          : "getMe failed",
      });
    } catch (err) {
      checks.push({
        name: "bot_getMe",
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      const info = await tgApi<{
        ok: boolean;
        result?: {
          url?: string;
          pending_update_count?: number;
          last_error_message?: string;
          last_error_date?: number;
        };
      }>("getWebhookInfo");

      const registeredUrl = info.result?.url?.trim() ?? "";
      const urlOk = registeredUrl === expectedUrl;
      checks.push({
        name: "webhook_url",
        ok: urlOk && Boolean(registeredUrl),
        detail: registeredUrl
          ? `зарегистрирован: ${registeredUrl}${urlOk ? "" : ` (ожидается ${expectedUrl})`}`
          : "webhook не зарегистрирован в Telegram",
      });

      const pending = info.result?.pending_update_count ?? 0;
      checks.push({
        name: "pending_updates",
        ok: pending === 0,
        detail: pending === 0 ? "нет очереди" : `${pending} необработанных update`,
      });

      const lastError = info.result?.last_error_message?.trim();
      const deliveryOk = !lastError;
      checks.push({
        name: "telegram_delivery",
        ok: deliveryOk,
        detail: lastError ?? "ошибок доставки нет",
      });
    } catch (err) {
      checks.push({
        name: "webhook_url",
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (secret) {
    try {
      const goodRes = await fetch(expectedUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Telegram-Bot-Api-Secret-Token": secret,
        },
        body: JSON.stringify({ update_id: 0 }),
      });
      checks.push({
        name: "endpoint_probe",
        ok: goodRes.status === 200,
        detail: `POST ${expectedUrl} → HTTP ${goodRes.status}`,
      });

      const badRes = await fetch(expectedUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ update_id: 0 }),
      });
      checks.push({
        name: "endpoint_secret_guard",
        ok: badRes.status === 401,
        detail: `POST без secret → HTTP ${badRes.status} (ожидается 401)`,
      });
    } catch (err) {
      checks.push({
        name: "endpoint_probe",
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const delivery = checks.find((c) => c.name === "telegram_delivery");
  const probe = checks.find((c) => c.name === "endpoint_probe");
  if (delivery && !delivery.ok && delivery.detail.includes("401") && probe?.ok) {
    checks.push({
      name: "vercel_secret_sync",
      ok: false,
      detail:
        "Telegram → 401, probe с локальным secret → 200: на Vercel другой VENDOR_TELEGRAM_WEBHOOK_SECRET",
    });
  }

  return {
    ok: checks.every((c) => c.ok),
    expected_url: expectedUrl,
    checks,
  };
}
