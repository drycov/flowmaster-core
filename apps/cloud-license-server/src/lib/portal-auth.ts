import { createClient } from "@supabase/supabase-js";

export type PortalUser = {
  id: string;
  email: string;
};

export async function getPortalUserFromRequest(
  authorization: string | undefined,
): Promise<PortalUser | null> {
  if (!authorization?.startsWith("Bearer ")) return null;

  const url = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;

  const token = authorization.slice(7);
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user?.email) return null;

  return { id: data.user.id, email: data.user.email };
}
