import { cn } from "@/lib/utils";
import { sap } from "@/components/auth/styles/sap-tokens";
import { useI18n } from "@/i18n";

const LOCALES = [
  { code: "ru" as const, label: "RU" },
  { code: "kk" as const, label: "KZ" },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div
      className="inline-flex items-center rounded-sm border p-0.5"
      style={{ borderColor: sap.border, backgroundColor: sap.pageBg }}
      role="group"
      aria-label="Language"
    >
      {LOCALES.map(({ code, label }, index) => (
        <span key={code} className="inline-flex items-center">
          <button
            type="button"
            onClick={() => setLocale(code)}
            className={cn(
              "min-w-[2rem] rounded-sm px-2 py-0.5 font-mono text-[11px] font-semibold transition-colors",
              locale === code ? "bg-white shadow-sm" : "hover:bg-white/60",
            )}
            style={{ color: locale === code ? sap.link : sap.textMuted }}
            aria-pressed={locale === code}
          >
            {label}
          </button>
          {index < LOCALES.length - 1 && (
            <span className="px-0.5 text-[11px]" style={{ color: sap.border }} aria-hidden>
              |
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
