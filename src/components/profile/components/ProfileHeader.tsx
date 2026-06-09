// src/components/profile/components/ProfileHeader.tsx
import { Mail, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AvatarUpload } from "./AvatarUpload";
import { useI18n } from "@/i18n";
import { roleLabel } from "@/i18n/helpers";
import { format } from "date-fns";
import { ru, kk } from "date-fns/locale";
import type { UserProfile } from "../types";

interface ProfileHeaderProps {
  profile: UserProfile;
  displayName: string;
  initials: string;
  onAvatarUpload: (file: File) => void;
  isUploadingAvatar: boolean;
}

export function ProfileHeader({
  profile,
  displayName,
  initials,
  onAvatarUpload,
  isUploadingAvatar,
}: ProfileHeaderProps) {
  const { t, locale } = useI18n();

  const dateLocale = locale === "ru" ? ru : kk;

  const createdAt = profile.created_at ? new Date(profile.created_at) : null;

  const joinDate =
    createdAt && !isNaN(createdAt.getTime())
      ? format(createdAt, "dd MMMM yyyy", { locale: dateLocale })
      : t("common.unknown");

  const roles = profile.roles ?? [];

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
      <AvatarUpload
        avatarUrl={profile.avatar_url ?? undefined}
        initials={initials}
        onUpload={onAvatarUpload}
        isUploading={isUploadingAvatar}
      />

      <div className="flex-1">
        <h1 className="text-2xl font-bold">{displayName}</h1>

        <div className="flex items-center gap-2 mt-1 text-muted-foreground">
          <Mail className="w-4 h-4" />
          <span className="text-sm">{profile.email}</span>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {roles.map((role) => (
            <Badge key={role} variant="secondary">
              {roleLabel(t, role)}
            </Badge>
          ))}
          {profile.has_eds && (
            <Badge variant="outline" className="border-emerald-600/40 text-emerald-700">
              {t("profile.edsStatusOn")}
            </Badge>
          )}
        </div>

        {(profile.department || profile.position) && (
          <div className="mt-3 text-sm text-muted-foreground space-y-1">
            {profile.department && <div>{profile.department}</div>}
            {profile.position && <div>{profile.position}</div>}
          </div>
        )}
      </div>

      <div className="text-right text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>
            {t("profile.joined")}: {joinDate}
          </span>
        </div>
      </div>
    </div>
  );
}
