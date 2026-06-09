import { refreshAccessToken } from "@/lib/api/auth.functions";
import { resetSupabaseClient } from "@/integrations/supabase/client";
import { getAccessToken, isAccessTokenExpiringSoon, setSession } from "@/lib/auth/session-storage";

let restorePromise: Promise<boolean> | null = null;

export async function tryRestoreSession(): Promise<boolean> {
  if (getAccessToken()) return true;

  if (!restorePromise) {
    restorePromise = (async () => {
      try {
        const result = await refreshAccessToken();
        if (result?.access_token && result.user) {
          setSession(result.access_token, result.user, result.access_expires_in);
          resetSupabaseClient();
          return true;
        }
      } catch {
        /* no valid refresh cookie */
      }
      return false;
    })().finally(() => {
      restorePromise = null;
    });
  }

  return restorePromise;
}

export async function refreshSessionIfNeeded(): Promise<boolean> {
  if (!getAccessToken() && !(await tryRestoreSession())) {
    return false;
  }
  if (!isAccessTokenExpiringSoon()) {
    return true;
  }

  try {
    const result = await refreshAccessToken();
    if (result?.access_token && result.user) {
      setSession(result.access_token, result.user, result.access_expires_in);
      resetSupabaseClient();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
