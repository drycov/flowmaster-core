import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { issueAppSession } from "@/lib/auth/server";
import { loadSystemSettings, validatePassword } from "@/lib/auth/policy";
import { assertUserBelongsToOrganization } from "@/lib/access/tenant-auth.server";
import { callTelegramApi, getTelegramBotInfo } from "./api.server";
import { sendTelegramMessage } from "./send.server";

const LOGIN_TTL_MS = 5 * 60 * 1000;
const RESET_TTL_MS = 15 * 60 * 1000;

export type TelegramAuthPurpose = "login" | "password_reset";

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

async function assertTelegramAuthEnabled(kind: "login" | "reset") {
  const { telegram } = await loadSystemSettings();
  if (!telegram.bot_token) {
    throw new Error("Telegram-бот не настроен");
  }
  if (kind === "login" && telegram.allow_telegram_login === false) {
    throw new Error("Вход через Telegram отключён");
  }
  if (kind === "reset" && telegram.allow_telegram_password_reset === false) {
    throw new Error("Сброс пароля через Telegram отключён");
  }
}

async function findLinkedUserId(chatId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("user_notification_preferences")
    .select("user_id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  return data?.user_id ?? null;
}

export async function createTelegramLoginSession() {
  await assertTelegramAuthEnabled("login");

  const token = generateToken();
  const expiresAt = new Date(Date.now() + LOGIN_TTL_MS).toISOString();

  const { error } = await supabaseAdmin.from("telegram_auth_tokens").insert({
    token,
    purpose: "login",
    expires_at: expiresAt,
  } as never);
  if (error) throw new Error(error.message);

  const botInfo = await getTelegramBotInfo();
  const username = botInfo.result?.username ?? null;
  const deepLink = username ? `https://t.me/${username}?start=login_${token}` : null;

  return {
    token,
    expires_at: expiresAt,
    bot_username: username,
    deep_link: deepLink,
    start_command: `login_${token}`,
  };
}

export async function confirmTelegramLoginFromBot(
  chatId: string,
  username: string | null,
  rawPayload: string,
): Promise<{ ok: boolean; message: string }> {
  const token = rawPayload.startsWith("login_") ? rawPayload.slice(6) : rawPayload;

  const { data: row, error } = await supabaseAdmin
    .from("telegram_auth_tokens")
    .select("id, purpose, expires_at, consumed_at, confirmed_at")
    .eq("token", token)
    .eq("purpose", "login")
    .maybeSingle();

  if (error || !row) {
    return { ok: false, message: "❌ Код входа не найден. Запросите новый на странице входа." };
  }
  if (row.consumed_at) {
    return { ok: false, message: "ℹ️ Этот код входа уже использован." };
  }
  if (new Date(row.expires_at) < new Date()) {
    return { ok: false, message: "❌ Срок действия кода входа истёк. Запросите новый на сайте." };
  }

  const userId = await findLinkedUserId(chatId);
  if (!userId) {
    return {
      ok: false,
      message:
        "❌ Telegram не привязан к аккаунту ЕСЭДО.\nВойдите по email/ЭЦП, затем привяжите бота в Профиле → Telegram.",
    };
  }

  const { error: updErr } = await supabaseAdmin
    .from("telegram_auth_tokens")
    .update({
      user_id: userId,
      chat_id: chatId,
      confirmed_at: new Date().toISOString(),
    } as never)
    .eq("id", row.id);

  if (updErr) {
    return { ok: false, message: "❌ Не удалось подтвердить вход. Попробуйте позже." };
  }

  await supabaseAdmin.from("user_notification_preferences").upsert(
    {
      user_id: userId,
      telegram_chat_id: chatId,
      telegram_username: username,
      telegram_linked_at: new Date().toISOString(),
    } as never,
    { onConflict: "user_id" },
  );

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name_ru, email")
    .eq("id", userId)
    .maybeSingle();

  const name = profile?.full_name_ru || profile?.email || "пользователь";
  return {
    ok: true,
    message: `✅ Вход подтверждён для <b>${name}</b>.\nВернитесь в браузер — сессия откроется автоматически.`,
  };
}

export async function pollTelegramLogin(
  token: string,
  opts?: { organizationId?: string | null },
) {
  const { data: row } = await supabaseAdmin
    .from("telegram_auth_tokens")
    .select("id, user_id, expires_at, confirmed_at, consumed_at")
    .eq("token", token)
    .eq("purpose", "login")
    .maybeSingle();

  if (!row) return { status: "invalid" as const };
  if (row.consumed_at) return { status: "consumed" as const };
  if (new Date(row.expires_at) < new Date()) return { status: "expired" as const };
  if (!row.confirmed_at || !row.user_id) return { status: "pending" as const };

  await assertUserBelongsToOrganization(row.user_id, opts?.organizationId ?? null);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("id", row.user_id)
    .maybeSingle();

  if (!profile?.email) return { status: "invalid" as const };

  const settings = await loadSystemSettings();
  const session = await issueAppSession(
    row.user_id,
    profile.email,
    settings.auth.session_ttl_hours,
  );

  await supabaseAdmin
    .from("telegram_auth_tokens")
    .update({ consumed_at: new Date().toISOString() } as never)
    .eq("id", row.id);

  return { status: "ok" as const, ...session };
}

async function createPasswordResetForUser(userId: string, chatId: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("email, password_hash, auth_method")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.password_hash) {
    throw new Error(
      "Для этого аккаунта не задан пароль. Войдите по ЭЦП или задайте пароль в профиле.",
    );
  }

  const code = generateCode();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();

  await supabaseAdmin.from("telegram_auth_tokens").insert({
    token,
    purpose: "password_reset",
    user_id: userId,
    chat_id: chatId,
    code,
    expires_at: expiresAt,
  } as never);

  await sendTelegramMessage(
    [
      "🔐 <b>Сброс пароля ЕСЭДО</b>",
      "",
      `Код: <b>${code}</b>`,
      "Действителен 15 минут.",
      "",
      "На сайте: страница входа → «Забыли пароль?»",
      "Или в боте: <code>/newpassword КОД НовыйПароль</code>",
    ].join("\n"),
    chatId,
    { requireEnabled: false },
  );

  return { ok: true };
}

