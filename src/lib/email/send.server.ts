import nodemailer from "nodemailer";
import { resolveMailConfig } from "./config.server";

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

async function sendViaResend(
  apiKey: string,
  from: string,
  input: SendEmailInput,
): Promise<SendEmailResult> {
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
    return { ok: false, error: payload.message ?? `Resend HTTP ${res.status}` };
  }
  return { ok: true, providerId: payload.id };
}

async function sendViaSmtp(
  smtp: NonNullable<Awaited<ReturnType<typeof resolveMailConfig>>["smtp"]>,
  from: string,
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.password },
  });

  try {
    const info = await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { ok: true, providerId: info.messageId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const config = await resolveMailConfig();

  if (!config.enabled) {
    console.warn("[email] Mail not configured — skip send to", input.to);
    return { ok: false, skipped: true, error: "Почтовый сервер не настроен" };
  }

  if (config.provider === "smtp" && config.smtp) {
    return sendViaSmtp(config.smtp, config.from, input);
  }

  if (config.resendApiKey) {
    return sendViaResend(config.resendApiKey, config.from, input);
  }

  return { ok: false, skipped: true, error: "API-ключ Resend не задан" };
}

export async function testMailDelivery(to: string): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: "Тест почтового сервера — ЕСЭДО",
    text: "Это тестовое письмо. Если вы его получили, настройки почты работают корректно.",
    html: "<p>Это <strong>тестовое письмо</strong>. Если вы его получили, настройки почты работают корректно.</p>",
  });
}
