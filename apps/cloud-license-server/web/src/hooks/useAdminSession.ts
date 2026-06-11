import { useCallback, useEffect, useState } from "react";
import { fetchAdminSession, type AdminSession } from "../lib/admin-api";
import { supabase } from "../lib/supabase";

export function useAdminSession() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setSession(await fetchAdminSession());
    } catch {
      setSession({
        configured: false,
        authenticated: false,
        identity: null,
        step: "none",
        verify: { required: false, telegram: false, webhook: false },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  return { session, loading, refresh };
}
