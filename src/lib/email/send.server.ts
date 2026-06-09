export interface SendEmailInput {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface SendEmailResult {
  ok: boolean;
  skipped?: boolean;
  providerId?: string;
  error?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "ЕСЭДО <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not configured — skip send to", input.to);
    return { ok: false, skipped: true, error: "RESEND_API_KEY not configured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text ?? undefined,
      html: input.html ?? undefined,
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as { id?: string; message?: string };

  if (!res.ok) {
    return {
      ok: false,
      error: payload.message ?? `Resend HTTP ${res.status}`,
    };
  }

  return { ok: true, providerId: payload.id };
}
