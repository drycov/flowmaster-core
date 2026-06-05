import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "./hooks/useAuth";
import { useAuthForm } from "./hooks/useAuthForm";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { AuthLeftPanel } from "./components/AuthLeftPanel";
import { AuthRightPanel } from "./components/AuthRightPanel";
import { useI18n } from "@/lib/i18n";

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
  const { loading, signIn, signUp, signInWithGoogle } = useAuth();
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
      if (!loading) {
        switchMode();
      }
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
          loading={loading}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onFullNameChange={setFullName}
          onModeSwitch={switchMode}
          onSubmit={handleSubmit}
          onGoogleSignIn={signInWithGoogle}
        />
      </div>
    </div>
  );
}