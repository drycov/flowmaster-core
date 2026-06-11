/** JSON-safe ONLYOFFICE editor config (serializable over server functions). */
export type OfficeJsonPrimitive = string | number | boolean | null;

export type OfficeJsonValue =
  | OfficeJsonPrimitive
  | OfficeJsonValue[]
  | { [key: string]: OfficeJsonValue };

export type OnlyOfficeEditorConfig = { [key: string]: OfficeJsonValue };
