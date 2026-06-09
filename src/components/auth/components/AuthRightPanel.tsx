import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n";
import { AuthForm } from "./AuthForm";
import type { AuthMode } from "../types";

interface AuthRightPanelProps {
  mode: AuthMode;
  email: string;
  password: string;
  fullName: string;
  loading: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onFullNameChange: (value: string) => void;
  onModeSwitch: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onEdsAuth: () => void;
  edsLoading?: boolean;
}

export function AuthRightPanel({
  mode,
  email,
  password,
  fullName,
  loading,
  onEmailChange,
  onPasswordChange,
  onFullNameChange,
  onModeSwitch,
  onSubmit,
  onEdsAuth,
  edsLoading = false,
}: AuthRightPanelProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-8 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs">
            <ShieldCheck className="h-4 w-4" />
            {t("auth.secureAccess")}
          </div>

          <h1 className="text-3xl font-semibold tracking-tight">
            {mode === "signin" ? t("auth.signInTitle") : t("auth.signUpTitle")}
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">{t("auth.pageDescription")}</p>
        </div>

        <div className="space-y-5">
          <AuthForm
            mode={mode}
            email={email}
            password={password}
            fullName={fullName}
            loading={loading}
            onEmailChange={onEmailChange}
            onPasswordChange={onPasswordChange}
            onFullNameChange={onFullNameChange}
            onSubmit={onSubmit}
          />

          <button
            type="button"
            disabled={loading || edsLoading}
            onClick={onEdsAuth}
            className="flex w-full items-center justify-center gap-2 rounded-md border py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            <LockKeyhole className="h-4 w-4" />
            {mode === "signup" ? t("auth.edsSignUp") : t("auth.edsSignIn")}
          </button>

          {email && password && (
            <p className="text-xs text-muted-foreground text-center">{t("auth.edsLinkHint")}</p>
          )}

          <div className="border-t pt-5 text-center">
            <button
              type="button"
              disabled={loading}
              onClick={onModeSwitch}
              className="text-sm text-primary hover:underline"
            >
              {mode === "signin" ? t("auth.createAccount") : t("auth.haveAccountLink")}
            </button>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-muted-foreground">{t("auth.policyFooter")}</div>
      </div>
    </div>
  );
}
