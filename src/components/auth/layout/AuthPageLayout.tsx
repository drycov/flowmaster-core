import type { ReactNode } from "react";

import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { useI18n } from "@/i18n";

interface AuthPageLayoutProps {
  children: ReactNode;
}

export function AuthPageLayout({ children }: AuthPageLayoutProps) {
  return (
    <div className="auth-page relative flex min-h-screen min-h-[100dvh] flex-col bg-background font-sans text-foreground">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        {children}
      </main>

      <AuthFooter />
    </div>
  );
}

function AuthFooter() {
  const { t } = useI18n();
  return (
    <footer className="pb-6 text-center text-xs text-muted-foreground">{t("shell.version")}</footer>
  );
}
