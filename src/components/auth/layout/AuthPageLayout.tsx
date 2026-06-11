import type { ReactNode } from "react";

import { sap } from "@/components/auth/styles/sap-tokens";
import { AuthHeader } from "./AuthHeader";

interface AuthPageLayoutProps {
  hero: ReactNode;
  login: ReactNode;
}

export function AuthPageLayout({ hero, login }: AuthPageLayoutProps) {
  return (
    <div
      className="auth-page flex min-h-screen min-h-[100dvh] flex-col"
      style={{ backgroundColor: sap.pageBg, color: sap.text, fontFamily: '"72", "Inter", "Segoe UI", system-ui, sans-serif' }}
    >
      <AuthHeader />

      <div className="grid flex-1 lg:grid-cols-[minmax(0,58%)_minmax(0,42%)] xl:grid-cols-[minmax(0,60%)_minmax(0,40%)]">
        {hero}
        {login}
      </div>
    </div>
  );
}
