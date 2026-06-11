export const TEMPLATE_FILE_EXTENSIONS = ["doc", "docx", "xls", "xlsx"] as const;

export type TemplateFileFormat = (typeof TEMPLATE_FILE_EXTENSIONS)[number];

const MIME_BY_EXT: Record<TemplateFileFormat, string> = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function detectTemplateFormat(filename: string): TemplateFileFormat | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return (TEMPLATE_FILE_EXTENSIONS as readonly string[]).includes(ext)
    ? (ext as TemplateFileFormat)
    : null;
}

export function templateMimeType(format: TemplateFileFormat): string {
  return MIME_BY_EXT[format];
}

/** DOCX/XLSX — scan placeholders and generate filled files. */
export function supportsTemplateProcessing(format: string | null | undefined): boolean {
  return format === "docx" || format === "xlsx";
}

export function formatLabel(format: string | null | undefined): string {
  if (!format) return "—";
  return format.toUpperCase();
}

export const PLACEHOLDER_PATTERN = /\{\{([a-zA-Z0-9_\u0400-\u04FF]+)\}\}/g;

export type TemplateFieldDef = {
  key: string;
  label_ru: string;
  label_kk: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "user";
  required?: boolean;
  options?: string[];
  /** user — manual input; author/signatory/organization/system — auto-filled */
  source?: "user" | "author" | "signatory" | "organization" | "system";
};

export function extractPlaceholderKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    if (match[1]) keys.add(match[1]);
  }
  return [...keys].sort();
}

export { mergeTemplateFieldKeys } from "./field-inference";
