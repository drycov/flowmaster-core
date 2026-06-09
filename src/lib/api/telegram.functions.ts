import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireSystemSettingsAccess } from "@/lib/api/_helpers";
import { upsertRow } from "@/lib/api/db.helpers.server";
import { createTelegramLinkToken } from "@/lib/telegram/bot.server";
import {
  deleteTelegramWebhook,
  registerTelegramWebhook,
  telegramWebhookUrl,
} from "@/lib/telegram/api.server";

const EMPTY_TELEGRAM_LINK_STATUS = {
  linked: false,
  chat_id: null as string | null,
  username: null as string | null,
  enabled: true,
  linked_at: null as string | null,
};

export const getTelegramLinkStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_notification_preferences")
      .select(
        "telegram_chat_id, telegram_username, telegram_enabled, telegram_linked_at",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("telegram_chat_id") ||
        msg.includes("user_notification_preferences") ||
        msg.includes("does not exist")
      ) {
        return EMPTY_TELEGRAM_LINK_STATUS;
      }
      throw new Error(error.message);
    }

    return {
      linked: !!data?.telegram_chat_id,
      chat_id: data?.telegram_chat_id ?? null,
      username: data?.telegram_username ?? null,
      enabled: data?.telegram_enabled !== false,
      linked_at: data?.telegram_linked_at ?? null,
    };
  });

export const createTelegramLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const result = await createTelegramLinkToken(context.userId);
    const { getTelegramDeliveryMode, pollTelegramUpdatesOnce } = await import(
      "@/lib/telegram/polling.server",
    );
    if ((await getTelegramDeliveryMode()) === "polling") {
      void pollTelegramUpdatesOnce(0);
    }
    return result;
  });

export const unlinkTelegramAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await upsertRow({
      supabase,
      table: "user_notification_preferences",
      row: {
        user_id: userId,
        telegram_chat_id: null,
        telegram_username: null,
        telegram_linked_at: null,
      },
      onConflict: "user_id",
    });
    return { ok: true };
  });

export const registerTelegramWebhookFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSystemSettingsAccess(context.supabase, context.userId);
    const result = await registerTelegramWebhook();
    if (!result.ok) throw new Error(result.error ?? "Не удалось зарегистрировать webhook");
    return {
      ok: true,
      webhook_url: result.webhook_url,
      has_secret: !!result.webhook_secret,
    };
  });

export const deleteTelegramWebhookFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSystemSettingsAccess(context.supabase, context.userId);
    const result = await deleteTelegramWebhook();
    if (!result.ok) throw new Error(result.error ?? "Не удалось удалить webhook");
    return { ok: true };
  });

export const getTelegramWebhookInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSystemSettingsAccess(context.supabase, context.userId);
    const { ensureTelegramPolling, getTelegramDeliveryMode } = await import(
      "@/lib/telegram/polling.server",
    );
    const mode = await getTelegramDeliveryMode();
    if (mode === "polling") void ensureTelegramPolling();
    return {
      webhook_url: await telegramWebhookUrl(),
      mode,
      polling_active: mode === "polling",
    };
  });

export const updateTelegramNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      telegram_enabled: z.boolean().optional(),
      telegram_task_assigned: z.boolean().optional(),
      telegram_workflow_events: z.boolean().optional(),
      telegram_document_returned: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await upsertRow({
      supabase,
      table: "user_notification_preferences",
      row: { user_id: userId, ...data },
      onConflict: "user_id",
    });
    return { ok: true };
  });
