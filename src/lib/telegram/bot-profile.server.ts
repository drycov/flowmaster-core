import { callTelegramApi } from "./api.server";

const BOT_DESCRIPTION = [
  "Официальный бот ЕСЭДО — системы электронного документооборота.",
  "",
  "• Уведомления о задачах и согласованиях",
  "• Заявки на отпуск и дежурства",
  "• Быстрый доступ к активным согласованиям",
  "",
  "Привязка аккаунта: ЕСЭДО → Профиль → Telegram → «Подключить», затем откройте ссылку или введите /start с кодом.",
  "",
  "Основное управление — кнопками меню внизу чата.",
].join("\n");

const BOT_SHORT_DESCRIPTION =
  "Уведомления и быстрый доступ к задачам ЕСЭДО: согласования, отпуска, дежурства.";

const BOT_COMMANDS = [
  { command: "start", description: "Главное меню или привязка аккаунта" },
  { command: "newpassword", description: "Установить новый пароль после сброса" },
] as const;

export async function syncTelegramBotProfile(): Promise<{ ok: boolean; error?: string }> {
  const [description, shortDescription, commands] = await Promise.all([
    callTelegramApi("setMyDescription", { description: BOT_DESCRIPTION, language_code: "ru" }),
    callTelegramApi("setMyShortDescription", {
      short_description: BOT_SHORT_DESCRIPTION,
      language_code: "ru",
    }),
    callTelegramApi("setMyCommands", {
      commands: BOT_COMMANDS.map((c) => ({ command: c.command, description: c.description })),
      language_code: "ru",
    }),
  ]);

  const failed = [description, shortDescription, commands].find((r) => !r.ok);
  if (failed) {
    return { ok: false, error: failed.description ?? "Не удалось обновить профиль бота" };
  }

  return { ok: true };
}

export function getTelegramBotProfileTexts() {
  return {
    description: BOT_DESCRIPTION,
    short_description: BOT_SHORT_DESCRIPTION,
    commands: BOT_COMMANDS,
  };
}
