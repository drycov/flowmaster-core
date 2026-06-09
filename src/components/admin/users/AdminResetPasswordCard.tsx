import { AdminResetPasswordDialog } from "./AdminResetPasswordDialog";
import { useI18n } from "@/i18n";

type Props = {
  userId: string;
  userLabel: string;
};

export function AdminResetPasswordCard({ userId, userLabel }: Props) {
  const { t } = useI18n();

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div>
        <h3 className="text-sm font-medium">{t("admin.users.resetPassword")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t("admin.users.resetPasswordCardHint")}</p>
      </div>
      <AdminResetPasswordDialog userId={userId} userLabel={userLabel} />
    </div>
  );
}
