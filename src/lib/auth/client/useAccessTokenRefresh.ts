import { useEffect } from "react";
import { refreshSessionIfNeeded } from "@/lib/auth/client/session-restore";
import { isAuthenticated } from "@/lib/auth/session-storage";

/** Proactively refresh short-lived access tokens using HttpOnly refresh cookie. */
export function useAccessTokenRefresh() {
  useEffect(() => {
    if (!isAuthenticated()) return;

    const tick = () => {
      void refreshSessionIfNeeded();
    };

    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
}
