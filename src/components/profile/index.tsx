// src/components/profile/index.tsx
import { useState, useEffect } from "react";
import { useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Shield, Edit, Loader2, ArrowLeft } from "lucide-react";
import { useI18n, localized } from "@/i18n";
import { toast } from "sonner";

import { useProfile } from "./hooks/useProfile";
import { useProfileUpdate } from "./hooks/useProfileUpdate";
import { ProfileHeader } from "./components/ProfileHeader";
import { ProfileInfo } from "./components/ProfileInfo";
import { ProfileForm } from "./components/ProfileForm";
import { ChangePasswordDialog } from "./components/ChangePasswordDialog";
import { AssignmentsCard } from "./components/AssignmentsCard";
import type { ProfileFormData, PasswordFormData, UserProfile } from "./types";

// Функция для загрузки профиля пользователя по ID
async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const [{ data: profile, error: profileError }, { data: rolesData }, auth] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.auth.getUser(),
    ]);

  if (profileError && profileError.code !== "PGRST116") {
    throw profileError;
  }

  const user = auth.data.user;

  const { data: department } = profile?.department_id
    ? await supabase
        .from("departments")
        .select("name_ru, name_kk")
        .eq("id", profile.department_id)
        .single()
    : { data: null };

  const { data: position } = profile?.position_id
    ? await supabase
        .from("positions")
        .select("title_ru, title_kk")
        .eq("id", profile.position_id)
        .single()
    : { data: null };

  const p = profile as any;
  return {
    id: p?.id ?? userId,
    email: p?.email ?? user?.email ?? "",

    full_name_ru: p?.full_name_ru ?? null,
    full_name_kk: p?.full_name_kk ?? null,
    avatar_url: p?.avatar_url ?? null,

    roles: rolesData?.map((r) => r.role) ?? [],

    created_at: p?.created_at ?? user?.created_at ?? new Date().toISOString(),
    updated_at: p?.updated_at ?? new Date().toISOString(),
    last_sign_in_at: user?.last_sign_in_at ?? undefined,

    department: department ? `${department.name_ru} / ${department.name_kk}` : null,
    position: position ? `${position.title_ru} / ${position.title_kk}` : null,
  };
}



export default function ProfilePage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const router = useRouterState();

  // Безопасное получение параметров
  const params = router.matches
    .flatMap(m => m.params)
    .find(p => p && typeof p === 'object' && 'id' in p) as { id?: string } | undefined;

  const userId = params?.id;

  const [isEditing, setIsEditing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Получаем текущего пользователя
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getCurrentUser();
  }, []);

  // Загрузка профиля (свой или чужой)
  const {
    profile: ownProfile,
    isLoading: isLoadingOwn,
    refetch: refetchOwn
  } = useProfile();

  const {
    data: userProfile,
    isLoading: isLoadingUser,
    error: userError,
    refetch: refetchUser
  } = useQuery({
    queryKey: ["user-profile", userId],
    queryFn: () => fetchUserProfile(userId!),
    enabled: !!userId && userId !== currentUserId,
  });

  // Определяем, какой профиль показывать
  const isOwnProfile = !userId || userId === currentUserId;
  const profile = isOwnProfile ? ownProfile : userProfile;
  const isLoading = isOwnProfile ? isLoadingOwn : isLoadingUser;
  const error = isOwnProfile ? null : userError;

  const {
    updateProfile,
    isUpdatingProfile,
    updatePassword,
    isUpdatingPassword,
    updateAvatar,
    isUpdatingAvatar,
  } = useProfileUpdate();

  // Проверка прав администратора
  const canEdit = isOwnProfile || (currentUserId && ownProfile?.roles?.includes("admin"));

  if (isLoading) {
    return (
      <>
        <PageHeader title={isOwnProfile ? t("profile.title") : t("profile.userProfile")} />
        <PageBody>
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </PageBody>
      </>
    );
  }

  if (error || !profile) {
    return (
      <>
        <PageHeader title={t("profile.title")} />
        <PageBody>
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t("profile.notFound")}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate({ to: "/admin/users" })}
            >
              {t("common.back")}
            </Button>
          </div>
        </PageBody>
      </>
    );
  }

  const displayName = localized(profile, locale, "full_name") || profile.email;
  const initials = displayName
    .split(" ")
    .map((p: string) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleProfileSave = async (data: ProfileFormData) => {
    await updateProfile({ ...data, id: profile.id });
    if (isOwnProfile) {
      await refetchOwn();
    } else {
      await refetchUser();
    }
    setIsEditing(false);
  };

  const handlePasswordChange = async (data: PasswordFormData) => {
    // Только свой профиль может менять пароль
    if (isOwnProfile) {
      await updatePassword(data.newPassword);
    } else {
      toast.error(t("profile.cannotChangeOtherPassword"));
    }
  };

  const handleAvatarUpload = async (file: File) => {
    await updateAvatar({ file, userId: profile.id });
    if (isOwnProfile) {
      await refetchOwn();
    } else {
      await refetchUser();
    }
  };

  const pageTitle = isOwnProfile
    ? t("profile.title")
    : `${t("profile.userProfile")}: ${displayName}`;

  return (
    <>
      <PageHeader
        title={pageTitle}
        actions={
          <>
            {!isOwnProfile && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate({ to: "/admin/users" })}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                {t("common.back")}
              </Button>
            )}
            {!isEditing && canEdit && (
              <Button size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="w-4 h-4 mr-1" />
                {t("common.edit")}
              </Button>
            )}
          </>
        }
      />

      <PageBody>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Profile Header Card */}
          <div className="bg-card border rounded-lg p-6">
            <ProfileHeader
              profile={profile}
              displayName={displayName}
              initials={initials}
              onAvatarUpload={handleAvatarUpload}
              isUploadingAvatar={isUpdatingAvatar}
            />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="info">
            <TabsList>
              <TabsTrigger value="info">
                <User className="w-4 h-4 mr-1" />
                {t("profile.personalInfo")}
              </TabsTrigger>
              {isOwnProfile && (
                <TabsTrigger value="security">
                  <Shield className="w-4 h-4 mr-1" />
                  {t("profile.security")}
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="info">
              {isEditing && canEdit ? (
                <ProfileForm
                  profile={profile}
                  onSave={handleProfileSave}
                  onCancel={() => setIsEditing(false)}
                  isSaving={isUpdatingProfile}
                />
              ) : (
                <ProfileInfo profile={profile} />
              )}
            </TabsContent>

            <TabsContent value="info">
              <div className="mt-4">
                <AssignmentsCard userId={profile.id} />
              </div>
            </TabsContent>

            {isOwnProfile && (
              <TabsContent value="security">
                <div className="bg-card border rounded-lg p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-2">{t("profile.changePassword")}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t("profile.changePasswordDescription")}
                    </p>
                    <ChangePasswordDialog
                      onChangePassword={handlePasswordChange}
                      isUpdating={isUpdatingPassword}
                    />
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </PageBody>
    </>
  );
}