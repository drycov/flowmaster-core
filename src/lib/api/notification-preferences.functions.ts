import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_PREFS = {
  email_enabled: true,
  email_task_assigned: true,
  email_workflow_events: true,
  email_document_returned: true,
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
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("user_notification_preferences").upsert({
      user_id: userId,
      ...data,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
