import { resolveAppOrigin } from "@/lib/app-origin.server";
import {
  buildAccountStatusForChat,
  listMyDutyForChat,
  listMyLeaveForChat,
  listPendingTasksForChat,
  setTelegramNotificationsForChat,
} from "./commands.server";
import {
  helpInlineKeyboard,
  mainReplyKeyboard,
  screenInlineKeyboard,
  settingsInlineKeyboard,
  type NavScreen,
} from "./keyboards.server";
import { sendTelegramMessage, type TelegramReplyMarkup } from "./send.server";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export type ScreenReply = {
  text: string;
  markup: TelegramReplyMarkup;
};

export async function buildWelcomeText(chatId: string, username: string | null): Promise<string> {
  const lines = [
    "👋 <b>ЕСЭДО — бот уведомлений</b>",
    "",
    "Используйте кнопки меню внизу или под сообщениями.",
    "",
    "Привязка аккаунта: ЕСЭДО → Профиль → Telegram → «Подключить».",
    "",
    `🆔 Chat ID: <code>${escapeHtml(chatId)}</code>`,
    username ? `👤 @${escapeHtml(username)}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export async function buildHelpText(): Promise<string> {
  return [
    "<b>❓ Справка</b>",
    "",
    "• <b>Задачи</b> — активные согласования",
    "• <b>Отпуска</b> — баланс и ближайшие заявки",
    "• <b>Дежурства</b> — ваш график",
    "• <b>Профиль</b> — привязка и уведомления",
    "• <b>Настройки</b> — вкл/выкл уведомления, сброс пароля, отвязка",
    "",
    "По заявкам на отпуск в уведомлениях: кнопки «Согласовать / Отклонить», затем комментарий (или <code>—</code>).",
    "Отмена ввода комментария: кнопка «↩️ Отмена» под сообщением.",
  ].join("\n");
}

async function originUrl(): Promise<string | null> {
  const origin = await resolveAppOrigin();
  return origin || null;
}

export async function renderScreen(chatId: string, screen: NavScreen): Promise<ScreenReply> {
  const origin = await originUrl();

  switch (screen) {
    case "tasks": {
      const text = await listPendingTasksForChat(chatId);
      return {
        text,
        markup: screenInlineKeyboard("tasks", { origin, refresh: true }),
      };
    }
    case "leave": {
      const text = await listMyLeaveForChat(chatId);
      return {
        text,
        markup: screenInlineKeyboard("leave", { origin, refresh: true }),
      };
    }
    case "duty": {
      const text = await listMyDutyForChat(chatId);
      return {
        text,
        markup: screenInlineKeyboard("duty", { origin, refresh: true }),
      };
    }
    case "status": {
      const text = await buildAccountStatusForChat(chatId);
      return {
        text,
        markup: screenInlineKeyboard("status", { refresh: true }),
      };
    }
    case "settings": {
      const text = [
        "<b>⚙️ Настройки</b>",
        "",
        "Уведомления, сброс пароля и отвязка аккаунта — кнопками ниже.",
      ].join("\n");
      return {
        text,
        markup: settingsInlineKeyboard(),
      };
    }
    case "help": {
      return {
        text: await buildHelpText(),
        markup: helpInlineKeyboard(),
      };
    }
    case "main":
    default: {
      return {
        text: await buildWelcomeText(chatId, null),
        markup: mainReplyKeyboard(),
      };
    }
  }
}

export async function sendScreen(chatId: string, screen: NavScreen, username?: string | null) {
  let payload = await renderScreen(chatId, screen);
  if (screen === "main" && username !== undefined) {
    payload = {
      ...payload,
      text: await buildWelcomeText(chatId, username),
    };
  }

  return sendTelegramMessage(payload.text, chatId, {
    requireEnabled: false,
    reply_markup: payload.markup,
  });
}

export async function toggleNotifications(chatId: string, enabled: boolean): Promise<string> {
  return setTelegramNotificationsForChat(chatId, enabled);
}
