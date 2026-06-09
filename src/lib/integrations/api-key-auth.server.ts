import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ApiKeyScope } from "@/lib/integrations/constants";

export type { ApiKeyScope } from "@/lib/integrations/constants";

export type ApiKeyContext = {
  keyId: string;
  userId: string;
  scopes: ApiKeyScope[];
};

export function generateApiKeyMaterial() {
  const raw = `fm_${randomBytes(32).toString("base64url")}`;
  const hash = hashApiKey(raw);
  const prefix = raw.slice(0, 14);
  return { raw, hash, prefix };
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return request.headers.get("x-api-key")?.trim() ?? null;
}

export async function authenticateApiKey(request: Request): Promise<ApiKeyContext | null> {
  const token = extractBearerToken(request);
  if (!token || !token.startsWith("fm_")) return null;

  const hash = hashApiKey(token);
  const { data: row, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, created_by, scopes, expires_at, is_active")
    .eq("key_hash", hash)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !row) return null;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;

  void supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() } as never)
    .eq("id", row.id);

  return {
    keyId: row.id,
    userId: row.created_by,
    scopes: (row.scopes ?? []) as ApiKeyScope[],
  };
}

export function requireScope(ctx: ApiKeyContext, scope: ApiKeyScope): boolean {
  return ctx.scopes.includes(scope);
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function apiError(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}
