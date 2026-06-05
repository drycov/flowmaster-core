import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";

import { GoogleButton } from "./GoogleButton";
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
  onGoogleSignIn: () => void;
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
  onGoogleSignIn,
}: AuthRightPanelProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-8 py-10">
      <div className="w-full max-w-md">

        <div className="mb-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs">
            <ShieldCheck className="h-4 w-4" />
            Защищенный доступ
          </div>

          <h1 className="text-3xl font-semibold tracking-tight">
            {mode === "signin"
              ? "Вход в систему"
              : "Регистрация пользователя"}
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Система электронного документооборота и управления жизненным
            циклом документов.
          </p>
        </div>

        <div className="space-y-5">

          <GoogleButton
            onClick={onGoogleSignIn}
            disabled={loading}
          />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>

            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs uppercase text-muted-foreground">
                или
              </span>
            </div>
          </div>

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
            className="flex w-full items-center justify-center gap-2 rounded-md border py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            <LockKeyhole className="h-4 w-4" />
            Вход с использованием ЭЦП
          </button>

          <div className="border-t pt-5 text-center">
            <button
              type="button"
              disabled={loading}
              onClick={onModeSwitch}
              className="text-sm text-primary hover:underline"
            >
              {mode === "signin"
                ? "Создать учетную запись"
                : "Уже есть учетная запись"}
            </button>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          Продолжая работу, вы принимаете политику безопасности и правила
          обработки электронных документов.
        </div>
      </div>
    </div>
  );
}