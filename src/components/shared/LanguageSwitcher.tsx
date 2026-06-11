import { Languages } from "lucide-react";

import { useI18n } from "@/i18n";

const LOCALES = [
  { code: "ru" as const, label: "Русский" },
  { code: "kk" as const, label: "Қазақша" },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const active = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      onClick={() => setLocale(locale === "ru" ? "kk" : "ru")}
      title={LOCALES.find((l) => l.code !== locale)?.label}
    >
      <Languages className="h-4 w-4" />
      <span>{active.label}</span>
    </button>
  );
}
