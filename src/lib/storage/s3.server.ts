/**
 * Supabase Storage exposes an S3-compatible API.
 * Keys: Supabase Dashboard → Storage → S3 Access Keys.
 * Values are stored in organization settings (Администрирование → Настройки → Интеграции).
 *
 * App code uses @supabase/supabase-js (auth-aware). This module is for
 * optional server-side S3 operations when credentials are present.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadSystemSettings } from "@/lib/auth/policy";
import type { Database } from "@/integrations/supabase/types";
import type { StorageBucket } from "./buckets";

export interface S3Config {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export async function getS3Config(): Promise<S3Config | null> {
  const settings = await loadSystemSettings();
  const s3 = settings.integrations;
  const endpoint = s3.s3_endpoint.trim();
  const accessKeyId = s3.s3_access_key_id.trim();
  const secretAccessKey = s3.s3_secret_access_key.trim();
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint,
    region: s3.s3_region || "auto",
    accessKeyId,
    secretAccessKey,
  };
}

/** S3 endpoint hint for external tools (no secrets). */
export async function getS3PublicInfo() {
  const cfg = await getS3Config();
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  return {
    configured: Boolean(cfg),
    endpoint:
      cfg?.endpoint ??
      (projectRef
        ? `https://${projectRef}.storage.supabase.co/storage/v1/s3`
        : null),
    region: cfg?.region ?? "auto",
    buckets: ["avatars", "documents", "templates", "signatures"] as StorageBucket[],
  };
}

/** Signed download URL via Supabase API (respects storage RLS with user JWT). */
export async function createSignedDownloadUrl(
  supabase: SupabaseClient<Database>,
  bucket: StorageBucket,
  path: string,
  expiresInSeconds = 3600,
) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** Service-role signed URL (bypasses RLS — trusted server only). */
export async function createAdminSignedDownloadUrl(
  bucket: StorageBucket,
  path: string,
  expiresInSeconds = 3600,
) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
