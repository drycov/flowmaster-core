import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAccessTokenTtlSec } from "@/lib/auth/access-token-ttl.server";
import {
  createOpaqueSessionToken,
  getJwtSecret,
  hashSessionToken,
  signAccessToken,
} from "@/lib/auth/session.server";

export type AppSessionResult = {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string; organization_id?: string | null };
  expires_at: string;
  access_expires_in: number;
};

export async function validateActiveSession(sessionId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("app_sessions" as never)
    .select("id, expires_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) return false;

  const row = data as { id: string; expires_at: string };
  if (new Date(row.expires_at) < new Date()) {
    await supabaseAdmin
      .from("app_sessions" as never)
      .delete()
      .eq("id", sessionId);
    return false;
  }

  await supabaseAdmin
    .from("app_sessions" as never)
    .update({ last_used_at: new Date().toISOString() } as never)
    .eq("id", sessionId);

  return true;
}

export async function issueAppSession(
  userId: string,
  email: string,
  sessionTtlHours = 168,
): Promise<AppSessionResult> {
  const ttlHours = Math.min(Math.max(Math.round(sessionTtlHours), 1), 720);
  const refreshTtlSec = ttlHours * 3600;
  const accessTtlSec = getAccessTokenTtlSec();
  const opaque = createOpaqueSessionToken();
  const expiresAt = new Date(Date.now() + refreshTtlSec * 1000).toISOString();

  const { data: profileRow } = await supabaseAdmin
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();

  const organizationId =
    (profileRow as { organization_id?: string | null } | null)?.organization_id ?? null;

  const { data: sessionRow, error: sessErr } = await supabaseAdmin
    .from("app_sessions" as never)
    .insert({
      user_id: userId,
      token_hash: hashSessionToken(opaque),
      expires_at: expiresAt,
    } as never)
    .select("id")
    .single();

  if (sessErr || !sessionRow) throw new Error(sessErr?.message ?? "Failed to create session");

  const sessionId = (sessionRow as { id: string }).id;
  const access_token = signAccessToken(
    userId,
    email,
    getJwtSecret(),
    accessTtlSec,
    sessionId,
    organizationId,
  );

  return {
    access_token,
    refresh_token: opaque,
    user: { id: userId, email, organization_id: organizationId },
    expires_at: expiresAt,
    access_expires_in: accessTtlSec,
  };
}

export async function refreshAccessTokenFromOpaque(refreshToken: string) {
  const tokenHash = hashSessionToken(refreshToken);
  const { data, error } = await supabaseAdmin
    .from("app_sessions" as never)
    .select("id, user_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Invalid refresh session");
  }

  const row = data as { id: string; user_id: string; expires_at: string };
  if (new Date(row.expires_at) < new Date()) {
    await revokeAppSession(row.id);
    throw new Error("Refresh session expired");
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("email, organization_id")
    .eq("id", row.user_id)
    .maybeSingle();

  if (!profile?.email) {
    throw new Error("User not found");
  }

  const organizationId = (profile as { organization_id?: string | null }).organization_id ?? null;
  const accessTtlSec = getAccessTokenTtlSec();
  const access_token = signAccessToken(
    row.user_id,
    profile.email,
    getJwtSecret(),
    accessTtlSec,
    row.id,
    organizationId,
  );

  await supabaseAdmin
    .from("app_sessions" as never)
    .update({ last_used_at: new Date().toISOString() } as never)
    .eq("id", row.id);

  return {
    access_token,
    user: { id: row.user_id, email: profile.email, organization_id: organizationId },
    access_expires_in: accessTtlSec,
  };
}

export async function revokeAppSession(sessionId: string): Promise<void> {
  await supabaseAdmin
    .from("app_sessions" as never)
    .delete()
    .eq("id", sessionId);
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await supabaseAdmin
    .from("app_sessions" as never)
    .delete()
    .eq("user_id", userId);
}
