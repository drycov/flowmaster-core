/** Shared row shape for reference brief list endpoints. */
export type ReferenceBriefRow = {
  id: string;
  code: string;
  name_ru: string;
  name_kk: string;
  bin?: string | null;
  sla_hours?: number | null;
  color?: string | null;
  prefix?: string | null;
  document_type_id?: string | null;
  years?: number | null;
  is_permanent?: boolean | null;
  level_order?: number | null;
  parent_id?: string | null;
};

export type ReferenceCatalogRow = {
  id?: string;
  code?: string;
  name_ru?: string;
  name_kk?: string;
  [key: string]: string | number | boolean | null | undefined | ReferenceCatalogRow | Array<string | number | boolean | null>;
};
