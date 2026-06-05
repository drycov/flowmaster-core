import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    
    const { data } = await supabase.auth.getSession();
    
    if (data.session) {
      throw redirect({ to: "/dashboard" });
    }
    
    throw redirect({ to: "/auth" });
  },
  component: RootRedirect,
});

function RootRedirect() {
  const [message, setMessage] = useState("Перенаправление...");

  useEffect(() => {
    const checkAndRedirect = async () => {
      const { data } = await supabase.auth.getSession();
      
      if (data.session) {
        setMessage("Вход выполнен, перенаправление в систему...");
        window.location.href = "/dashboard";
      } else {
        setMessage("Перенаправление на страницу входа...");
        window.location.href = "/auth";
      }
    };

    checkAndRedirect();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}