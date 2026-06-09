/** Canonical RBAC permission catalog — single source of truth. */
export const ALL_PERMISSIONS = [
  "manage_users",
  "manage_org",
  "manage_license",
  "manage_platform",
  "manage_system_settings",
  "manage_integrations",
  "manage_workflows",
  "manage_templates",
  "manage_nomenclature",
  "manage_references",
  "manage_roles",
  "view_audit",
  "register_documents",
  "approve_documents",
  "sign_documents",
  "archive_documents",
  "create_documents",
  "manage_documents",
  "view_all_documents",
  "manage_knowledge_base",
  "manage_projects",
  "manage_contracts",
  "manage_hr",
  "manage_schedules",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}

/** Permissions that imply full admin access on the client (legacy admin role shortcut). */
export const ADMIN_IMPLICIT_PERMISSIONS = ALL_PERMISSIONS;
