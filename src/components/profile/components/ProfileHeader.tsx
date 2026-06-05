// src/components/profile/components/ProfileHeader.tsx
import { Mail, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AvatarUpload } from "./AvatarUpload";
import { useI18n } from "@/i18n";
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
  isUploadingAvatar 
}: ProfileHeaderProps) {
  const { t, locale } = useI18n();
  
  const dateLocale = locale === "ru" ? ru : kk;
  const joinDate = profile.created_at 
    ? format(new Date(profile.created_at), "dd MMMM yyyy", { locale: dateLocale })
    : "";

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
      <AvatarUpload
        avatarUrl={profile.avatar_url}
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
          {profile.roles?.map((role) => (
            <Badge key={role} variant="secondary">
              {t(`roles.${role}`) || role}
            </Badge>
          ))}
        </div>
      </div>
      
      <div className="text-right text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          
          <span>{t("profile.joined")}: {joinDate}</span>
        </div>
      </div>
    </div>
  );
}