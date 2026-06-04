import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Languages } from "lucide-react";

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
  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data } = await supabase.auth.getUser();
        if (data.user) navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, locale },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        toast.success("Регистрация выполнена. Проверьте почту для подтверждения.");
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error(r.error.message || "Ошибка входа");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left panel */}
      <div className="gov-stripe hidden lg:flex flex-col justify-between p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/10 backdrop-blur rounded-sm flex items-center justify-center font-bold text-xl">
            ЕС
          </div>
          <div>
            <div className="text-xl font-semibold">{t("app.name")}</div>
            <div className="text-sm text-white/70">{t("app.tagline")}</div>
          </div>
        </div>
        <div className="space-y-6">
          <h2 className="text-3xl font-semibold leading-tight">
            Document lifecycle.<br />
            Workflow. Подпись. Архив.
          </h2>
          <div className="space-y-3 text-sm text-white/80">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Полная трассируемость: audit log на все операции.</span>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Маршруты согласования с SLA и эскалацией.</span>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Готовность к ЭЦП через NCALayer и ONLYOFFICE.</span>
            </div>
          </div>
        </div>
        <div className="text-xs text-white/50">© Enterprise EDMS Platform</div>
      </div>

      {/* Right form */}
      <div className="flex flex-col">
        <div className="flex justify-end p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocale(locale === "ru" ? "kk" : "ru")}
            className="gap-1.5"
          >
            <Languages className="w-4 h-4" />
            <span className="font-mono text-xs">{locale.toUpperCase()}</span>
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-6">
            <div>
              <h1 className="text-2xl font-semibold">
                {mode === "signin" ? t("auth.signin") : t("auth.signup")}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{t("auth.subtitle")}</p>
            </div>

            <Button onClick={handleGoogle} variant="outline" className="w-full h-10" type="button">
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {t("auth.google")}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">{t("auth.orEmail")}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label>{t("auth.fullname")}</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>{t("auth.email")}</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("auth.password")}</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("common.loading") : mode === "signin" ? t("auth.signin") : t("auth.signup")}
              </Button>
            </form>

            <div className="text-center">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? t("auth.noAccount") : t("auth.haveAccount")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
