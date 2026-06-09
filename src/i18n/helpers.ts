import type { TFunction } from "./index";

const ROLE_KEYS: Record<string, string> = {
  admin: "roles.admin",
  platform_admin: "roles.platformAdmin",
  registrar: "roles.registrar",
  approver: "roles.approver",
  signer: "roles.signer",
  archivist: "roles.archivist",
  viewer: "roles.viewer",
};

const AUDIT_ENTITY_KEYS: Record<string, string> = {
  organization: "audit.entity.organization",
  department: "audit.entity.department",
  departments: "audit.entity.departments",
  position: "audit.entity.position",
  positions: "audit.entity.positions",
  user: "audit.entity.user",
  profile: "audit.entity.user",
  profiles: "audit.entity.profiles",
  document: "audit.entity.document",
  workflow: "audit.entity.workflow",
  workflows: "audit.entity.workflows",
  template: "audit.entity.template",
  document_templates: "audit.entity.document_templates",
  role_definitions: "audit.entity.role_definitions",
  roles: "audit.entity.roles",
  role_permissions: "audit.entity.role_permissions",
  user_role_grants: "audit.entity.user_role_grants",
  user_roles: "audit.entity.user_roles",
  profile_assignments: "audit.entity.profile_assignments",
  workflow_task: "audit.entity.workflow_task",
};

const AUDIT_ACTION_KEYS: Record<string, string> = {
  create: "audit.action.create",
  insert: "audit.action.create",
  update: "audit.action.update",
  delete: "audit.action.delete",
};

export function roleLabel(t: TFunction, role: string): string {
  const key = ROLE_KEYS[role];
  return key ? t(key) : role;
}

export function auditEntityLabel(t: TFunction, entity: string): string {
  const key = AUDIT_ENTITY_KEYS[entity.toLowerCase()];
  return key ? t(key) : entity;
}

export function auditActionLabel(t: TFunction, action: string): string {
  const upperKey = `audit.action.${action}`;
  if (t(upperKey) !== upperKey) {
    return t(upperKey);
  }
  const key = AUDIT_ACTION_KEYS[action.toLowerCase()];
  return key ? t(key) : action;
}

export function workflowNodeLabel(t: TFunction, nodeType: string): string {
  return t(`wf.node.${nodeType}`) !== `wf.node.${nodeType}`
    ? t(`wf.node.${nodeType}`)
    : nodeType;
}

export function interpolate(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template,
  );
}
