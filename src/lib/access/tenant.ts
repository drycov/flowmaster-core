import { getTenantContext } from "@/lib/api/tenant.functions";

/** Deployment mode — drives feature resolution strategy. */
export type TenantContext = {
  /** Stable tenant identifier; null when unresolved. */
  id: string | null;
  /** Human-readable tenant name for UI/diagnostics. */
  name: string | null;
  /** Deployment mode — drives feature resolution strategy. */
  mode: "single" | "multi";
};

const SINGLE_TENANT_FALLBACK: TenantContext = {
  id: "default",
  name: null,
  mode: "single",
};

/** Resolve current tenant (loads organization row from DB). */
export async function resolveTenantContext(): Promise<TenantContext> {
  try {
    return await getTenantContext();
  } catch {
    return SINGLE_TENANT_FALLBACK;
  }
}

/** Scope key for React Query / cache namespaces in multi-tenant mode. */
export function tenantScopeKey(tenant: TenantContext): string {
  return tenant.id ?? "default";
}
