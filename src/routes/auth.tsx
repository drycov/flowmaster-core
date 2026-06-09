import { createFileRoute } from "@tanstack/react-router";

import { useI18n } from "@/i18n";
import { useAuth } from "@/components/auth/hooks/useAuth";
import { useEdsAuth } from "@/components/auth/hooks/useEdsAuth";
import { useAuthForm } from "@/components/auth/hooks/useAuthForm";
import { AuthLeftPanel } from "@/components/auth/components/AuthLeftPanel";
import { LanguageSwitcher } from "@/components/auth/components/LanguageSwitcher";
import { AuthRightPanel } from "@/components/auth/components/AuthRightPanel";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Вход — ЕСЭДО" },
      { name: "description", content: "Вход в единую систему электронного документооборота." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { loading, signIn, signUp } = useAuth();
  const { loading: edsLoading, signInWithEds } = useEdsAuth();
  const {
    mode,
    email,
    password,
    fullName,
    setEmail,
    setPassword,
    setFullName,
    switchMode,
  } = useAuthForm();

  const { locale } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === "signin") {
      await signIn(email, password);
    } else {
      await signUp(email, password, fullName, locale);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <AuthLeftPanel />
      
      <div className="flex flex-col">
        <div className="flex justify-end p-4">
          <LanguageSwitcher />
        </div>
        
        <AuthRightPanel
          mode={mode}
          email={email}
          password={password}
          fullName={fullName}
          loading={loading || edsLoading}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onFullNameChange={setFullName}
          onModeSwitch={switchMode}
          onSubmit={handleSubmit}
          onEdsAuth={() =>
            signInWithEds(mode, fullName || undefined, email || undefined, password || undefined)
          }
          edsLoading={edsLoading}
        />
      </div>
    </div>
  );
}