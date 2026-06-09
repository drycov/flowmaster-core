import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveAppOrigin } from "@/lib/app-origin.server";
import { logger } from "@/lib/logger.server";
import {
  computeNextRetryAt,
  isOutboxExhausted,
  MAX_OUTBOX_ATTEMPTS,
} from "@/lib/outbox/retry.server";
import { sendTelegramMessage } from "./send.server";

const BATCH_SIZE = 25;

type TelegramOutboxRow = {
  id: string;
  chat_id: string;
  message_text: string;
  app_link: string | null;
  reply_markup: Record<string, unknown> | null;
  attempts: number;
};

function appendAppLink(text: string, appLink: string | null, origin: string): string {
  if (!appLink?.trim() || !origin) return text;
  const href = appLink.startsWith("http")
    ? appLink
    : `${origin}${appLink.startsWith("/") ? appLink : `/${appLink}`}`;
  return `${text}\n\n<a href="${href}">Открыть в ЕСЭДО</a>`;
}

async function releaseStaleClaims() {
  await supabaseAdmin.rpc("release_stale_outbox_claims" as never, { _stale_minutes: 10 } as never);
}

async function claimBatch(): Promise<TelegramOutboxRow[]> {
  const { data, error } = await supabaseAdmin.rpc(
    "claim_telegram_outbox_batch" as never,
    { _limit: BATCH_SIZE } as never,
  );
  if (error) throw new Error(error.message);
  return (data ?? []) as TelegramOutboxRow[];
}

export async function processTelegramOutbox() {
  await releaseStaleClaims();
  const rows = await claimBatch();
  const origin = await resolveAppOrigin();

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let retried = 0;

  for (const row of rows) {
    const text = appendAppLink(row.message_text, row.app_link, origin);
    const result = await sendTelegramMessage(text, row.chat_id, {
      reply_markup: row.reply_markup ?? undefined,
    });
    const attempts = (row.attempts ?? 0) + 1;

    if (result.skipped) {
      await supabaseAdmin
        .from("telegram_outbox")
        .update({
          status: "skipped",
          last_error: result.error ?? "skipped",
          attempts,
          claimed_at: null,
        } as never)
        .eq("id", row.id);
      skipped++;
      continue;
    }

    if (result.ok) {
      await supabaseAdmin
        .from("telegram_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          last_error: null,
          attempts,
          claimed_at: null,
        } as never)
        .eq("id", row.id);
      sent++;
    } else {
      const exhausted = isOutboxExhausted(attempts);
      const failPatch: Record<string, unknown> = {
        status: exhausted ? "failed" : "pending",
        last_error: result.error ?? "send failed",
        attempts,
        claimed_at: null,
      };
      if (!exhausted) failPatch.next_retry_at = computeNextRetryAt(attempts);
      await supabaseAdmin
        .from("telegram_outbox")
        .update(failPatch as never)
        .eq("id", row.id);
      if (exhausted) failed++;
      else retried++;
    }
  }

  if (rows.length > 0) {
    logger.info("telegram outbox batch processed", {
      processed: rows.length,
      sent,
      failed,
      skipped,
      retried,
      max_attempts: MAX_OUTBOX_ATTEMPTS,
    });
  }

  return {
    processed: rows.length,
    sent,
    failed,
    skipped,
    retried,
  };
}
