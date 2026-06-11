import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getTelegramBotToken,
  getTelegramBotUsername,
  getVendorApprovalSecret,
  getVendorApprovalWebhookUrl,
  isTelegramVerifyEnabledAsync,
  isVendorStepUpVerifyRequiredAsync,
  isWebhookVerifyEnabled,
} from "./vendor-admin-config.js";
import { getTelegramChatIdForStaff } from "./vendor-staff.server.js";
import type { PortalUser } from "./portal-auth.js";

export const VENDOR_VERIFY_COOKIE = "fm_vendor_admin_verified";
export const VENDOR_VERIFY_TTL_MS = 8 * 60 * 60 * 1000;
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function signingSecret(): string {
  const secret = process.env.LICENSE_SERVER_ADMIN_SECRET?.trim();
  if (!secret) throw new Error("LICENSE_SERVER_ADMIN_SECRET не задан");
  return secret;
}

export function signVerifySession(userId: string, expiresAtMs: number): string {
  const payload = `${userId}.${expiresAtMs}`;
  const sig = createHmac("sha256", signingSecret())
    .update(`vendor-verify:v1:${payload}`)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyVerifySessionToken(token: string | undefined): string | null {
  if (!token?.includes(".")) return null;
  // Format: `${userId}.${expiresAtMs}.${hmacSig}` — split from the right so UUIDs stay intact.
  const sigSep = token.lastIndexOf(".");
  if (sigSep <= 0) return null;
  const payloadPart = token.slice(0, sigSep);
  const dot = payloadPart.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = payloadPart.slice(0, dot);
  const expiresAt = Number(payloadPart.slice(dot + 1));
  if (!userId || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  const expected = signVerifySession(userId, expiresAt);
  if (!safeEqual(token, expected)) return null;
  return userId;
}

function cookieSecure(): boolean {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

export function setVerifySessionCookie(c: Context, userId: string): void {
  const expiresAt = Date.now() + VENDOR_VERIFY_TTL_MS;
  const token = signVerifySession(userId, expiresAt);
  setCookie(c, VENDOR_VERIFY_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "Lax",
    path: "/",
    maxAge: Math.floor(VENDOR_VERIFY_TTL_MS / 1000),
  });
}

export function clearVerifySessionCookie(c: Context): void {
  deleteCookie(c, VENDOR_VERIFY_COOKIE, { path: "/" });
}

export function hasValidVerifyCookie(c: Context, userId: string): boolean {
  const fromCookie = verifyVerifySessionToken(getCookie(c, VENDOR_VERIFY_COOKIE));
  return fromCookie === userId;
}

function generateChallengeToken(): string {
  return randomBytes(16).toString("hex");
}

export type VerifyStartResult = {
  token: string;
  expires_at: string;
  telegram: {
    enabled: boolean;
    bot_username: string | null;
    deep_link: string | null;
    start_command: string;
  };
  webhook: { enabled: boolean; dispatched: boolean };
};

async function buildVerifyStartResult(
  supabase: SupabaseClient,
  user: PortalUser,
  token: string,
  expiresAt: string,
): Promise<VerifyStartResult> {
  const botUsername = getTelegramBotUsername();
  const startCommand = `vendor_admin_${token}`;
  const telegramEnabled = await isTelegramVerifyEnabledAsync(supabase);
  const deepLink =
    telegramEnabled && botUsername
      ? `https://t.me/${botUsername}?start=${encodeURIComponent(startCommand)}`
      : null;

  let webhookDispatched = false;
  const webhookUrl = getVendorApprovalWebhookUrl();
  const webhookSecret = getVendorApprovalSecret();
  if (webhookUrl && webhookSecret) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Vendor-Admin-Secret": webhookSecret,
        },
        body: JSON.stringify({
          event: "vendor_admin_verify",
          challenge_token: token,
          email: user.email,
          user_id: user.id,
          expires_at: expiresAt,
        }),
      });
      webhookDispatched = res.ok;
    } catch {
      webhookDispatched = false;
    }
  }

  return {
    token,
    expires_at: expiresAt,
    telegram: {
      enabled: telegramEnabled,
      bot_username: botUsername,
      deep_link: deepLink,
      start_command: startCommand,
    },
    webhook: {
      enabled: isWebhookVerifyEnabled(),
      dispatched: webhookDispatched,
    },
  };
}

