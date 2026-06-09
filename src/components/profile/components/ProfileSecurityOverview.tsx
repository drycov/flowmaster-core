import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { KeyRound, LockKeyhole, Mail, Send } from "lucide-react";
import { isTelegramProfileAvailable } from "../constants";
import type { useProfileTelegramData } from "../hooks/useProfileTelegramData";
import type { UserProfile } from "../types";

function isEdsPlaceholderEmail(email: string) {
  return /^eds\.\d{12}@esedo\.local$/i.test(email);
}

interface Props {
  profile: UserProfile;
  telegram: ReturnType<typeof useProfileTelegramData>;
}

export function ProfileSecurityOverview({ profile, telegram }: Props) {
  const { t } = useI18n();
  const { authConfig, linkStatus } = telegram;

  const methods: Array<{ icon: typeof Mail; label: string; active: boolean }> = [
    {
      icon: Mail,
      label: t("profile.authMethod.email"),
      active: !!profile.has_password && !isEdsPlaceholderEmail(profile.email),
    },
    {
      icon: LockKeyhole,
      label: t("profile.authMethod.eds"),
      active: profile.has_eds || profile.auth_method === "eds" || profile.auth_method === "both",
    },
    ...(isTelegramProfileAvailable(authConfig)
      ? [
          {
            icon: Send,
            label: t("profile.telegram.badge"),
            active: linkStatus.linked,
          },
        ]
      : []),
  ];

  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
      <p className="text-sm font-medium">{t("profile.securityOverview")}</p>
      <div className="flex flex-wrap gap-2">
        {methods.map((m) => (
          <Badge
            key={m.label}
            variant={m.active ? "secondary" : "outline"}
            className="gap-1.5 font-normal"
          >
            <m.icon className="h-3 w-3" />
            {m.label}
            {m.active ? "" : ` (${t("profile.notConnected")})`}
          </Badge>
        ))}
      </div>
      {authConfig?.allow_telegram_login && !linkStatus.linked && (
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <KeyRound className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {t("profile.telegram.loginHint")}
        </p>
      )}
    </div>
  );
}
