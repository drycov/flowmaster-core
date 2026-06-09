// src/components/profile/components/ChangePasswordDialog.tsx
import { useState } from "react";
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
import { Key, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";
import type { PasswordFormData } from "../types";

interface ChangePasswordDialogProps {
  onChangePassword: (data: PasswordFormData) => void;
  isUpdating: boolean;
  requiresCurrentPassword?: boolean;
}

export function ChangePasswordDialog({
  onChangePassword,
  isUpdating,
  requiresCurrentPassword = true,
}: ChangePasswordDialogProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<PasswordFormData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Partial<PasswordFormData>>({});

  const validate = (): boolean => {
    const newErrors: Partial<PasswordFormData> = {};
    
    if (requiresCurrentPassword && !formData.currentPassword) {
      newErrors.currentPassword = t("profile.currentPasswordRequired");
    }
    if (!formData.newPassword) {
      newErrors.newPassword = t("profile.newPasswordRequired");
    } else if (formData.newPassword.length < 6) {
      newErrors.newPassword = t("profile.passwordTooShort");
    }
    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = t("profile.passwordsDoNotMatch");
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onChangePassword(formData);
      setOpen(false);
      setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setErrors({});
    }
  };

  const handleCancel = () => {
    setOpen(false);
    setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setErrors({});
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Key className="w-4 h-4 mr-1" />
          {requiresCurrentPassword ? t("profile.changePassword") : t("profile.setPassword")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {requiresCurrentPassword ? t("profile.changePassword") : t("profile.setPassword")}
          </DialogTitle>
          <DialogDescription>
            {requiresCurrentPassword
              ? t("profile.changePasswordDescription")
              : t("profile.setPasswordDescription")}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {requiresCurrentPassword && (
            <div className="space-y-2">
              <Label>{t("profile.currentPassword")}</Label>
              <Input
                type="password"
                value={formData.currentPassword}
                onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                placeholder="••••••"
              />
              {errors.currentPassword && (
                <p className="text-xs text-destructive">{errors.currentPassword}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("profile.newPassword")}</Label>
            <Input
              type="password"
              value={formData.newPassword}
              onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
              placeholder="••••••"
            />
            {errors.newPassword && (
              <p className="text-xs text-destructive">{errors.newPassword}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label>{t("profile.confirmPassword")}</Label>
            <Input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="••••••"
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword}</p>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isUpdating}>
            {isUpdating ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Key className="w-4 h-4 mr-1" />
            )}
            {requiresCurrentPassword ? t("profile.changePassword") : t("profile.setPassword")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}