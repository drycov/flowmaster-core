/** Comma-separated vendor staff emails allowed into Cloud Admin (/admin). */
export function getVendorAdminAllowlist(): Set<string> {
  const raw = process.env.LICENSE_SERVER_VENDOR_ADMIN_EMAILS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isVendorAdminUiConfigured(): boolean {
  return getVendorAdminAllowlist().size > 0;
}

export function getVendorTelegramChatByEmail(): Map<string, string> {
  const raw = process.env.LICENSE_SERVER_VENDOR_ADMIN_TELEGRAM_CHATS?.trim();
  const map = new Map<string, string>();
  if (!raw) return map;
  for (const part of raw.split(",")) {
    const [email, chatId] = part.split(":").map((s) => s.trim());
    if (email && chatId) map.set(email.toLowerCase(), chatId);
  }
  return map;
}

/** Vendor's dedicated Telegram bot (Cloud Admin verify only — not EDMS client bot). */
export function getTelegramBotToken(): string | null {
  return (
    process.env.VENDOR_TELEGRAM_BOT_TOKEN?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    null
  );
}

export function getTelegramBotUsername(): string | null {
  const raw =
    process.env.VENDOR_TELEGRAM_BOT_USERNAME?.trim() ||
    process.env.TELEGRAM_BOT_USERNAME?.trim() ||
    "";
  return raw ? raw.replace(/^@/, "") : null;
}

export function getTelegramWebhookSecret(): string | null {
  return (
    process.env.VENDOR_TELEGRAM_WEBHOOK_SECRET?.trim() ||
    process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ||
    null
  );
}

export function getVendorApprovalWebhookUrl(): string | null {
  return process.env.LICENSE_SERVER_VENDOR_ADMIN_APPROVAL_WEBHOOK_URL?.trim() || null;
}

export function getVendorApprovalSecret(): string | null {
  return process.env.LICENSE_SERVER_VENDOR_ADMIN_APPROVAL_SECRET?.trim() || null;
}

export function isTelegramVerifyEnabled(): boolean {
  const token = getTelegramBotToken();
  if (!token) return false;
  return getVendorTelegramChatByEmail().size > 0;
}

export function isWebhookVerifyEnabled(): boolean {
  return Boolean(getVendorApprovalWebhookUrl() && getVendorApprovalSecret());
}

/** Step-up verify required when Telegram or approval webhook is configured. */
export function isVendorStepUpVerifyRequired(): boolean {
  return isTelegramVerifyEnabled() || isWebhookVerifyEnabled();
}

export function getVerifySigningSecret(): string | null {
  return process.env.LICENSE_SERVER_ADMIN_SECRET?.trim() || null;
}
