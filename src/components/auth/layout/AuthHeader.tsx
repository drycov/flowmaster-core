import { Link } from "@tanstack/react-router";
import { BookOpen, Headphones } from "lucide-react";

import { LanguageSwitcher } from "@/components/auth/components/LanguageSwitcher";
import { sap } from "@/components/auth/styles/sap-tokens";
import { useI18n } from "@/i18n";

export function AuthHeader() {
  const { t } = useI18n();

  return (
    <header
      className="sticky top-0 z-20 border-b"
      style={{ backgroundColor: sap.card, borderColor: sap.border }}
    >
      <div className="mx-auto flex h-11 max-w-[1920px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-xs font-bold text-white"
            style={{ backgroundColor: sap.brand }}
          >
            {t("shell.brandAbbr")}
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold" style={{ color: sap.text }}>
              {t("app.name")}
            </p>
            <p className="truncate text-xs" style={{ color: sap.textSecondary }}>
              {t("app.tagline")}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <LanguageSwitcher />

          <span
            className="hidden h-4 w-px sm:block"
            style={{ backgroundColor: sap.border }}
            aria-hidden
          />

          <span className="hidden font-mono text-xs sm:inline" style={{ color: sap.textMuted }}>
            {t("shell.version")}
          </span>

          <span
            className="hidden h-4 w-px md:block"
            style={{ backgroundColor: sap.border }}
            aria-hidden
          />

          <Link
            to="/help"
            className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-normal transition-colors hover:bg-[#EBF8FF]"
            style={{ color: sap.link }}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{t("auth.header.documentation")}</span>
          </Link>

          <a
            href="mailto:support@esedo.local"
            className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-normal transition-colors hover:bg-[#EBF8FF]"
            style={{ color: sap.link }}
          >
            <Headphones className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{t("auth.header.support")}</span>
          </a>
        </div>
      </div>
    </header>
  );
}
