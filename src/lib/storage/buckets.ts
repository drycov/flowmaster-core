export const STORAGE_BUCKETS = {
  avatars: "avatars",
  documents: "documents",
  templates: "templates",
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

export function avatarPath(userId: string, filename: string) {
  return `${userId}/${filename}`;
}

export function documentVersionPath(
  documentId: string,
  versionNo: number,
  filename: string,
) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${documentId}/v${versionNo}/${safe}`;
}

export function templateFilePath(templateId: string, filename: string) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${templateId}/${safe}`;
}

export function parseDocumentIdFromPath(storagePath: string): string | null {
  const part = storagePath.split("/")[0];
  return part && /^[0-9a-f-]{36}$/i.test(part) ? part : null;
}
