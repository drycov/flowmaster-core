import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callTelegramApi, type TelegramUpdate } from "./api.server";
import {
  confirmTelegramLoginFromBot,
  confirmTelegramPasswordResetFromBot,
  requestTelegramPasswordResetFromBot,
} from "./auth.server";
import {
  answerTelegramCallback,
  cancelPendingActionFromChat,
  completeLeaveDecisionFromChat,
  editTelegramMessage,
  handleLeaveApprovalCallback,
} from "./commands.server";
import {
  helpInlineKeyboard,
  mainReplyKeyboard,
  menuTextToScreen,
  parseNavCallback,
  pendingActionInlineKeyboard,
  settingsInlineKeyboard,
  type NavScreen,
} from "./keyboards.server";
import { sendScreen, toggleNotifications } from "./screens.server";
import { sendTelegramMessage } from "./send.server";
import { claimTelegramUpdate } from "./update-dedup.server";

const LINK_TOKEN_TTL_HOURS = 24;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function reply(
  chatId: string,
  text: string,
  opts?: {
    reply_markup?: ReturnType<typeof mainReplyKeyboard>;
    inline_markup?: ReturnType<typeof helpInlineKeyboard>;
    remove_keyboard?: boolean;
  },
) {
  const markup = opts?.inline_markup ?? opts?.reply_markup;
  return sendTelegramMessage(text, chatId, {
    requireEnabled: false,
    reply_markup: opts?.remove_keyboard ? { remove_keyboard: true } : markup,
  });
}

async function handleStartPlain(chatId: string, username: string | null) {
  await sendScreen(chatId, "main", username);
}

function normalizeLinkToken(raw: string): string {
  return raw.trim().toLowerCase();
}

async function handleStartWithToken(
  chatId: string,
  username: string | null,
  rawToken: string,
) {
  const token = normalizeLinkToken(rawToken);

  const { data: row, error } = await supabaseAdmin
    .from("telegram_link_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("[telegram] link token lookup failed:", error.message);
    const hint = error.message.toLowerCase().includes("does not exist")
      ? "❌ Таблица привязки не создана. Примените миграции Supabase."
      : "❌ Ошибка проверки кода привязки. Попробуйте позже.";
    await reply(chatId, hint, { reply_markup: mainReplyKeyboard() });
    return;
  }

  if (!row) {
    await reply(
      chatId,
      "❌ Код привязки не найден или устарел.\nСгенерируйте новый код в профиле ЕСЭДО → Telegram → «Подключить».",
      { reply_markup: mainReplyKeyboard() },
    );
    return;
  }

  if (row.used_at) {
    await reply(chatId, "ℹ️ Этот код уже был использован. Запросите новый в профиле.", {
      reply_markup: mainReplyKeyboard(),
    });
    return;
  }

  if (new Date(row.expires_at) < new Date()) {
    await reply(chatId, "❌ Срок действия кода истёк. Сгенерируйте новый в профиле ЕСЭДО.", {
      reply_markup: mainReplyKeyboard(),
    });
    return;
  }

  const { error: prefErr } = await supabaseAdmin.from("user_notification_preferences").upsert(
    {
      user_id: row.user_id,
      telegram_chat_id: chatId,
      telegram_username: username,
      telegram_enabled: true,
      telegram_linked_at: new Date().toISOString(),
    } as never,
    { onConflict: "user_id" },
  );

  if (prefErr) {
    await reply(chatId, "❌ Не удалось привязать аккаунт. Попробуйте позже.", {
      reply_markup: mainReplyKeyboard(),
    });
    return;
  }

  await supabaseAdmin
    .from("telegram_link_tokens")
    .update({ used_at: new Date().toISOString() } as never)
    .eq("id", row.id);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name_ru, email")
    .eq("id", row.user_id)
    .maybeSingle();

  const name = profile?.full_name_ru || profile?.email || "пользователь";
  await reply(
    chatId,
    `✅ Аккаунт <b>${escapeHtml(name)}</b> успешно привязан.\n\nУведомления включены. Настройте типы в разделе «⚙️ Настройки».`,
    { reply_markup: mainReplyKeyboard() },
  );
}

