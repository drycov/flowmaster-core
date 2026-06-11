import { useI18n } from "@/i18n";

export function AuthBrand() {
  const { t } = useI18n();

  return (
    <div className="mb-8 flex flex-col items-center text-center">
      <div className="mb-4 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-brand-navy text-lg font-bold text-white">
        {t("shell.brandAbbr")}
      </div>
      <p className="text-base font-semibold tracking-tight text-foreground">{t("app.name")}</p>
      <p className="mt-1.5 max-w-xs text-sm leading-snug text-muted-foreground">{t("app.tagline")}</p>
    </div>
  );
}