export async function startVerifyChallenge(
  supabase: SupabaseClient,
  user: PortalUser,
): Promise<VerifyStartResult> {
  const { data: existing } = await supabase
    .from("vendor_admin_verify_challenges")
    .select("token, expires_at")
    .eq("user_id", user.id)
    .is("confirmed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.token) {
    return buildVerifyStartResult(supabase, user, existing.token, existing.expires_at);
  }

  const token = generateChallengeToken();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();

  const { error } = await supabase.from("vendor_admin_verify_challenges").insert({
    token,
    user_id: user.id,
    email: user.email,
    expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);

  return buildVerifyStartResult(supabase, user, token, expiresAt);
}

export async function pollVerifyChallenge(
  supabase: SupabaseClient,
  token: string,
): Promise<"pending" | "confirmed" | "expired" | "invalid"> {
  const { data: row } = await supabase
    .from("vendor_admin_verify_challenges")
    .select("expires_at, confirmed_at")
    .eq("token", token)
    .maybeSingle();

  if (!row) return "invalid";
  if (new Date(row.expires_at) < new Date()) return "expired";
  if (row.confirmed_at) return "confirmed";
  return "pending";
}

export async function confirmVerifyChallenge(
  supabase: SupabaseClient,
  token: string,
  via: "telegram" | "webhook",
  opts?: { chatId?: string; email?: string },
): Promise<{ ok: true; user_id: string } | { ok: false; error: string }> {
  const { data: row } = await supabase
    .from("vendor_admin_verify_challenges")
    .select("id, user_id, email, expires_at, confirmed_at")
    .eq("token", token)
    .maybeSingle();

  if (!row) return { ok: false, error: "Challenge not found" };
  if (row.confirmed_at) return { ok: true, user_id: row.user_id };
  if (new Date(row.expires_at) < new Date()) return { ok: false, error: "Challenge expired" };

  if (via === "telegram") {
    const expectedChat = await getTelegramChatIdForStaff(supabase, row.email);
    const chatId = opts?.chatId?.trim() ?? "";
    if (!expectedChat?.trim() || !chatId || expectedChat.trim() !== chatId) {
      return { ok: false, error: "Telegram not linked for this vendor account" };
    }
  }

  const { error } = await supabase
    .from("vendor_admin_verify_challenges")
    .update({ confirmed_at: new Date().toISOString(), confirmed_via: via })
    .eq("id", row.id);
  if (error) return { ok: false, error: error.message };

  return { ok: true, user_id: row.user_id };
}

export async function handleTelegramVendorAdminStart(
  supabase: SupabaseClient,
  chatId: string,
  payload: string,
): Promise<string> {
  const token = payload.startsWith("vendor_admin_") ? payload.slice("vendor_admin_".length) : payload;
  if (!token) {
    return "❌ Неверный код подтверждения Cloud Admin.";
  }

  const result = await confirmVerifyChallenge(supabase, token, "telegram", { chatId });
  if (!result.ok) {
    if (result.error.includes("not linked")) {
      return "❌ Telegram не привязан к этому vendor-аккаунту. Укажите telegram_chat_id в карточке сотрудника.";
    }
    if (result.error.includes("expired")) {
      return "❌ Код истёк. Запросите новый на странице /admin.";
    }
    return "❌ Код не найден. Запросите новый на странице /admin.";
  }

  return "✅ Cloud Admin подтверждён. Вернитесь в браузер — доступ откроется автоматически.";
}

export async function fetchTelegramBotUsername(): Promise<string | null> {
  const cached = getTelegramBotUsername();
  if (cached) return cached;
  const token = getTelegramBotToken();
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = (await res.json()) as { ok?: boolean; result?: { username?: string } };
    return data.ok ? (data.result?.username ?? null) : null;
  } catch {
    return null;
  }
}

export async function getVerifyMethods(supabase: SupabaseClient) {
  return {
    required: await isVendorStepUpVerifyRequiredAsync(supabase),
    telegram: await isTelegramVerifyEnabledAsync(supabase),
    webhook: isWebhookVerifyEnabled(),
  };
}
