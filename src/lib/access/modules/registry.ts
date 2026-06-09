import type { ModuleAction, ModuleDefinition, ModuleId } from "../types";

const P = {
  manage_users: "manage_users",
  manage_org: "manage_org",
  manage_license: "manage_license",
  manage_platform: "manage_platform",
  manage_system_settings: "manage_system_settings",
  manage_integrations: "manage_integrations",
  manage_workflows: "manage_workflows",
  manage_templates: "manage_templates",
  manage_nomenclature: "manage_nomenclature",
  manage_references: "manage_references",
  manage_roles: "manage_roles",
  view_audit: "view_audit",
  register_documents: "register_documents",
  approve_documents: "approve_documents",
  sign_documents: "sign_documents",
  archive_documents: "archive_documents",
  create_documents: "create_documents",
  manage_documents: "manage_documents",
  view_all_documents: "view_all_documents",
  manage_knowledge_base: "manage_knowledge_base",
  manage_projects: "manage_projects",
  manage_contracts: "manage_contracts",
  manage_hr: "manage_hr",
  manage_schedules: "manage_schedules",
} as const;

/** Product module catalog — binds routes, RBAC permissions, and license features. */
export const MODULE_REGISTRY: Record<ModuleId, ModuleDefinition> = {
  core: {
    id: "core",
    tier: "core",
    permissions: {},
    routes: { paths: ["/dashboard", "/profile", "/help"] },
  },

  documents: {
    id: "documents",
    tier: "core",
    permissions: {
      read: [],
      write: [P.create_documents, P.register_documents, P.manage_documents],
      manage: [P.manage_documents],
    },
    requireWritableForWrite: true,
    routes: { paths: ["/documents"] },
  },

  tasks: {
    id: "tasks",
    tier: "core",
    permissions: { read: [] },
    routes: { paths: ["/tasks"] },
  },

  reports: {
    id: "reports",
    tier: "core",
    permissions: {
      read: [P.view_all_documents],
      manage: [P.view_all_documents],
    },
    routes: { paths: ["/reports"], action: "read" },
  },

  approvals: {
    id: "approvals",
    tier: "core",
    permissions: {
      read: [],
      write: [P.approve_documents, P.sign_documents],
    },
    requireWritableForWrite: true,
    routes: { paths: ["/approvals"] },
  },

  correspondence: {
    id: "correspondence",
    tier: "licensed",
    licenseFeature: "correspondence",
    permissions: {
      read: [],
      write: [P.register_documents, P.create_documents, P.manage_documents],
    },
    routes: { paths: ["/correspondence"] },
  },

  substitutions: {
    id: "substitutions",
    tier: "licensed",
    licenseFeature: "substitutions",
    permissions: {
      read: [],
      write: [],
      manage: [P.manage_org],
    },
    routes: { paths: ["/substitutions"] },
  },

  workflows: {
    id: "workflows",
    tier: "licensed",
    licenseFeature: "workflows",
    permissions: {
      read: [],
      write: [P.manage_workflows],
      manage: [P.manage_workflows],
    },
    routes: { paths: ["/workflows"], action: "read" },
  },

  templates: {
    id: "templates",
    tier: "licensed",
    licenseFeature: "templates",
    permissions: {
      read: [P.manage_templates],
      write: [P.manage_templates],
      manage: [P.manage_templates],
    },
    routes: { paths: ["/templates"], action: "read" },
  },

  eds_signing: {
    id: "eds_signing",
    tier: "licensed",
    licenseFeature: "eds_signing",
    permissions: {
      write: [P.sign_documents],
    },
  },

  archive: {
    id: "archive",
    tier: "licensed",
    licenseFeature: "archive",
    permissions: {
      read: [],
      write: [P.archive_documents, P.manage_documents],
    },
    routes: { paths: ["/archive"], action: "read" },
  },

  references: {
    id: "references",
    tier: "licensed",
    licenseFeature: "references",
    permissions: {
      read: [],
      write: [P.manage_references],
      manage: [P.manage_references],
    },
    routes: { paths: ["/references"], action: "read" },
  },

  nomenclature: {
    id: "nomenclature",
    tier: "licensed",
    licenseFeature: "nomenclature",
    permissions: {
      read: [],
      write: [P.manage_nomenclature],
      manage: [P.manage_nomenclature],
    },
    routes: { paths: ["/nomenclature"], action: "read" },
  },

  audit: {
    id: "audit",
    tier: "licensed",
    licenseFeature: "audit",
    permissions: {
      read: [P.view_audit],
      manage: [P.view_audit],
    },
    routes: { paths: ["/audit"], action: "read" },
  },

  knowledge_base: {
    id: "knowledge_base",
    tier: "licensed",
    licenseFeature: "knowledge_base",
    permissions: {
      read: [],
      write: [P.manage_knowledge_base],
      manage: [P.manage_knowledge_base],
    },
    routes: { paths: ["/knowledge"], action: "read" },
  },

  projects: {
    id: "projects",
    tier: "licensed",
    licenseFeature: "projects",
    permissions: {
      read: [],
      write: [P.manage_projects, P.manage_documents],
      manage: [P.manage_projects, P.manage_documents],
    },
    routes: { paths: ["/projects"], action: "read" },
  },

  contracts: {
    id: "contracts",
    tier: "licensed",
    licenseFeature: "contracts",
    permissions: {
      read: [],
      write: [P.manage_contracts, P.manage_documents],
      manage: [P.manage_contracts, P.manage_documents],
    },
    routes: { paths: ["/contracts"], action: "read" },
  },

  counterparties: {
    id: "counterparties",
    tier: "licensed",
    licenseFeature: "counterparties",
    permissions: {
      read: [],
      write: [P.manage_documents, P.manage_contracts],
    },
    routes: { paths: ["/counterparties"], action: "read" },
  },

  hr: {
    id: "hr",
    tier: "licensed",
    licenseFeature: "hr",
    permissions: {
      read: [],
      write: [],
      manage: [P.manage_hr, P.manage_schedules],
    },
    routes: { paths: ["/hr"], action: "read" },
  },

  integrations: {
    id: "integrations",
    tier: "licensed",
    licenseFeature: "integrations",
    permissions: {
      read: [P.manage_integrations, P.manage_license],
      manage: [P.manage_integrations, P.manage_license],
    },
    routes: { paths: ["/admin/integrations"], action: "read" },
  },

  admin_users: {
    id: "admin_users",
    tier: "admin",
    permissions: {
      read: [P.manage_users],
      write: [P.manage_users],
      manage: [P.manage_users],
    },
    routes: { paths: ["/admin/users"], action: "read" },
  },

  admin_roles: {
    id: "admin_roles",
    tier: "admin",
    permissions: {
      read: [P.manage_users, P.manage_roles],
      manage: [P.manage_roles],
    },
    routes: { paths: ["/admin/roles", "/admin/permissions"], action: "read" },
  },

  admin_org: {
    id: "admin_org",
    tier: "admin",
    permissions: {
      read: [P.manage_org],
      write: [P.manage_org],
      manage: [P.manage_org],
    },
    routes: {
      paths: ["/admin/organization", "/admin/departments", "/admin/positions", "/admin/calendar"],
      action: "read",
    },
  },

  admin_license: {
    id: "admin_license",
    tier: "admin",
    permissions: {
      read: [P.manage_license],
      write: [P.manage_license],
      manage: [P.manage_license],
    },
    routes: { paths: ["/admin/license"], action: "read" },
  },

  admin_platform: {
    id: "admin_platform",
    tier: "platform",
    permissions: {
      read: [P.manage_platform],
      write: [P.manage_platform],
      manage: [P.manage_platform],
    },
    tenantConfigurable: false,
  },

  admin_system: {
    id: "admin_system",
    tier: "admin",
    permissions: {
      read: [P.manage_system_settings, P.manage_license],
      write: [P.manage_system_settings, P.manage_license],
      manage: [P.manage_system_settings, P.manage_license],
    },
    routes: { paths: ["/admin/settings"], action: "read" },
  },
};

export function getModule(id: ModuleId): ModuleDefinition {
  return MODULE_REGISTRY[id];
}

export function findModuleByPath(
  path: string,
): { module: ModuleDefinition; action: ModuleAction } | null {
  let best: { module: ModuleDefinition; action: ModuleAction; len: number } | null = null;
  for (const mod of Object.values(MODULE_REGISTRY)) {
    if (!mod.routes) continue;
    for (const prefix of mod.routes.paths) {
      if (path === prefix || path.startsWith(prefix + "/")) {
        const len = prefix.length;
        if (!best || len > best.len) {
          best = { module: mod, action: mod.routes.action ?? "read", len };
        }
      }
    }
  }
  return best ? { module: best.module, action: best.action } : null;
}

export function listLicensedModules(): ModuleDefinition[] {
  return Object.values(MODULE_REGISTRY).filter((m) => m.licenseFeature);
}

export function listAdminModules(): ModuleDefinition[] {
  return Object.values(MODULE_REGISTRY).filter((m) => m.tier === "admin");
}
