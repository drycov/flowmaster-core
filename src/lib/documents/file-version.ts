export type DocumentFileVersionRow = {
  version_no: number;
  file_path?: string | null;
  file_format?: string | null;
  content_hash?: string | null;
};

/** File version used for content preview — mirrors ONLYOFFICE file resolution. */
export function resolvePreviewFileVersion<T extends DocumentFileVersionRow>(
  versions: T[],
  currentVersionNo: number,
): T | null {
  if (!versions.length) return null;

  const current = versions.find((v) => v.version_no === currentVersionNo);
  if (current?.file_path) return current;

  return (
    [...versions]
      .filter((v) => v.file_path)
      .sort((a, b) => b.version_no - a.version_no)[0] ?? null
  );
}
