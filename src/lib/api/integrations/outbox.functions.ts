import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSystemSettingsAccess } from "../_helpers";

export type OutboxChannel = "email" | "telegram" | "webhook";

export type FailedDeliveryRow = {
  id: string;
  channel: OutboxChannel;
  destination: string;
  subject: string | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
};

export type OutboxStats = {
  email_pending: number;
  email_failed: number;
  telegram_pending: number;
  telegram_failed: number;
  webhook_pending: number;
  webhook_failed: number;
};

async function countOutbox(
  table: "email_outbox" | "telegram_outbox" | "webhook_outbox",
  status: string,
): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("status", status);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export const getOutboxStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSystemSettingsAccess(context.supabase, context.userId);

    const [
      email_pending,
      email_failed,
      telegram_pending,
      telegram_failed,
      webhook_pending,
      webhook_failed,
    ] = await Promise.all([
      countOutbox("email_outbox", "pending"),
      countOutbox("email_outbox", "failed"),
      countOutbox("telegram_outbox", "pending"),
      countOutbox("telegram_outbox", "failed"),
      countOutbox("webhook_outbox", "pending"),
      countOutbox("webhook_outbox", "failed"),
    ]);

    return {
      email_pending,
      email_failed,
      telegram_pending,
      telegram_failed,
      webhook_pending,
      webhook_failed,
    } satisfies OutboxStats;
  });

export const listFailedDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSystemSettingsAccess(context.supabase, context.userId);

    const limit = 50;

    const [emailRes, telegramRes, webhookRes] = await Promise.all([
      supabaseAdmin
        .from("email_outbox")
        .select("id, to_email, subject, attempts, last_error, created_at")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(limit),
      supabaseAdmin
        .from("telegram_outbox")
        .select("id, chat_id, message_text, attempts, last_error, created_at")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(limit),
      supabaseAdmin
        .from("webhook_outbox")
        .select("id, event, attempts, last_error, created_at, webhook_subscriptions(url)")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);

    if (emailRes.error) throw new Error(emailRes.error.message);
    if (telegramRes.error) throw new Error(telegramRes.error.message);
    if (webhookRes.error) throw new Error(webhookRes.error.message);

    const rows: FailedDeliveryRow[] = [];

    for (const row of emailRes.data ?? []) {
      rows.push({
        id: row.id as string,
        channel: "email",
        destination: row.to_email as string,
        subject: row.subject as string,
        attempts: row.attempts as number,
        last_error: row.last_error as string | null,
        created_at: row.created_at as string,
      });
    }

    for (const row of telegramRes.data ?? []) {
      const text = row.message_text as string;
      rows.push({
        id: row.id as string,
        channel: "telegram",
        destination: row.chat_id as string,
        subject: text.length > 80 ? `${text.slice(0, 80)}…` : text,
        attempts: row.attempts as number,
        last_error: row.last_error as string | null,
        created_at: row.created_at as string,
      });
    }

    for (const row of webhookRes.data ?? []) {
      const sub = Array.isArray(row.webhook_subscriptions)
        ? row.webhook_subscriptions[0]
        : row.webhook_subscriptions;
      rows.push({
        id: row.id as string,
        channel: "webhook",
        destination: (sub as { url?: string } | null)?.url ?? "—",
        subject: row.event as string,
        attempts: row.attempts as number,
        last_error: row.last_error as string | null,
        created_at: row.created_at as string,
      });
    }

    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return rows.slice(0, limit);
  });

export const retryFailedDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      channel: z.enum(["email", "telegram", "webhook"]),
      id: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireSystemSettingsAccess(context.supabase, context.userId);

    const table =
      data.channel === "email"
        ? "email_outbox"
        : data.channel === "telegram"
          ? "telegram_outbox"
          : "webhook_outbox";

    const { error } = await supabaseAdmin
      .from(table)
      .update({
        status: "pending",
        attempts: 0,
        last_error: null,
        next_retry_at: new Date().toISOString(),
        claimed_at: null,
      } as never)
      .eq("id", data.id)
      .eq("status", "failed");

    if (error) throw new Error(error.message);
    return { ok: true };
  });
