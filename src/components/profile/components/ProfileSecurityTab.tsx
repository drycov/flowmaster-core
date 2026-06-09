import { ProfileSecurityOverview } from "./ProfileSecurityOverview";
import { AuthMethodsCard } from "./AuthMethodsCard";
import { TelegramAccountCard } from "./TelegramAccountCard";
import { NotificationChannelsCard } from "./NotificationChannelsCard";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { SubstitutionsCard } from "./SubstitutionsCard";
import { useProfileTelegramData } from "../hooks/useProfileTelegramData";
import { useI18n } from "@/i18n";
import type { UserProfile, PasswordFormData } from "../types";

interface Props {
  profile: UserProfile;
  onProfileUpdated: () => void;
  onChangePassword: (data: PasswordFormData) => Promise<void>;
  isUpdatingPassword: boolean;
}

export function ProfileSecurityTab({
  profile,
  onProfileUpdated,
  onChangePassword,
  isUpdatingPassword,
}: Props) {
  const { t } = useI18n();
  const telegram = useProfileTelegramData();

  return (
    <div className="space-y-6">
      <ProfileSecurityOverview profile={profile} telegram={telegram} />

      <div className="bg-card border rounded-lg p-6 space-y-4">
        <div>
          <h3 className="text-sm font-medium">{t("profile.authMethods")}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t("profile.authMethodsDescription")}
          </p>
        </div>
        <AuthMethodsCard profile={profile} onUpdated={onProfileUpdated} />
      </div>

      <TelegramAccountCard profile={profile} telegram={telegram} />

      <NotificationChannelsCard linkStatus={telegram.linkStatusRaw} />

      {profile.has_password && (
        <div className="bg-card border rounded-lg p-6 space-y-4">
          <div>
            <h3 className="text-sm font-medium">{t("profile.changePassword")}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t("profile.changePasswordDescription")}
            </p>
          </div>
          <ChangePasswordDialog
            onChangePassword={onChangePassword}
            isUpdating={isUpdatingPassword}
            requiresCurrentPassword
          />
        </div>
      )}

      <SubstitutionsCard />
    </div>
  );
}
