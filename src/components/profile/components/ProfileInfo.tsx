// src/components/profile/components/ProfileInfo.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Phone, Building2, Briefcase, Mail, Calendar, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { format } from "date-fns";
import { ru, kk } from "date-fns/locale";
import type { UserProfile } from "../types";

interface ProfileInfoProps {
  profile: UserProfile;
}

export function ProfileInfo({ profile }: ProfileInfoProps) {
  const { t, locale } = useI18n();
  
  const dateLocale = locale === "ru" ? ru : kk;
  const lastLogin = profile.last_sign_in_at 
    ? format(new Date(profile.last_sign_in_at), "dd MMMM yyyy HH:mm", { locale: dateLocale })
    : "";

  const authMethodLabel =
    profile.auth_method === "both"
      ? t("profile.authMethod.both")
      : profile.auth_method === "eds"
        ? t("profile.authMethod.eds")
        : t("profile.authMethod.email");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.personalInfo")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground">{t("profile.fullNameRu")} (RU)</Label>
            <p className="mt-1">{profile.full_name_ru || "—"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">{t("profile.fullNameKk")} (KK)</Label>
            <p className="mt-1">{profile.full_name_kk || "—"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">{t("profile.email")}</Label>
            <div className="flex items-center gap-2 mt-1">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span>{profile.email || "—"}</span>
            </div>
          </div>
          <div>
            <Label className="text-muted-foreground">{t("profile.authMethod")}</Label>
            <div className="flex items-center gap-2 mt-1">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
              <Badge variant="secondary">{authMethodLabel}</Badge>
            </div>
          </div>
          <div>
            <Label className="text-muted-foreground">{t("profile.phone")}</Label>
            <div className="flex items-center gap-2 mt-1">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{profile.phone || "—"}</span>
            </div>
          </div>
          <div>
            <Label className="text-muted-foreground">{t("profile.department")}</Label>
            <div className="flex items-center gap-2 mt-1">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span>{profile.department || "—"}</span>
            </div>
          </div>
          <div>
            <Label className="text-muted-foreground">{t("profile.position")}</Label>
            <div className="flex items-center gap-2 mt-1">
              <Briefcase className="w-4 h-4 text-muted-foreground" />
              <span>{profile.position || "—"}</span>
            </div>
          </div>
          <div>
            <Label className="text-muted-foreground">{t("profile.lastActive")}</Label>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{lastLogin || "—"}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}