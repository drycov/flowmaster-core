import { createHash } from "node:crypto";

const UUID =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function officeDocumentKey(docId: string, versionNo: number, updatedAt: string): string {
  const hash = createHash("sha256")
    .update(`${docId}:${versionNo}:${updatedAt}`)
    .digest("hex")
    .slice(0, 16);
  return `${docId}-v${versionNo}-${hash}`;
}

export function parseOfficeDocumentKey(
  key: string,
): { documentId: string; versionNo: number } | null {
  const m = key.match(new RegExp(`^(${UUID})-v(\\d+)-[0-9a-f]{16}$`, "i"));
  if (!m?.[1] || !m[2]) return null;
  return { documentId: m[1].toLowerCase(), versionNo: Number(m[2]) };
}

export function officeTemplateKey(
  templateId: string,
  updatedAt: string,
  filePath: string,
): string {
  const hash = createHash("sha256")
    .update(`${templateId}:${updatedAt}:${filePath}`)
    .digest("hex")
    .slice(0, 16);
  return `tpl:${templateId}:${hash}`;
}

export function parseOfficeTemplateKey(key: string): string | null {
  const m = key.match(new RegExp(`^tpl:(${UUID}):[0-9a-f]{16}$`, "i"));
  return m?.[1]?.toLowerCase() ?? null;
}
