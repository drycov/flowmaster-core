import { createHmac } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logger } from "@/lib/logger.server";
import {
  computeNextRetryAt,
  isOutboxExhausted,
  MAX_OUTBOX_ATTEMPTS,
} from "@/lib/outbox/retry.server";

function signPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

type ClaimedWebhookRow = {
  id: string;
  subscription_id: string;
  event: string;
  payload: unknown;
  attempts: number;
  url: string | null;
  secret: string | null;
  is_active: boolean | null;
};

async function releaseStaleClaims() {
  await supabaseAdmin.rpc("release_stale_outbox_claims" as never, { _stale_minutes: 10 } as never);
}

async function claimBatch(limit: number): Promise<ClaimedWebhookRow[]> {
  const { data, error } = await supabaseAdmin.rpc(
    "claim_webhook_outbox_batch" as never,
    { _limit: limit } as never,
  );
  if (error) throw new Error(error.message);
  return (data ?? []) as ClaimedWebhookRow[];
}

export async function dispatchWebhookOutbox(limit = 50) {
  await releaseStaleClaims();
  const rows = await claimBatch(limit);

  let sent = 0;
  let failed = 0;
  let retried = 0;

  for (const row of rows) {
    if (!row.is_active || !row.url) {
      await supabaseAdmin
        .from("webhook_outbox")
        .update({
          status: "failed",
          last_error: "Subscription inactive",
          claimed_at: null,
        } as never)
        .eq("id", row.id);
      failed++;
      continue;
    }

    const body = JSON.stringify({
      event: row.event,
      payload: row.payload,
      timestamp: new Date().toISOString(),
    });

    try {
      const res = await fetch(row.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Flowmaster-Event": row.event,
          "X-Flowmaster-Signature": signPayload(row.secret ?? "", body),
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const attempts = row.attempts + 1;
      await supabaseAdmin
        .from("webhook_outbox")
        .update({
          status: "sent",
          delivered_at: new Date().toISOString(),
          attempts,
          claimed_at: null,
        } as never)
        .eq("id", row.id);
      sent++;
    } catch (e) {
      const attempts = row.attempts + 1;
      const message = e instanceof Error ? e.message : String(e);
      const exhausted = isOutboxExhausted(attempts);

      const failPatch: Record<string, unknown> = {
        status: exhausted ? "failed" : "pending",
        attempts,
        last_error: message,
        claimed_at: null,
      };
      if (!exhausted) failPatch.next_retry_at = computeNextRetryAt(attempts);
      await supabaseAdmin.from("webhook_outbox").update(failPatch as never).eq("id", row.id);

      if (exhausted) failed++;
      else retried++;
    }
  }

  if (rows.length > 0) {
    logger.info("webhook outbox batch processed", {
      processed: rows.length,
      sent,
      failed,
      retried,
      max_attempts: MAX_OUTBOX_ATTEMPTS,
    });
  }

  return { processed: rows.length, sent, failed, retried };
}
