import { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import type { AuthMode } from "../types";

interface AuthFormProps {
  mode: AuthMode;
  email: string;
  password: string;
  fullName: string;
  loading: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onFullNameChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
}

export function AuthForm({
  mode,
  email,
  password,
  fullName,
  loading,
  onEmailChange,
  onPasswordChange,
  onFullNameChange,
  onSubmit,
}: AuthFormProps) {
  const { t } = useI18n();

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {mode === "signup" && (
        <div className="space-y-1.5">
          <Label>{t("auth.fullname")}</Label>
          <Input
            value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
            required
            disabled={loading}
            placeholder={t("auth.placeholder.fullName")}
          />
        </div>
      )}
      
      <div className="space-y-1.5">
        <Label>{t("auth.email")}</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
          disabled={loading}
          autoComplete="email"
          placeholder={t("auth.placeholder.email")}
        />
      </div>
      
      <div className="space-y-1.5">
        <Label>{t("auth.password")}</Label>
        <Input
          type="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          required
          minLength={6}
          disabled={loading}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="••••••"
        />
      </div>
      
      <Button type="submit" className="w-full" disabled={loading}>
        {loading 
          ? t("common.loading") 
          : mode === "signin" 
            ? t("auth.signin") 
            : t("auth.signup")
        }
      </Button>
    </form>
  );
}