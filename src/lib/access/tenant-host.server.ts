const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "admin", "mail", "cdn"]);

/** Parse tenant slug from Host header (e.g. acme.flowmaster.kz → acme). */
export function parseTenantSlugFromHost(
  hostHeader: string | null | undefined,
  baseDomain?: string | null,
): string | null {
  if (!hostHeader) return null;

  const host = hostHeader.split(":")[0]?.trim().toLowerCase();
  if (!host || host === "localhost" || host === "127.0.0.1") return null;

  const configuredBase = baseDomain?.trim().toLowerCase().replace(/^\./, "");
  if (configuredBase) {
    const suffix = `.${configuredBase}`;
    if (host === configuredBase) return null;
    if (host.endsWith(suffix)) {
      const subdomain = host.slice(0, -suffix.length);
      const slug = subdomain.split(".").pop();
      if (slug && !RESERVED_SUBDOMAINS.has(slug)) return slug;
    }
    return null;
  }

  const parts = host.split(".");
  if (parts.length >= 3) {
    const slug = parts[0];
    if (slug && !RESERVED_SUBDOMAINS.has(slug)) return slug;
  }

  return null;
}

export function getTenantBaseDomain(): string | null {
  const raw =
    process.env.TENANT_BASE_DOMAIN?.trim() ||
    process.env.APP_BASE_DOMAIN?.trim() ||
    null;
  return raw || null;
}
