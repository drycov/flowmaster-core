import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { toast } from "sonner";
import {
  confirmPasswordResetTelegram,
  requestPasswordResetTelegram,
} from "@/lib/api/telegram-auth.functions";

type Step = "email" | "code" | "done";

interface Props {
  minPasswordLength: number;
  tenantSlug?: string;
  onBack: () => void;
}

export function ForgotPasswordPanel({ minPasswordLength, tenantSlug, onBack }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const requestMutation = useMutation({
    mutationFn: () =>
      requestPasswordResetTelegram({
        data: { email: email.trim(), tenant_slug: tenantSlug?.trim() || undefined },
      }),
    onSuccess: (result) => {
      if (result.sent) {
        toast.success(t("auth.telegram.resetCodeSent"));
        setStep("code");
      } else {
        toast.message(t("auth.telegram.resetIfLinked"));
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("auth.telegram.resetError")),
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      confirmPasswordResetTelegram({
        data: {
          email: email.trim(),
          code: code.trim(),
          password,
          tenant_slug: tenantSlug?.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success(t("auth.telegram.resetSuccess"));
      setStep("done");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("auth.telegram.resetError")),
  });

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== passwordConfirm) {
      toast.error(t("auth.error.passwordMismatch"));
      return;
    }
    if (password.length < minPasswordLength) {
      toast.error(t("auth.passwordHint").replace("{n}", String(minPasswordLength)));
      return;
    }
    confirmMutation.mutate();
  };

  if (step === "done") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("auth.telegram.resetDone")}</p>
        <Button type="button" className="w-full" onClick={onBack}>
          {t("auth.telegram.backToSignIn")}
        </Button>
      </div>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={handleConfirm} className="space-y-4">
        <p className="text-xs text-muted-foreground">{t("auth.telegram.resetCodeHint")}</p>
        <div className="space-y-1.5">
          <Label>{t("auth.telegram.resetCode")}</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("auth.password")}</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={minPasswordLength}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("auth.passwordConfirm")}</Label>
          <Input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            minLength={minPasswordLength}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={confirmMutation.isPending}>
          {confirmMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("auth.telegram.resetSubmit")}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
          {t("common.cancel")}
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        requestMutation.mutate();
      }}
      className="space-y-4"
    >
      <p className="text-xs text-muted-foreground">{t("auth.telegram.resetIntro")}</p>
      <div className="space-y-1.5">
        <Label>{t("auth.email")}</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={requestMutation.isPending}>
        {requestMutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Send className="mr-2 h-4 w-4" />
        )}
        {t("auth.telegram.resetRequest")}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        {t("common.cancel")}
      </Button>
    </form>
  );
}
