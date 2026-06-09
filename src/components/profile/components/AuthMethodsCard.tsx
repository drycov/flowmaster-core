import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { enableEmailLogin } from "@/lib/api/auth.functions";
import type { UserProfile } from "../types";

function isEdsPlaceholderEmail(email: string) {
  return /^eds\.\d{12}@esedo\.local$/i.test(email);
}

interface AuthMethodsCardProps {
  profile: UserProfile;
  onUpdated?: () => void;
}

export function AuthMethodsCard({ profile, onUpdated }: AuthMethodsCardProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const enableEmailMutation = useMutation({
    mutationFn: async () => {
      if (password.length < 8) throw new Error(t("profile.passwordTooShort"));
      if (password !== confirmPassword) throw new Error(t("profile.passwordsDoNotMatch"));
      await enableEmailLogin({ data: { email, password } });
    },
    onSuccess: () => {
      toast.success(t("profile.emailLoginEnabled"));
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile", "me"] });
      onUpdated?.();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("profile.emailLoginEnableError"));
    },
  });

  const showEnableEmail = !profile.has_password || isEdsPlaceholderEmail(profile.email);

  if (!showEnableEmail) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm text-muted-foreground">
        <p>{t("profile.authMethodsConfigured")}</p>
        {profile.email && !isEdsPlaceholderEmail(profile.email) && (
          <p>
            {t("profile.email")}: <span className="text-foreground">{profile.email}</span>
          </p>
        )}
        {profile.iin && (
          <p>
            {t("profile.linkedIin")}:{" "}
            <span className="font-mono text-foreground">{profile.iin}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showEnableEmail && (
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-start gap-3">
            <KeyRound className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div className="flex-1 space-y-1">
              <h4 className="font-medium">{t("profile.enableEmailTitle")}</h4>
              <p className="text-sm text-muted-foreground">{t("profile.enableEmailDescription")}</p>
            </div>
          </div>

          <div className="space-y-3 max-w-md">
            <div className="space-y-1.5">
              <Label>{t("profile.email")}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.placeholder.email")}
                disabled={enableEmailMutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("profile.newPassword")}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={enableEmailMutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("profile.confirmPassword")}</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={enableEmailMutation.isPending}
              />
            </div>
            <Button
              onClick={() => enableEmailMutation.mutate()}
              disabled={!email || !password || enableEmailMutation.isPending}
            >
              {enableEmailMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4 mr-2" />
              )}
              {t("profile.enableEmailAction")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
