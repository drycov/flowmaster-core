export const ALL_PERMISSIONS = [
  "manage_users",
  "manage_org",
  "manage_license",
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
  "view_all_documents",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}
