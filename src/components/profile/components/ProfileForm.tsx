// src/components/profile/components/ProfileForm.tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, X, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";
import type { ProfileFormData, UserProfile } from "../types";

interface ProfileFormProps {
  profile: UserProfile;
  onSave: (data: ProfileFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function ProfileForm({ profile, onSave, onCancel, isSaving }: ProfileFormProps) {
  const { t } = useI18n();
  const [formData, setFormData] = useState<ProfileFormData>({
    full_name_ru: profile.full_name_ru || "",
    full_name_kk: profile.full_name_kk || "",
    phone: profile.phone || "",
    department: profile.department || "",
    position: profile.position || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.editProfile")}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>{t("profile.fullNameRu")} (RU)</Label>
              <Input
                value={formData.full_name_ru}
                onChange={(e) => setFormData({ ...formData, full_name_ru: e.target.value })}
                placeholder={t("profile.placeholder.fullName")}
              />
            </div>
            <div>
              <Label>{t("profile.fullNameKk")} (KK)</Label>
              <Input
                value={formData.full_name_kk}
                onChange={(e) => setFormData({ ...formData, full_name_kk: e.target.value })}
                placeholder={t("profile.placeholder.fullName")}
              />
            </div>
            <div>
              <Label>{t("profile.phone")}</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder={t("profile.placeholder.phone")}
              />
            </div>
            <div>
              <Label>{t("profile.department")}</Label>
              <Input
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder={t("profile.departmentPlaceholder")}
              />
            </div>
            <div className="md:col-span-2">
              <Label>{t("profile.position")}</Label>
              <Input
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder={t("profile.positionPlaceholder")}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-1" />
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              {t("common.save")}
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
