import { getTelegramBotToken } from "./vendor-admin-config.js";

export async function sendVendorTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const token = getTelegramBotToken();
  if (!token) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
