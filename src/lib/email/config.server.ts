import { loadSystemSettings, type MailPolicySettings } from "@/lib/auth/policy";

export type ResolvedMailConfig = {
  enabled: boolean;
  provider: "resend" | "smtp";
  from: string;
  resendApiKey: string | null;
  smtp: {
    host: string;
    port: number;
    user: string;
    password: string;
    secure: boolean;
  } | null;
};

function buildFromAddress(mail: MailPolicySettings): string {
  if (mail.from_address) {
    return mail.from_name ? `${mail.from_name} <${mail.from_address}>` : mail.from_address;
  }
  return mail.from_name ? `${mail.from_name} <noreply@localhost>` : "ЕСЭДО <noreply@localhost>";
}

export async function resolveMailConfig(): Promise<ResolvedMailConfig> {
  const settings = await loadSystemSettings();
  const mail = settings.mail;

  if (!mail.enabled) {
    return {
      enabled: false,
      provider: "resend",
      from: buildFromAddress(mail),
      resendApiKey: null,
      smtp: null,
    };
  }

  const from = buildFromAddress(mail);

  if (mail.provider === "smtp") {
    return {
      enabled: !!(mail.smtp_host && mail.smtp_user && mail.smtp_password),
      provider: "smtp",
      from,
      resendApiKey: null,
      smtp: {
        host: mail.smtp_host,
        port: mail.smtp_port,
        user: mail.smtp_user,
        password: mail.smtp_password,
        secure: mail.smtp_secure,
      },
    };
  }

  return {
    enabled: !!mail.resend_api_key,
    provider: "resend",
    from,
    resendApiKey: mail.resend_api_key || null,
    smtp: null,
  };
}
