export type RefFieldType =
  | "code"
  | "name"
  | "description"
  | "sort_order"
  | "is_active"
  | "text"
  | "number"
  | "boolean"
  | "select_document_type"
  | "select_department"
  | "select_parent_location"
  | "years"
  | "is_permanent"
  | "level_order"
  | "sla_hours"
  | "color"
  | "prefix";

export type RefFieldDef = {
  key: string;
  type: RefFieldType;
  required?: boolean;
  list?: boolean;
  width?: "sm" | "md" | "lg";
};

export type RefCatalogDef = {
  id: string;
  table: string;
  titleKey: string;
  descriptionKey: string;
  icon: string;
  fields: RefFieldDef[];
  orderBy?: { column: string; ascending?: boolean }[];
};

export const REFERENCE_CATALOGS: RefCatalogDef[] = [
  {
    id: "document-types",
    table: "ref_document_types",
    titleKey: "ref.documentTypes",
    descriptionKey: "ref.documentTypesDesc",
    icon: "FileText",
    fields: [
      { key: "code", type: "code", required: true, list: true, width: "sm" },
      { key: "name_ru", type: "name", required: true, list: true },
      { key: "name_kk", type: "name", required: true },
      { key: "description_ru", type: "description" },
      { key: "description_kk", type: "description" },
      { key: "sort_order", type: "sort_order", list: true, width: "sm" },
      { key: "is_active", type: "is_active", list: true, width: "sm" },
    ],
    orderBy: [{ column: "sort_order" }, { column: "code" }],
  },
  {
    id: "template-categories",
    table: "ref_template_categories",
    titleKey: "ref.templateCategories",
    descriptionKey: "ref.templateCategoriesDesc",
    icon: "Layers",
    fields: [
      { key: "code", type: "code", required: true, list: true, width: "sm" },
      { key: "name_ru", type: "name", required: true, list: true },
      { key: "name_kk", type: "name", required: true },
      { key: "sort_order", type: "sort_order", list: true, width: "sm" },
      { key: "is_active", type: "is_active", list: true, width: "sm" },
    ],
    orderBy: [{ column: "sort_order" }, { column: "code" }],
  },
  {
    id: "correspondents",
    table: "ref_correspondents",
    titleKey: "ref.correspondents",
    descriptionKey: "ref.correspondentsDesc",
    icon: "Building",
    fields: [
      { key: "code", type: "code", required: true, list: true, width: "sm" },
      { key: "name_ru", type: "name", required: true, list: true },
      { key: "name_kk", type: "name", required: true },
      { key: "correspondent_type", type: "text", list: true, width: "sm" },
      { key: "bin", type: "text", list: true, width: "sm" },
      { key: "external_id", type: "text" },
      { key: "contact_person", type: "text", list: true },
      { key: "phone", type: "text", list: true, width: "sm" },
      { key: "email", type: "text" },
      { key: "address_ru", type: "text" },
      { key: "address_kk", type: "text" },
      { key: "bank_name", type: "text" },
      { key: "bank_account", type: "text" },
      { key: "bik", type: "text", width: "sm" },
      { key: "iik", type: "text", width: "sm" },
      { key: "kbe", type: "text", width: "sm" },
      { key: "notes", type: "text" },
      { key: "is_active", type: "is_active", list: true, width: "sm" },
    ],
    orderBy: [{ column: "name_ru" }],
  },
  {
    id: "delivery-methods",
    table: "ref_delivery_methods",
    titleKey: "ref.deliveryMethods",
    descriptionKey: "ref.deliveryMethodsDesc",
    icon: "Truck",
    fields: [
      { key: "code", type: "code", required: true, list: true, width: "sm" },
      { key: "name_ru", type: "name", required: true, list: true },
      { key: "name_kk", type: "name", required: true },
      { key: "sort_order", type: "sort_order", list: true, width: "sm" },
      { key: "is_active", type: "is_active", list: true, width: "sm" },
    ],
    orderBy: [{ column: "sort_order" }],
  },
  {
    id: "access-levels",
    table: "ref_access_levels",
    titleKey: "ref.accessLevels",
    descriptionKey: "ref.accessLevelsDesc",
    icon: "Shield",
    fields: [
      { key: "code", type: "code", required: true, list: true, width: "sm" },
      { key: "name_ru", type: "name", required: true, list: true },
      { key: "name_kk", type: "name", required: true },
      { key: "level_order", type: "level_order", list: true, width: "sm" },
      { key: "sort_order", type: "sort_order", list: true, width: "sm" },
      { key: "is_active", type: "is_active", list: true, width: "sm" },
    ],
    orderBy: [{ column: "level_order" }],
  },
  {
    id: "priorities",
    table: "ref_priorities",
    titleKey: "ref.priorities",
    descriptionKey: "ref.prioritiesDesc",
    icon: "Zap",
    fields: [
      { key: "code", type: "code", required: true, list: true, width: "sm" },
      { key: "name_ru", type: "name", required: true, list: true },
      { key: "name_kk", type: "name", required: true },
      { key: "sla_hours", type: "sla_hours", list: true, width: "sm" },
      { key: "color", type: "color" },
      { key: "sort_order", type: "sort_order", list: true, width: "sm" },
      { key: "is_active", type: "is_active", list: true, width: "sm" },
    ],
    orderBy: [{ column: "sort_order" }],
  },
  {
    id: "retention-periods",
    table: "ref_retention_periods",
    titleKey: "ref.retentionPeriods",
    descriptionKey: "ref.retentionPeriodsDesc",
    icon: "Clock",
    fields: [
      { key: "code", type: "code", required: true, list: true, width: "sm" },
      { key: "name_ru", type: "name", required: true, list: true },
      { key: "name_kk", type: "name", required: true },
      { key: "years", type: "years", list: true, width: "sm" },
      { key: "is_permanent", type: "is_permanent", list: true, width: "sm" },
      { key: "sort_order", type: "sort_order", list: true, width: "sm" },
      { key: "is_active", type: "is_active", list: true, width: "sm" },
    ],
    orderBy: [{ column: "sort_order" }],
  },
  {
    id: "registration-journals",
    table: "ref_registration_journals",
    titleKey: "ref.registrationJournals",
    descriptionKey: "ref.registrationJournalsDesc",
    icon: "BookOpen",
    fields: [
      { key: "code", type: "code", required: true, list: true, width: "sm" },
      { key: "name_ru", type: "name", required: true, list: true },
      { key: "name_kk", type: "name", required: true },
      { key: "prefix", type: "prefix", list: true, width: "sm" },
      { key: "document_type_id", type: "select_document_type", list: true },
      { key: "department_id", type: "select_department" },
      { key: "sort_order", type: "sort_order", list: true, width: "sm" },
      { key: "is_active", type: "is_active", list: true, width: "sm" },
    ],
    orderBy: [{ column: "sort_order" }],
  },
  {
    id: "archive-locations",
    table: "ref_archive_locations",
    titleKey: "ref.archiveLocations",
    descriptionKey: "ref.archiveLocationsDesc",
    icon: "Archive",
    fields: [
      { key: "code", type: "code", required: true, list: true, width: "sm" },
      { key: "name_ru", type: "name", required: true, list: true },
      { key: "name_kk", type: "name", required: true },
      { key: "parent_id", type: "select_parent_location" },
      { key: "address_ru", type: "text" },
      { key: "address_kk", type: "text" },
      { key: "sort_order", type: "sort_order", list: true, width: "sm" },
      { key: "is_active", type: "is_active", list: true, width: "sm" },
    ],
    orderBy: [{ column: "sort_order" }, { column: "code" }],
  },
  {
    id: "department-kinds",
    table: "ref_department_kinds",
    titleKey: "ref.departmentKinds",
    descriptionKey: "ref.departmentKindsDesc",
    icon: "Network",
    fields: [
      { key: "code", type: "code", required: true, list: true, width: "sm" },
      { key: "name_ru", type: "name", required: true, list: true },
      { key: "name_kk", type: "name", required: true },
      { key: "sort_order", type: "sort_order", list: true, width: "sm" },
      { key: "is_active", type: "is_active", list: true, width: "sm" },
    ],
    orderBy: [{ column: "sort_order" }],
  },
  {
    id: "rejection-reasons",
    table: "ref_rejection_reasons",
    titleKey: "ref.rejectionReasons",
    descriptionKey: "ref.rejectionReasonsDesc",
    icon: "XCircle",
    fields: [
      { key: "code", type: "code", required: true, list: true, width: "sm" },
      { key: "name_ru", type: "name", required: true, list: true },
      { key: "name_kk", type: "name", required: true },
      { key: "sort_order", type: "sort_order", list: true, width: "sm" },
      { key: "is_active", type: "is_active", list: true, width: "sm" },
    ],
    orderBy: [{ column: "sort_order" }],
  },
  {
    id: "document-link-types",
    table: "ref_document_link_types",
    titleKey: "ref.documentLinkTypes",
    descriptionKey: "ref.documentLinkTypesDesc",
    icon: "Link",
    fields: [
      { key: "code", type: "code", required: true, list: true, width: "sm" },
      { key: "name_ru", type: "name", required: true, list: true },
      { key: "name_kk", type: "name", required: true },
      { key: "sort_order", type: "sort_order", list: true, width: "sm" },
      { key: "is_active", type: "is_active", list: true, width: "sm" },
    ],
    orderBy: [{ column: "sort_order" }],
  },
];

