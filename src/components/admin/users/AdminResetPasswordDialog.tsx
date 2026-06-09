import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { adminResetUserPassword } from "@/lib/api/admin.functions";

type Props = {
  userId: string;
  userLabel: string;
  variant?: "outline" | "ghost";
  size?: "sm" | "icon";
  onSuccess?: () => void;
};

export function AdminResetPasswordDialog({
  userId,
  userLabel,
  variant = "outline",
  size = "sm",
  onSuccess,
}: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const resetMut = useMutation({
    mutationFn: () => adminResetUserPassword({ data: { user_id: userId, password } }),
    onSuccess: () => {
      toast.success(t("admin.users.passwordResetSuccess"));
      setOpen(false);
      setPassword("");
      setConfirm("");
      onSuccess?.();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const canSubmit =
    password.length >= 8 && password === confirm && !resetMut.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(t("profile.passwordTooShort"));
      return;
    }
    if (password !== confirm) {
      toast.error(t("profile.passwordsDoNotMatch"));
      return;
    }
    resetMut.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          title={t("admin.users.resetPassword")}
          onClick={(e) => e.stopPropagation()}
        >
          {size === "icon" ? (
            <KeyRound className="h-4 w-4" />
          ) : (
            <>
              <KeyRound className="mr-1 h-4 w-4" />
              {t("admin.users.resetPassword")}
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("admin.users.resetPasswordTitle")}</DialogTitle>
            <DialogDescription>
              {t("admin.users.resetPasswordDescription").replace("{name}", userLabel)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor={`pwd-${userId}`}>{t("admin.users.newPassword")}</Label>
              <Input
                id={`pwd-${userId}`}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={resetMut.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`pwd-confirm-${userId}`}>{t("profile.confirmPassword")}</Label>
              <Input
                id={`pwd-confirm-${userId}`}
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={resetMut.isPending}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("admin.users.resetPasswordHint")}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {resetMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("admin.users.resetPasswordConfirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
