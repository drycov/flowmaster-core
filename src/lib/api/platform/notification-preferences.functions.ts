import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { upsertRow } from "@/lib/api/db.helpers.server";

const DEFAULT_PREFS = {
  email_enabled: true,
  email_task_assigned: true,
  email_workflow_events: true,
  email_document_returned: true,
  telegram_enabled: true,
  telegram_task_assigned: true,
  telegram_workflow_events: true,
  telegram_document_returned: true,
  email_hr_events: true,
  telegram_hr_events: true,
  telegram_chat_id: null as string | null,
  telegram_username: null as string | null,
  telegram_linked_at: null as string | null,
};

export const getNotificationPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ...DEFAULT_PREFS, ...data };
  });

export const updateNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      email_enabled: z.boolean().optional(),
      email_task_assigned: z.boolean().optional(),
      email_workflow_events: z.boolean().optional(),
      email_document_returned: z.boolean().optional(),
      email_hr_events: z.boolean().optional(),
      telegram_enabled: z.boolean().optional(),
      telegram_task_assigned: z.boolean().optional(),
      telegram_workflow_events: z.boolean().optional(),
      telegram_document_returned: z.boolean().optional(),
      telegram_hr_events: z.boolean().optional(),
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