async function handleUnlink(chatId: string) {
  const { data: pref } = await supabaseAdmin
    .from("user_notification_preferences")
    .select("user_id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (!pref?.user_id) {
    await reply(chatId, "ℹ️ Этот чат не привязан к аккаунту ЕСЭДО.", {
      reply_markup: mainReplyKeyboard(),
    });
    return;
  }

  await supabaseAdmin
    .from("user_notification_preferences")
    .update({
      telegram_chat_id: null,
      telegram_username: null,
      telegram_linked_at: null,
    } as never)
    .eq("user_id", pref.user_id);

  await reply(chatId, "🔓 Привязка отменена. Уведомления в этот чат больше не приходят.", {
    remove_keyboard: true,
  });
}

async function dispatchNavScreen(chatId: string, screen: NavScreen, username?: string | null) {
  await sendScreen(chatId, screen, username);
}

async function dispatchLegacyCommand(
  chatId: string,
  username: string | null,
  text: string,
): Promise<boolean> {
  const [command, ...args] = text.split(/\s+/);
  const cmd = command.split("@")[0]?.toLowerCase();

  if (cmd === "/start") {
    const payload = args[0]?.trim();
    if (payload?.startsWith("login_")) {
      const result = await confirmTelegramLoginFromBot(chatId, username, payload);
      await reply(chatId, result.message, {
        reply_markup: result.ok ? mainReplyKeyboard() : undefined,
        inline_markup: result.ok ? helpInlineKeyboard() : undefined,
      });
      return true;
    }
    if (payload) {
      await handleStartWithToken(chatId, username, payload);
    } else {
      await handleStartPlain(chatId, username);
    }
    return true;
  }

  if (cmd === "/newpassword" && args.length >= 2) {
    const code = args[0] ?? "";
    const password = args.slice(1).join(" ");
    try {
      await confirmTelegramPasswordResetFromBot(chatId, code, password);
      await reply(chatId, "✅ Пароль успешно изменён. Войдите на сайте с новым паролем.", {
        reply_markup: mainReplyKeyboard(),
      });
    } catch (e) {
      await reply(
        chatId,
        `❌ ${e instanceof Error ? e.message : "Не удалось сменить пароль"}`,
        { reply_markup: mainReplyKeyboard() },
      );
    }
    return true;
  }

  return false;
}

