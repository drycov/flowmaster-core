/**
 * Signed storage URLs from the Supabase JS client use SUPABASE_URL (often http://kong:8000 in Docker).
 * Browser-facing responses must use the public HTTPS origin (nginx → Kong).
 */

function publicSupabaseOrigin(): string {
  const raw =
    process.env.SUPABASE_PUBLIC_URL?.trim() ||
    process.env.VITE_SUPABASE_URL?.trim() ||
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "";
  return raw.replace(/\/$/, "");
}

/** Rewrite internal signed URL origin for browser download/preview. */
export function rewriteBrowserStorageUrl(signedUrl: string): string {
  const publicBase = publicSupabaseOrigin();
  if (!publicBase) return signedUrl;

  try {
    const src = new URL(signedUrl);
    const base = new URL(publicBase.endsWith("/") ? publicBase : `${publicBase}/`);
    return `${base.origin}${src.pathname}${src.search}`;
  } catch {
    return signedUrl;
  }
}
