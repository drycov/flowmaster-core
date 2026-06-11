import { useI18n } from "@/i18n";

export function AuthOrDivider() {
  const { t } = useI18n();

  return (
    <div className="relative py-1">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-background px-3 text-xs text-muted-foreground">{t("auth.orDivider")}</span>
      </div>
    </div>
  );
}