export async function requestTelegramPasswordReset(
  email: string,
  opts?: { organizationId?: string | null },
) {
  await assertTelegramAuthEnabled("reset");

  const normalized = email.trim().toLowerCase();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, password_hash")
    .ilike("email", normalized)
    .maybeSingle();

  if (!profile?.id || !profile.password_hash) {
    return { ok: true, sent: false };
  }

  await assertUserBelongsToOrganization(profile.id, opts?.organizationId ?? null);

  const { data: pref } = await supabaseAdmin
    .from("user_notification_preferences")
    .select("telegram_chat_id")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (!pref?.telegram_chat_id) {
    throw new Error(
      "К аккаунту не привязан Telegram. Привяжите бота в профиле после входа другим способом.",
    );
  }

  await createPasswordResetForUser(profile.id, pref.telegram_chat_id);
  return { ok: true, sent: true };
}

export async function requestTelegramPasswordResetFromBot(chatId: string) {
  await assertTelegramAuthEnabled("reset");

  const userId = await findLinkedUserId(chatId);
  if (!userId) {
    return {
      ok: false,
      message: "❌ Чат не привязан к аккаунту. Сначала выполните привязку в профиле ЕСЭДО.",
    };
  }

  try {
    await createPasswordResetForUser(userId, chatId);
    return { ok: true, message: "✅ Код сброса пароля отправлен в этот чат." };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Не удалось создать запрос сброса",
    };
  }
}

export async function confirmTelegramPasswordReset(
  email: string,
  code: string,
  password: string,
  opts?: { organizationId?: string | null },
) {
  await assertTelegramAuthEnabled("reset");

  const authPolicy = (await loadSystemSettings()).auth;
  const pwdErr = validatePassword(password, authPolicy);
  if (pwdErr) throw new Error(pwdErr);

  const normalized = email.trim().toLowerCase();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle();

  if (!profile?.id) throw new Error("Неверный email или код");

  await assertUserBelongsToOrganization(profile.id, opts?.organizationId ?? null);

  const { data: row } = await supabaseAdmin
    .from("telegram_auth_tokens")
    .select("id, expires_at, consumed_at")
    .eq("user_id", profile.id)
    .eq("purpose", "password_reset")
    .eq("code", code.trim())
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row || new Date(row.expires_at) < new Date()) {
    throw new Error("Неверный email или код");
  }

  const { error } = await supabaseAdmin.rpc("change_app_user_password" as never, {
    p_user_id: profile.id,
    p_new_password: password,
  } as never);
  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from("telegram_auth_tokens")
    .update({ consumed_at: new Date().toISOString() } as never)
    .eq("id", row.id);

  return { ok: true };
}

export async function confirmTelegramPasswordResetFromBot(
  chatId: string,
  code: string,
  password: string,
) {
  await assertTelegramAuthEnabled("reset");

  const authPolicy = (await loadSystemSettings()).auth;
  const pwdErr = validatePassword(password, authPolicy);
  if (pwdErr) throw new Error(pwdErr);

  const userId = await findLinkedUserId(chatId);
  if (!userId) throw new Error("Чат не привязан к аккаунту");

  const { data: row } = await supabaseAdmin
    .from("telegram_auth_tokens")
    .select("id, expires_at, consumed_at")
    .eq("user_id", userId)
    .eq("purpose", "password_reset")
    .eq("code", code.trim())
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row || new Date(row.expires_at) < new Date()) {
    throw new Error("Неверный или просроченный код");
  }

  const { error } = await supabaseAdmin.rpc("change_app_user_password" as never, {
    p_user_id: userId,
    p_new_password: password,
  } as never);
  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from("telegram_auth_tokens")
    .update({ consumed_at: new Date().toISOString() } as never)
    .eq("id", row.id);

  return { ok: true };
}

export async function getTelegramBotUsername(): Promise<string | null> {
  const botInfo = await callTelegramApi<{ username?: string }>("getMe");
  return botInfo.result?.username ?? null;
}
