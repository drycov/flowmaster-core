// src/components/profile/index.tsx

import { useState } from "react";

import { useNavigate } from "@tanstack/react-router";

import { getStoredUser } from "@/lib/auth/session-storage";

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
import { AuthMethodsCard } from "./components/AuthMethodsCard";
import { EdsConnectionCard } from "./components/EdsConnectionCard";

import { AssignmentsCard } from "./components/AssignmentsCard";
import { SubstitutionsCard } from "./components/SubstitutionsCard";
import { NotificationPreferencesCard } from "./components/NotificationPreferencesCard";

import type { ProfileFormData, PasswordFormData } from "./types";



interface ProfilePageProps {

  /** Set when viewing another user (admin → users → profile) */

  viewUserId?: string;

}



export default function ProfilePage({ viewUserId }: ProfilePageProps) {

  const { t, locale } = useI18n();

  const navigate = useNavigate();

  const currentUserId = getStoredUser()?.id ?? null;



  const [isEditing, setIsEditing] = useState(false);



  const {

    profile,

    isLoading,

    error,

    refetch,

    isOwnProfile,

  } = useProfile(viewUserId);



  const {

    updateProfile,

    isUpdatingProfile,

    updatePassword,

    isUpdatingPassword,

    updateAvatar,

    isUpdatingAvatar,

  } = useProfileUpdate();



  const canEdit =

    isOwnProfile || (currentUserId && profile?.roles?.includes("admin"));



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

          <div className="text-center py-12 space-y-3">

            <p className="text-muted-foreground">

              {error instanceof Error ? error.message : t("profile.notFound")}

            </p>

            <div className="flex justify-center gap-2">

              <Button variant="outline" onClick={() => refetch()}>

                {t("common.retry")}

              </Button>

              {!isOwnProfile && (

                <Button variant="outline" onClick={() => navigate({ to: "/admin/users" })}>

                  {t("common.back")}

                </Button>

              )}

            </div>

          </div>

        </PageBody>

      </>

    );

  }



  const displayName =
    localized(profile, locale, "full_name") ||
    profile.email ||
    profile.iin ||
    t("profile.title");

  const initials = (displayName || "?")

    .split(" ")

    .map((p: string) => p[0])

    .filter(Boolean)

    .slice(0, 2)

    .join("")

    .toUpperCase();



  const handleProfileSave = async (data: ProfileFormData) => {

    await updateProfile({ ...data, id: profile.id });

    await refetch();

    setIsEditing(false);

  };



  const handlePasswordChange = async (data: PasswordFormData) => {

    if (isOwnProfile) {

      await updatePassword(data.newPassword);

    } else {

      toast.error(t("profile.cannotChangeOtherPassword"));

    }

  };



  const handleAvatarUpload = async (file: File) => {

    await updateAvatar({ file, userId: profile.id });

    await refetch();

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

          <div className="bg-card border rounded-lg p-6">

            <ProfileHeader

              profile={profile}

              displayName={displayName}

              initials={initials}

              onAvatarUpload={handleAvatarUpload}

              isUploadingAvatar={isUpdatingAvatar}

            />

          </div>



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



            <TabsContent value="info" className="space-y-4">

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

              <EdsConnectionCard
                profile={profile}
                isOwnProfile={isOwnProfile}
                onUpdated={() => {
                  void refetch();
                }}
              />

              <AssignmentsCard userId={profile.id} />

            </TabsContent>



            {isOwnProfile && (

              <TabsContent value="security">

                <div className="bg-card border rounded-lg p-6 space-y-8">

                  <div>

                    <h3 className="text-lg font-medium mb-2">{t("profile.authMethods")}</h3>

                    <p className="text-sm text-muted-foreground mb-4">

                      {t("profile.authMethodsDescription")}

                    </p>

                    <AuthMethodsCard profile={profile} onUpdated={() => refetch()} />

                  </div>

                  <SubstitutionsCard />

                  <NotificationPreferencesCard />

                  {profile.has_password && (

                    <div>

                      <h3 className="text-lg font-medium mb-2">{t("profile.changePassword")}</h3>

                      <p className="text-sm text-muted-foreground mb-4">

                        {t("profile.changePasswordDescription")}

                      </p>

                      <ChangePasswordDialog

                        onChangePassword={handlePasswordChange}

                        isUpdating={isUpdatingPassword}

                        requiresCurrentPassword

                      />

                    </div>

                  )}

                </div>

              </TabsContent>

            )}

          </Tabs>

        </div>

      </PageBody>

    </>

  );

}