const catalogById = new Map(REFERENCE_CATALOGS.map((c) => [c.id, c]));
const catalogByTable = new Map(REFERENCE_CATALOGS.map((c) => [c.table, c]));

export function getCatalogById(id: string): RefCatalogDef | undefined {
  return catalogById.get(id);
}

export function getCatalogByTable(table: string): RefCatalogDef | undefined {
  return catalogByTable.get(table);
}

export const REFERENCE_TABLES = REFERENCE_CATALOGS.map((c) => c.table);

/** External справочники with dedicated pages */
export type ExternalReferenceLink = {
  to: string;
  titleKey: string;
  descriptionKey: string;
  icon: string;
  permission?: string;
};

export const EXTERNAL_REFERENCE_LINKS: ExternalReferenceLink[] = [
  {
    to: "/nomenclature",
    titleKey: "nav.nomenclature",
    descriptionKey: "ref.nomenclatureDesc",
    icon: "Library",
  },
  {
    to: "/templates",
    titleKey: "nav.templates",
    descriptionKey: "ref.templatesDesc",
    icon: "FilePlus2",
  },
  {
    to: "/workflows",
    titleKey: "nav.workflows",
    descriptionKey: "ref.workflowsDesc",
    icon: "GitBranch",
  },
  {
    to: "/admin/positions",
    titleKey: "nav.positions",
    descriptionKey: "ref.positionsDesc",
    icon: "Settings",
    permission: "manage_org",
  },
];
