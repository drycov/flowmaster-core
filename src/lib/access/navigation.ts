import type { ModuleAction, ModuleId } from "./types";

export type NavItemDef = {
  id: string;
  to: string;
  labelKey: string;
  /** Module gate; omit for always-visible core items */
  moduleId?: ModuleId;
  action?: ModuleAction;
  core?: boolean;
};

export type NavGroupDef = {
  id: string;
  sectionLabelKey: string;
  collapsible?: boolean;
  /** Hide entire group when module not accessible */
  moduleId?: ModuleId;
  action?: ModuleAction;
  items: NavItemDef[];
};

export type AdminNavSectionDef = {
  key: string;
  labelKey: string;
  items: NavItemDef[];
};

export const WORK_NAV: NavItemDef[] = [
  { id: "dashboard", to: "/dashboard", labelKey: "nav.dashboard", core: true },
  { id: "documents", to: "/documents", labelKey: "nav.documents", core: true },
  { id: "tasks", to: "/tasks", labelKey: "nav.tasks", core: true },
  {
    id: "substitutions",
    to: "/substitutions",
    labelKey: "nav.substitutions",
    moduleId: "substitutions",
  },
  { id: "approvals", to: "/approvals", labelKey: "nav.approvals", core: true },
];

export const HR_NAV: NavGroupDef = {
  id: "hr",
  sectionLabelKey: "nav.sectionHr",
  collapsible: true,
  moduleId: "hr",
  items: [
    { id: "hr-leave", to: "/hr/leave", labelKey: "nav.hrLeave", moduleId: "hr" },
    {
      id: "hr-leave-schedule",
      to: "/hr/leave/schedule",
      labelKey: "nav.hrLeaveSchedule",
      moduleId: "hr",
    },
    { id: "hr-duty", to: "/hr/duty", labelKey: "nav.hrDuty", moduleId: "hr" },
    { id: "hr-timesheet", to: "/hr/timesheet", labelKey: "nav.hrTimesheet", moduleId: "hr" },
    { id: "hr-gantt", to: "/hr/gantt", labelKey: "nav.hrGantt", moduleId: "hr" },
    { id: "hr-directory", to: "/hr/directory", labelKey: "nav.hrDirectory", moduleId: "hr" },
    { id: "hr-admin", to: "/hr/admin", labelKey: "nav.hrAdmin", moduleId: "hr", action: "manage" },
  ],
};

export const CORRESPONDENCE_NAV: NavGroupDef = {
  id: "correspondence",
  sectionLabelKey: "nav.correspondence",
  collapsible: true,
  moduleId: "correspondence",
  items: [
    {
      id: "incoming",
      to: "/correspondence/incoming",
      labelKey: "nav.incoming",
      moduleId: "correspondence",
    },
    {
      id: "outgoing",
      to: "/correspondence/outgoing",
      labelKey: "nav.outgoing",
      moduleId: "correspondence",
    },
  ],
};

export const REGISTRY_NAV: NavItemDef[] = [
  { id: "knowledge", to: "/knowledge", labelKey: "nav.knowledge", moduleId: "knowledge_base" },
  { id: "projects", to: "/projects", labelKey: "nav.projects", moduleId: "projects" },
  { id: "contracts", to: "/contracts", labelKey: "nav.contracts", moduleId: "contracts" },
  {
    id: "counterparties",
    to: "/counterparties",
    labelKey: "nav.counterparties",
    moduleId: "counterparties",
  },
];

export const SERVICE_NAV: NavItemDef[] = [
  { id: "search", to: "/search", labelKey: "nav.search", core: true },
  { id: "notifications", to: "/notifications", labelKey: "nav.notifications", core: true },
  { id: "archive", to: "/archive", labelKey: "nav.archive", moduleId: "archive" },
];

export const REFERENCE_NAV: NavItemDef[] = [
  { id: "references", to: "/references", labelKey: "nav.referencesHub", moduleId: "references" },
  {
    id: "nomenclature",
    to: "/nomenclature",
    labelKey: "nav.nomenclature",
    moduleId: "nomenclature",
  },
  { id: "templates", to: "/templates", labelKey: "nav.templates", moduleId: "templates" },
  { id: "workflows", to: "/workflows", labelKey: "nav.workflows", moduleId: "workflows" },
];

export const ADMIN_NAV_SECTIONS: AdminNavSectionDef[] = [
  {
    key: "analytics",
    labelKey: "nav.sectionAnalytics",
    items: [
      {
        id: "reports",
        to: "/reports",
        labelKey: "nav.reports",
        moduleId: "reports",
        action: "read",
      },
    ],
  },
  {
    key: "access",
    labelKey: "nav.sectionAccess",
    items: [
      { id: "users", to: "/admin/users", labelKey: "nav.users", moduleId: "admin_users" },
      { id: "roles", to: "/admin/roles", labelKey: "nav.roles", moduleId: "admin_roles" },
      {
        id: "permissions",
        to: "/admin/permissions",
        labelKey: "nav.permissions",
        moduleId: "admin_roles",
        action: "manage",
      },
    ],
  },
  {
    key: "structure",
    labelKey: "nav.sectionStructure",
    items: [
      {
        id: "organization",
        to: "/admin/organization",
        labelKey: "nav.organization",
        moduleId: "admin_org",
      },
      {
        id: "departments",
        to: "/admin/departments",
        labelKey: "nav.departments",
        moduleId: "admin_org",
      },
      { id: "positions", to: "/admin/positions", labelKey: "nav.positions", moduleId: "admin_org" },
      { id: "calendar", to: "/admin/calendar", labelKey: "nav.calendar", moduleId: "admin_org" },
    ],
  },
  {
    key: "system",
    labelKey: "nav.sectionSystem",
    items: [
      { id: "audit", to: "/audit", labelKey: "nav.audit", moduleId: "audit" },
      {
        id: "monitoring",
        to: "/admin/monitoring",
        labelKey: "nav.monitoring",
        moduleId: "monitoring",
      },
      { id: "settings", to: "/admin/settings", labelKey: "nav.settings", moduleId: "admin_system" },
      {
        id: "integrations",
        to: "/admin/integrations",
        labelKey: "nav.integrations",
        moduleId: "integrations",
      },
    ],
  },
];

export function isNavItemVisible(
  item: NavItemDef,
  canModule: (moduleId: ModuleId, action?: ModuleAction) => boolean,
): boolean {
  if (item.core) return true;
  if (!item.moduleId) return true;
  return canModule(item.moduleId, item.action ?? "read");
}

export function filterNavItems(
  items: NavItemDef[],
  canModule: (moduleId: ModuleId, action?: ModuleAction) => boolean,
): NavItemDef[] {
  return items.filter((item) => isNavItemVisible(item, canModule));
}

export function filterNavGroup(
  group: NavGroupDef,
  canModule: (moduleId: ModuleId, action?: ModuleAction) => boolean,
): NavItemDef[] {
  if (group.moduleId && !canModule(group.moduleId, group.action ?? "read")) {
    return [];
  }
  return filterNavItems(group.items, canModule);
}

export function filterAdminSections(
  sections: AdminNavSectionDef[],
  canModule: (moduleId: ModuleId, action?: ModuleAction) => boolean,
): AdminNavSectionDef[] {
  return sections
    .map((section) => ({
      ...section,
      items: filterNavItems(section.items, canModule),
    }))
    .filter((section) => section.items.length > 0);
}
