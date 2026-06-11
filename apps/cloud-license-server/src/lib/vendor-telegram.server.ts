import { getTelegramBotToken } from "./vendor-admin-config.js";

export type VendorTelegramSendResult = { ok: true } | { ok: false; status: number; body: string };

export async function sendVendorTelegramMessage(
  chatId: string,
  text: string,
): Promise<VendorTelegramSendResult> {
  const token = getTelegramBotToken();
  if (!token) {
    console.error("[vendor-telegram] VENDOR_TELEGRAM_BOT_TOKEN not set");
    return { ok: false, status: 0, body: "no token" };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[vendor-telegram] sendMessage failed", { chatId, status: res.status, body });
      return { ok: false, status: res.status, body };
    }
    return { ok: true };
  } catch (err) {
    const body = err instanceof Error ? err.message : String(err);
    console.error("[vendor-telegram] sendMessage error", { chatId, body });
    return { ok: false, status: 0, body };
  }
}
