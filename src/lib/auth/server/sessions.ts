import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createOpaqueSessionToken,
  getJwtSecret,
  hashSessionToken,
  sessionExpiresAt,
  signAccessToken,
} from "@/lib/auth/session.server";

export async function issueAppSession(userId: string, email: string) {
  const opaque = createOpaqueSessionToken();
  const expiresAt = sessionExpiresAt();

  const { error: sessErr } = await supabaseAdmin.from("app_sessions" as never).insert({
    user_id: userId,
    token_hash: hashSessionToken(opaque),
    expires_at: expiresAt,
  } as never);

  if (sessErr) throw new Error(sessErr.message);

  const access_token = signAccessToken(userId, email, getJwtSecret());

  return {
    access_token,
    user: { id: userId, email },
    expires_at: expiresAt,
  };
}
