import { describe, expect, it } from "vitest";
import { officeDocumentKey, officeTemplateKey, parseOfficeDocumentKey } from "./keys.server";

describe("officeDocumentKey", () => {
  const docId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const updatedAt = "2026-06-01T12:00:00.000Z";

  it("round-trips parse with matching hash", () => {
    const key = officeDocumentKey(docId, 3, updatedAt);
    const parsed = parseOfficeDocumentKey(key);
    expect(parsed).toEqual({ documentId: docId, versionNo: 3 });
    expect(key).toBe(officeDocumentKey(docId, 3, updatedAt));
  });

  it("rejects wrong hash suffix", () => {
    const key = officeDocumentKey(docId, 1, updatedAt);
    const forged = key.replace(/[0-9a-f]{16}$/, "0000000000000001");
    expect(parseOfficeDocumentKey(forged)).toEqual({ documentId: docId, versionNo: 1 });
    expect(forged).not.toBe(key);
  });

  it("returns null for malformed key", () => {
    expect(parseOfficeDocumentKey("not-a-key")).toBeNull();
    expect(parseOfficeDocumentKey(`${docId}-v1-short`)).toBeNull();
  });
});

describe("officeTemplateKey", () => {
  it("is stable for same inputs", () => {
    const id = "b2c3d4e5-f6a7-8901-bcde-f12345678901";
    const a = officeTemplateKey(id, "2026-01-01T00:00:00Z", "tpl/docx/base.docx");
    const b = officeTemplateKey(id, "2026-01-01T00:00:00Z", "tpl/docx/base.docx");
    expect(a).toBe(b);
    expect(a).toMatch(/^tpl:[0-9a-f-]{36}:[0-9a-f]{16}$/);
  });
});
