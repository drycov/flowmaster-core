/**
 * Signed storage URLs from Supabase JS use SUPABASE_URL (http://kong:8000 in Docker).
 * Browser-facing URLs must use the public HTTPS origin (nginx → Kong).
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

function isInternalStorageHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "kong" || h === "localhost" || h === "127.0.0.1" || h === "db";
}

/** Rewrite internal signed URL origin for browser download/preview. */
export function rewriteBrowserStorageUrl(signedUrl: string): string {
  try {
    const src = new URL(signedUrl);
    if (!isInternalStorageHost(src.hostname)) {
      return signedUrl;
    }

    const publicBase = publicSupabaseOrigin();
    if (!publicBase) {
      return signedUrl;
    }

    const base = new URL(publicBase.endsWith("/") ? publicBase : `${publicBase}/`);
    return `${base.origin}${src.pathname}${src.search}`;
  } catch {
    return signedUrl;
  }
}
