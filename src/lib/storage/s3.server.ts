/**
 * Supabase Storage exposes an S3-compatible API.
 * Configure in project dashboard → Storage → S3 Access Keys:
 *
 *   SUPABASE_S3_ENDPOINT=https://<project-ref>.storage.supabase.co/storage/v1/s3
 *   SUPABASE_S3_REGION=auto
 *   SUPABASE_S3_ACCESS_KEY_ID=...
 *   SUPABASE_S3_SECRET_ACCESS_KEY=...
 *
 * App code uses @supabase/supabase-js (auth-aware). This module is for
 * optional server-side S3 operations when credentials are present.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import type { StorageBucket } from "./buckets";

export interface S3Config {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function getS3Config(): S3Config | null {
  const endpoint = process.env.SUPABASE_S3_ENDPOINT;
  const accessKeyId = process.env.SUPABASE_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SUPABASE_S3_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint,
    region: process.env.SUPABASE_S3_REGION ?? "auto",
    accessKeyId,
    secretAccessKey,
  };
}

/** S3 endpoint hint for external tools (no secrets). */
export function getS3PublicInfo() {
  const cfg = getS3Config();
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
