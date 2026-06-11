import { describe, expect, it } from "vitest";
import { resolvePreviewFileVersion } from "./file-version";

describe("resolvePreviewFileVersion", () => {
  const versions = [
    { version_no: 3, file_path: null },
    { version_no: 2, file_path: "doc/v2/office-save.docx", file_format: "docx" },
    { version_no: 1, file_path: "doc/v1/document.docx", file_format: "docx" },
  ];

  it("uses current version when it has a file", () => {
    const current = { version_no: 2, file_path: "doc/v2/office-save.docx", file_format: "docx" };
    expect(resolvePreviewFileVersion([current, versions[2]], 2)).toEqual(current);
  });

  it("falls back to latest file version when current is body-only", () => {
    expect(resolvePreviewFileVersion(versions, 3)?.version_no).toBe(2);
  });

  it("returns null when no file versions exist", () => {
    expect(resolvePreviewFileVersion([{ version_no: 1, file_path: null }], 1)).toBeNull();
  });
});
