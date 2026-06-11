import type { LicenseFeature, LicenseStatusResponse } from "@/lib/license/types";
import type { Permission } from "./permissions";

/** Product module identifier — maps RBAC permissions to license features. */
export const MODULE_IDS = [
  "core",
  "documents",
  "tasks",
  "reports",
  "approvals",
  "correspondence",
  "substitutions",
  "workflows",
  "templates",
  "eds_signing",
  "office",
  "monitoring",
  "archive",
  "references",
  "nomenclature",
  "audit",
  "knowledge_base",
  "projects",
  "contracts",
  "counterparties",
  "hr",
  "integrations",
  "admin_users",
  "admin_roles",
  "admin_org",
  "admin_license",
  "admin_platform",
  "admin_system",
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export type ModuleAction = "read" | "write" | "manage";

export type ModuleTier = "core" | "licensed" | "admin" | "platform";

export type ModuleRouteGuard = {
  /** Route path prefix(es) protected by this module. */
  paths: string[];
  /** Minimum action required to enter the route. */
  action?: ModuleAction;
};

export type ModuleDefinition = {
  id: ModuleId;
  tier: ModuleTier;
  /** License feature flag; omitted for always-on core/admin modules. */
  licenseFeature?: LicenseFeature;
  /** RBAC permissions per action; empty = authenticated user only. */
  permissions: Partial<Record<ModuleAction, readonly Permission[]>>;
  /** Whether writes require a writable license (default true for licensed modules). */
  requireWritableForWrite?: boolean;
  routes?: ModuleRouteGuard;
  /** SaaS: module can be toggled per-tenant independently of plan (future). */
  tenantConfigurable?: boolean;
};

export type UserAccessSnapshot = {
  roles: string[];
  permissions: Partial<Record<Permission, boolean>>;
};

export type ModuleAccessContext = {
  user: UserAccessSnapshot;
  license: LicenseStatusResponse | undefined;
  /** Resolved tenant scope (single org today; multi-tenant ready). */
  tenantId: string | null;
};

export type ModuleAccessResult = {
  allowed: boolean;
  reason?: "permission" | "license" | "writable";
};
