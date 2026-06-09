import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { avatarPath, STORAGE_BUCKETS } from "@/lib/storage/buckets";
import {
  getPublicStorageUrl,
  listAuthenticatedFiles,
  removeAuthenticatedFiles,
  uploadAuthenticatedFile,
} from "@/lib/storage/client";
import { changeMyPassword, updateMyProfile } from "@/lib/api/auth.functions";
import { useI18n } from "@/i18n";
import type { ProfileFormData } from "../types";

async function updateProfile(data: ProfileFormData & { id: string }) {
  await updateMyProfile({
    data: {
      full_name_ru: data.full_name_ru || undefined,
      full_name_kk: data.full_name_kk || undefined,
      phone: data.phone || null,
    },
  });
  return data;
}

async function updatePassword(password: string) {
  await changeMyPassword({ data: { password } });
}

async function updateAvatar(file: File, userId: string) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const path = avatarPath(userId, fileName);

  const existing = await listAuthenticatedFiles(STORAGE_BUCKETS.avatars, userId);
  if (existing.length > 0) {
    await removeAuthenticatedFiles(
      STORAGE_BUCKETS.avatars,
      existing.map((f) => avatarPath(userId, f.name)),
    );
  }

  await uploadAuthenticatedFile(STORAGE_BUCKETS.avatars, path, file, { upsert: true });
  const publicUrl = getPublicStorageUrl(STORAGE_BUCKETS.avatars, path);
  await updateMyProfile({ data: { avatar_url: publicUrl } });
  return publicUrl;
}

export function useProfileUpdate() {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile", "me"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(t("profile.profileUpdated"));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("profile.profileUpdateError"));
    },
  });

  const passwordMutation = useMutation({
    mutationFn: updatePassword,
    onSuccess: () => {
      toast.success(t("profile.passwordUpdated"));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("profile.passwordUpdateError"));
    },
  });

  const avatarMutation = useMutation({
    mutationFn: ({ file, userId }: { file: File; userId: string }) => updateAvatar(file, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile", "me"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile", variables.userId] });
      toast.success(t("profile.avatarUpdated"));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("profile.avatarUpdateError"));
    },
  });

  return {
    updateProfile: profileMutation.mutate,
    isUpdatingProfile: profileMutation.isPending,
    updatePassword: passwordMutation.mutate,
    isUpdatingPassword: passwordMutation.isPending,
    updateAvatar: avatarMutation.mutate,
    isUpdatingAvatar: avatarMutation.isPending,
  };
}
