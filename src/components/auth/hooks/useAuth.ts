import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

interface UseAuthReturn {
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, locale: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { locale } = useI18n();

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        toast.success("Вход выполнен успешно");
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка входа";
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, locale: string) => {
    setLoading(true);
    try {
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка регистрации";
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { 
        redirect_uri: window.location.origin 
      });
      if (result.error) throw new Error(result.error.message || "Ошибка входа");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка входа через Google";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    signIn,
    signUp,
    signInWithGoogle,
  };
}