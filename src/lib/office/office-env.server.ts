/**
 * ONLYOFFICE Document Server runs in Docker and fetches files / callbacks on the internal network.
 */

/** Rewrite signed storage URL so Document Server reaches Kong, not browser localhost. */
export function rewriteOfficeStorageUrl(signedUrl: string): string {
  const internalBase = process.env.ONLYOFFICE_STORAGE_INTERNAL_URL?.trim().replace(/\/$/, "");
  if (!internalBase) return signedUrl;

  try {
    const src = new URL(signedUrl);
    const base = new URL(internalBase);
    return `${base.origin}${src.pathname}${src.search}`;
  } catch {
    return signedUrl;
  }
}

/** Callback URL reachable from the onlyoffice container (defaults to public app URL). */
export async function resolveOfficeCallbackBase(
  resolveAppOrigin: () => Promise<string>,
): Promise<string> {
  const internal = process.env.ONLYOFFICE_CALLBACK_BASE_URL?.trim().replace(/\/$/, "");
  if (internal) return internal;
  return (await resolveAppOrigin()).replace(/\/$/, "");
}
