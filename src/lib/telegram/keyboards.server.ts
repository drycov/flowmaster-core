import type { TelegramReplyMarkup } from "./send.server";

/** Тексты кнопок постоянной reply-клавиатуры */
export const MENU = {
  TASKS: "📋 Задачи",
  LEAVE: "🏖 Отпуска",
  DUTY: "🛡 Дежурства",
  PROFILE: "👤 Профиль",
  SETTINGS: "⚙️ Настройки",
  HELP: "❓ Справка",
} as const;

export type NavScreen = "tasks" | "leave" | "duty" | "status" | "settings" | "help" | "main";

const NAV_CALLBACK: Record<NavScreen, string> = {
  tasks: "nav:tasks",
  leave: "nav:leave",
  duty: "nav:duty",
  status: "nav:status",
  settings: "nav:settings",
  help: "nav:help",
  main: "nav:main",
};

/** Постоянное меню внизу чата */
export function mainReplyKeyboard(): TelegramReplyMarkup {
  return {
    keyboard: [
      [{ text: MENU.TASKS }, { text: MENU.LEAVE }],
      [{ text: MENU.DUTY }, { text: MENU.PROFILE }],
      [{ text: MENU.SETTINGS }, { text: MENU.HELP }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

export function isMenuButtonText(text: string): boolean {
  return Object.values(MENU).includes(text as (typeof MENU)[keyof typeof MENU]);
}

export function menuTextToScreen(text: string): NavScreen | null {
  switch (text) {
    case MENU.TASKS:
      return "tasks";
    case MENU.LEAVE:
      return "leave";
    case MENU.DUTY:
      return "duty";
    case MENU.PROFILE:
      return "status";
    case MENU.SETTINGS:
      return "settings";
    case MENU.HELP:
      return "help";
    default:
      return null;
  }
}

function navRow(...screens: NavScreen[]) {
  return screens.map((s) => ({
    text: navButtonLabel(s),
    callback_data: NAV_CALLBACK[s],
  }));
}

function navButtonLabel(screen: NavScreen): string {
  switch (screen) {
    case "tasks":
      return "📋 Задачи";
    case "leave":
      return "🏖 Отпуска";
    case "duty":
      return "🛡 Дежурства";
    case "status":
      return "👤 Профиль";
    case "settings":
      return "⚙️ Настройки";
    case "help":
      return "❓ Справка";
    case "main":
      return "🏠 Меню";
    default:
      return "Меню";
  }
}

/** Быстрая навигация под сообщением */
export function screenInlineKeyboard(
  screen: NavScreen,
  opts?: { origin?: string | null; refresh?: boolean },
): TelegramReplyMarkup {
  const rows: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];

  if (opts?.refresh) {
    rows.push([{ text: "🔄 Обновить", callback_data: NAV_CALLBACK[screen] }]);
  }

  rows.push(navRow("tasks", "leave"));
  rows.push(navRow("duty", "status"));
  rows.push([{ text: "⚙️ Настройки", callback_data: NAV_CALLBACK.settings }]);

  if (opts?.origin) {
    rows.push([{ text: "🌐 Открыть ЕСЭДО", url: opts.origin }]);
  }

  rows.push([{ text: "🏠 Главное меню", callback_data: NAV_CALLBACK.main }]);

  return { inline_keyboard: rows };
}

export function settingsInlineKeyboard(): TelegramReplyMarkup {
  return {
    inline_keyboard: [
      [
        { text: "🔔 Включить уведомления", callback_data: "notif:on" },
        { text: "🔕 Выключить", callback_data: "notif:off" },
      ],
      [{ text: "🔑 Сброс пароля", callback_data: "auth:reset" }],
      [
        { text: "🔓 Отвязать аккаунт", callback_data: "auth:unlink" },
        { text: "🆔 Chat ID", callback_data: "auth:chatid" },
      ],
      [{ text: "🏠 Главное меню", callback_data: NAV_CALLBACK.main }],
    ],
  };
}

export function helpInlineKeyboard(): TelegramReplyMarkup {
  return {
    inline_keyboard: [
      navRow("tasks", "leave"),
      navRow("duty", "status"),
      [{ text: "⚙️ Настройки", callback_data: NAV_CALLBACK.settings }],
      [{ text: "🏠 Главное меню", callback_data: NAV_CALLBACK.main }],
    ],
  };
}

export function pendingActionInlineKeyboard(): TelegramReplyMarkup {
  return {
    inline_keyboard: [[{ text: "↩️ Отмена", callback_data: "action:cancel" }]],
  };
}

export function parseNavCallback(data: string): NavScreen | null {
  if (!data.startsWith("nav:")) return null;
  const screen = data.slice(4) as NavScreen;
  return screen in NAV_CALLBACK ? screen : null;
}
