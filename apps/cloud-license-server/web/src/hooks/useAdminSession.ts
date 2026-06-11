import { useCallback, useEffect, useState } from "react";
import { fetchAdminSession, type AdminSession } from "../lib/admin-api";

export function useAdminSession() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setSession(await fetchAdminSession());
    } catch {
      setSession({ configured: false, authenticated: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { session, loading, refresh };
}
