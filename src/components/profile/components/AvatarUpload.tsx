// src/components/profile/components/AvatarUpload.tsx
import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { useI18n, localized } from "@/i18n";

interface AvatarUploadProps {
  avatarUrl?: string | null;
  initials: string;
  onUpload: (file: File) => void;
  isUploading: boolean;
  canEdit?: boolean;
}

export function AvatarUpload({ 
  avatarUrl, 
  initials, 
  onUpload, 
  isUploading, 
  canEdit = true 
}: AvatarUploadProps) {
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Проверка типа файла
      if (!file.type.startsWith('image/')) {
        alert(t("profile.invalidImageType"));
        return;
      }
      // Проверка размера (макс 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert(t("profile.imageTooLarge"));
        return;
      }
      onUpload(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div
      className="relative group"
      onMouseEnter={() => canEdit && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
        <AvatarImage src={avatarUrl || ""} />
        <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
      
      {canEdit && isHovered && !isUploading && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full transition-all"
        >
          <Camera className="w-6 h-6 text-white" />
        </button>
      )}
      
      {isUploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        </div>
      )}
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}