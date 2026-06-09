export const DEFAULT_TELEGRAM_LINK_STATUS = {
  linked: false,
  chat_id: null as string | null,
  username: null as string | null,
  enabled: true,
  linked_at: null as string | null,
};

export const DEFAULT_NOTIFICATION_PREFS = {
  email_enabled: true,
  email_task_assigned: true,
  email_workflow_events: true,
  email_document_returned: true,
  email_hr_events: true,
  telegram_enabled: true,
  telegram_task_assigned: true,
  telegram_workflow_events: true,
  telegram_document_returned: true,
  telegram_hr_events: true,
};

export function isTelegramProfileAvailable(
  config?: {
    telegram_bot_configured?: boolean;
    telegram_notifications_enabled?: boolean;
    allow_telegram_login?: boolean;
    allow_telegram_password_reset?: boolean;
  } | null,
) {
  if (!config?.telegram_bot_configured) return false;
  return (
    !!config.telegram_notifications_enabled ||
    !!config.allow_telegram_login ||
    !!config.allow_telegram_password_reset
  );
}
