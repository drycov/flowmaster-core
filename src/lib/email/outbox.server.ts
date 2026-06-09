import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail } from "./send.server";

const BATCH_SIZE = 25;

function appOrigin(): string {
  return (process.env.VITE_APP_URL ?? process.env.APP_URL ?? "").replace(/\/$/, "");
}

function buildHtml(baseHtml: string | null, appLink: string | null): string {
  let html = baseHtml ?? "";
  if (appLink?.trim()) {
    const href = appLink.startsWith("http")
      ? appLink
      : `${appOrigin()}${appLink.startsWith("/") ? appLink : `/${appLink}`}`;
    html += `<p style="margin-top:16px"><a href="${href}">Открыть в ЕСЭДО</a></p>`;
  }
  return html;
}

export async function processEmailOutbox() {
  const { data: rows, error } = await supabaseAdmin
    .from("email_outbox")
    .select("id, to_email, subject, body_text, body_html, app_link, attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) throw new Error(error.message);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows ?? []) {
    const result = await sendEmail({
      to: row.to_email,
      subject: row.subject,
      text: row.body_text ?? undefined,
      html: buildHtml(row.body_html, row.app_link),
    });

    if (result.skipped) {
      await supabaseAdmin
        .from("email_outbox")
        .update({
          status: "skipped",
          last_error: result.error ?? "skipped",
          attempts: (row.attempts ?? 0) + 1,
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
          attempts: (row.attempts ?? 0) + 1,
        } as never)
        .eq("id", row.id);
      sent++;
    } else {
      await supabaseAdmin
        .from("email_outbox")
        .update({
          status: (row.attempts ?? 0) >= 2 ? "failed" : "pending",
          last_error: result.error ?? "send failed",
          attempts: (row.attempts ?? 0) + 1,
        } as never)
        .eq("id", row.id);
      failed++;
    }
  }

  return {
    processed: (rows ?? []).length,
    sent,
    failed,
    skipped,
  };
}
