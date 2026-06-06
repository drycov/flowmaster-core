// src/components/profile/hooks/useProfileUpdate.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ProfileFormData } from "../types";

async function updateProfile(data: ProfileFormData & { id: string }) {
  const patch: Record<string, unknown> = {
    full_name_ru: data.full_name_ru || null,
    full_name_kk: data.full_name_kk || null,
    phone: data.phone || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await (supabase.from("profiles") as any).update(patch).eq("id", data.id);
  if (error) throw error;
  return data;
}

async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

async function updateAvatar(file: File, userId: string) {
  const fileExt = file.name.split(".").pop();
  const filePath = `${userId}/${Date.now()}.${fileExt}`;

  const { data: existing } = await supabase.storage.from("avatars").list(userId);
  if (existing && existing.length > 0) {
    await supabase.storage.from("avatars").remove(existing.map((f) => `${userId}/${f.name}`));
  }

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, { upsert: true });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(filePath);

  const { error: updateError } = await (supabase.from("profiles") as any)
    .update({ avatar_url: publicUrl })
    .eq("id", userId);
  if (updateError) throw updateError;

  return publicUrl;
}

export function useProfileUpdate() {
  const queryClient = useQueryClient();

  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Профиль успешно обновлён");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Ошибка при обновлении профиля");
    },
  });

  const passwordMutation = useMutation({
    mutationFn: updatePassword,
    onSuccess: () => {
      toast.success("Пароль успешно изменён");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Ошибка при смене пароля");
    },
  });

  const avatarMutation = useMutation({
    mutationFn: ({ file, userId }: { file: File; userId: string }) => updateAvatar(file, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile", variables.userId] });
      toast.success("Аватар успешно обновлён");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Ошибка при загрузке аватара");
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
