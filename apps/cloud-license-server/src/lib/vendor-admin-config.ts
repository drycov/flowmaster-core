/** Comma-separated bootstrap emails (legacy). Auto-provision vendor_staff on first login. */
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
  return isVendorAdminUiConfiguredSync();
}

/**
 * Привязка email сотрудника → Telegram chat id.
 * Env: LICENSE_SERVER_VENDOR_ADMIN_TELEGRAM_CHATS=email@domain.tld:123456789[,email2@...:...]
 * Используется для bootstrap owner, step-up verify и отправки пароля в DM.
 */
export function getVendorTelegramChatByEmail(): Map<string, string> {
  const raw = process.env.LICENSE_SERVER_VENDOR_ADMIN_TELEGRAM_CHATS?.trim();
  const map = new Map<string, string>();
  if (!raw) return map;
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

export function isVendorAdminUiConfiguredSync(): boolean {
  return getVendorAdminAllowlist().size > 0;
}

export function isTelegramVerifyEnabledSync(): boolean {
  const token = getTelegramBotToken();
  if (!token) return false;
  return getVendorTelegramChatByEmail().size > 0;
}

export async function isTelegramVerifyEnabledAsync(supabase: import("@supabase/supabase-js").SupabaseClient): Promise<boolean> {
  const token = getTelegramBotToken();
  if (!token) return false;
  const { hasAnyStaffTelegramLinked } = await import("./vendor-staff.server.js");
  return hasAnyStaffTelegramLinked(supabase);
}

export function isWebhookVerifyEnabled(): boolean {
  return Boolean(getVendorApprovalWebhookUrl() && getVendorApprovalSecret());
}

export async function isVendorStepUpVerifyRequiredAsync(
  supabase: import("@supabase/supabase-js").SupabaseClient,
): Promise<boolean> {
  return (await isTelegramVerifyEnabledAsync(supabase)) || isWebhookVerifyEnabled();
}

/** @deprecated use isVendorStepUpVerifyRequiredAsync */
export function isVendorStepUpVerifyRequired(): boolean {
  return isTelegramVerifyEnabledSync() || isWebhookVerifyEnabled();
}

export function isTelegramVerifyEnabled(): boolean {
  return isTelegramVerifyEnabledSync();
}

export function getVerifySigningSecret(): string | null {
  return process.env.LICENSE_SERVER_ADMIN_SECRET?.trim() || null;
}
