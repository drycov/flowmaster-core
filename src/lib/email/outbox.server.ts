import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveAppOrigin } from "@/lib/app-origin.server";
import { logger } from "@/lib/logger.server";
import {
  computeNextRetryAt,
  isOutboxExhausted,
  MAX_OUTBOX_ATTEMPTS,
} from "@/lib/outbox/retry.server";
import { sendEmail } from "./send.server";

const BATCH_SIZE = 25;

type EmailOutboxRow = {
  id: string;
  to_email: string;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  app_link: string | null;
  attempts: number;
};

function buildHtml(baseHtml: string | null, appLink: string | null, origin: string): string {
  let html = baseHtml ?? "";
  if (appLink?.trim() && origin) {
    const href = appLink.startsWith("http")
      ? appLink
      : `${origin}${appLink.startsWith("/") ? appLink : `/${appLink}`}`;
    html += `<p style="margin-top:16px"><a href="${href}">Открыть в ЕСЭДО</a></p>`;
  }
  return html;
}

async function releaseStaleClaims() {
  await supabaseAdmin.rpc("release_stale_outbox_claims" as never, { _stale_minutes: 10 } as never);
}

async function claimBatch(): Promise<EmailOutboxRow[]> {
  const { data, error } = await supabaseAdmin.rpc(
    "claim_email_outbox_batch" as never,
    { _limit: BATCH_SIZE } as never,
  );
  if (error) throw new Error(error.message);
  return (data ?? []) as EmailOutboxRow[];
}

export async function processEmailOutbox() {
  await releaseStaleClaims();
  const rows = await claimBatch();
  const origin = await resolveAppOrigin();

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let retried = 0;

  for (const row of rows) {
    const result = await sendEmail({
      to: row.to_email,
      subject: row.subject,
      text: row.body_text ?? undefined,
      html: buildHtml(row.body_html, row.app_link, origin),
    });

    const attempts = (row.attempts ?? 0) + 1;

    if (result.skipped) {
      await supabaseAdmin
        .from("email_outbox")
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
        .from("email_outbox")
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
      await supabaseAdmin.from("email_outbox").update(failPatch as never).eq("id", row.id);
      if (exhausted) failed++;
      else retried++;
    }
  }

  if (rows.length > 0) {
    logger.info("email outbox batch processed", {
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