async function handleCallbackQuery(update: TelegramUpdate) {
  const cq = update.callback_query;
  if (!cq?.data || !cq.id) return;

  const chatId = cq.message?.chat?.id ? String(cq.message.chat.id) : null;
  const username = cq.from?.username ?? null;
  if (!chatId) {
    await answerTelegramCallback(cq.id);
    return;
  }

  const data = cq.data;

  const navScreen = parseNavCallback(data);
  if (navScreen) {
    await answerTelegramCallback(cq.id);
    await dispatchNavScreen(chatId, navScreen, username);
    return;
  }

  if (data === "notif:on" || data === "notif:off") {
    const enabled = data === "notif:on";
    const message = await toggleNotifications(chatId, enabled);
    await answerTelegramCallback(cq.id, enabled ? "Уведомления включены" : "Уведомления выключены");
    await reply(chatId, message, { inline_markup: settingsInlineKeyboard() });
    return;
  }

  if (data === "auth:reset") {
    const result = await requestTelegramPasswordResetFromBot(chatId);
    await answerTelegramCallback(cq.id);
    await reply(chatId, result.message, { inline_markup: settingsInlineKeyboard() });
    return;
  }

  if (data === "auth:unlink") {
    await answerTelegramCallback(cq.id, "Отвязка…");
    await handleUnlink(chatId);
    return;
  }

  if (data === "auth:chatid") {
    await answerTelegramCallback(cq.id);
    await reply(chatId, `🆔 Chat ID: <code>${escapeHtml(chatId)}</code>`, {
      inline_markup: helpInlineKeyboard(),
      reply_markup: mainReplyKeyboard(),
    });
    return;
  }

  if (data === "action:cancel") {
    const cancelled = await cancelPendingActionFromChat(chatId);
    await answerTelegramCallback(cq.id, cancelled ? "Отменено" : "Нет активного действия");
    if (cancelled) {
      await reply(chatId, "↩️ Действие отменено.", {
        inline_markup: helpInlineKeyboard(),
        reply_markup: mainReplyKeyboard(),
      });
    }
    return;
  }

  if (data.startsWith("leave:")) {
    const result = await handleLeaveApprovalCallback(
      cq.id,
      chatId,
      cq.message?.message_id,
      data,
    );
    await answerTelegramCallback(
      cq.id,
      result.awaitingComment ? "Введите комментарий" : undefined,
    );
    if (cq.message?.message_id) {
      if (result.awaitingComment) {
        await editTelegramMessage(
          chatId,
          cq.message.message_id,
          result.message,
          pendingActionInlineKeyboard(),
        );
      } else {
        await editTelegramMessage(chatId, cq.message.message_id, result.message);
      }
    } else {
      await reply(chatId, result.message, {
        inline_markup: helpInlineKeyboard(),
        reply_markup: mainReplyKeyboard(),
      });
    }
    return;
  }

  await answerTelegramCallback(cq.id, "Неизвестное действие");
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
  if (await claimTelegramUpdate(update)) return;

  if (update.callback_query) {
    await handleCallbackQuery(update);
    return;
  }

  const message = update.message;
  if (!message?.text) return;

  const chatId = String(message.chat.id);
  const text = message.text.trim();
  const username = message.from?.username ?? null;

  const pendingLeave = await completeLeaveDecisionFromChat(chatId, text);
  if (pendingLeave.handled) {
    await reply(chatId, pendingLeave.message, {
      inline_markup: helpInlineKeyboard(),
      reply_markup: mainReplyKeyboard(),
    });
    return;
  }

  const menuScreen = menuTextToScreen(text);
  if (menuScreen) {
    await dispatchNavScreen(chatId, menuScreen, username);
    return;
  }

  if (await dispatchLegacyCommand(chatId, username, text)) {
    return;
  }

  await reply(chatId, "Выберите действие кнопками меню внизу или под этим сообщением.", {
    inline_markup: helpInlineKeyboard(),
  });
}

export async function createTelegramLinkToken(userId: string): Promise<{
  token: string;
  expires_at: string;
  bot_username: string | null;
  deep_link: string | null;
}> {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile) {
    throw new Error("Профиль пользователя не найден. Выйдите и войдите снова.");
  }

  const token = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { error: cleanupError } = await supabaseAdmin
    .from("telegram_link_tokens")
    .delete()
    .eq("user_id", userId)
    .is("used_at", null);

  if (cleanupError) {
    const msg = cleanupError.message.toLowerCase();
    if (msg.includes("does not exist") || msg.includes("telegram_link_tokens")) {
      throw new Error(
        "Таблица telegram_link_tokens не найдена. Примените миграцию 20260611240000_telegram_notifications.sql",
      );
    }
    throw new Error(cleanupError.message);
  }

  const { error: insertError } = await supabaseAdmin.from("telegram_link_tokens").insert({
    user_id: userId,
    token,
    expires_at: expiresAt,
  } as never);

  if (insertError) {
    const msg = insertError.message;
    if (msg.includes("does not exist")) {
      throw new Error("Не удалось сохранить код привязки. Примените миграцию telegram_notifications.");
    }
    if (msg.includes("telegram_link_tokens_user_id_fkey")) {
      throw new Error(
        "Ошибка привязки к профилю. Примените миграцию 20260611254000_telegram_fk_profiles_fix.sql в Supabase.",
      );
    }
    throw new Error(`Не удалось создать код привязки: ${msg}`);
  }

  const botInfo = await callTelegramApi<{ username?: string }>("getMe");
  const botUsername = botInfo.result?.username ?? null;
  const deepLink = botUsername ? `https://t.me/${botUsername}?start=${token}` : null;

  return { token, expires_at: expiresAt, bot_username: botUsername, deep_link: deepLink };
}
