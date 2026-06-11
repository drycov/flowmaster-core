import { describe, expect, it } from "vitest";
import {
  getDocumentTypeFormProfile,
  hasCorrespondenceSection,
  isMetadataFieldVisible,
  validateDocumentFormByType,
} from "./document-type-form";

describe("getDocumentTypeFormProfile", () => {
  it("incoming shows received_at, not sent_at", () => {
    const p = getDocumentTypeFormProfile("incoming");
    expect(isMetadataFieldVisible(p, "received_at")).toBe(true);
    expect(isMetadataFieldVisible(p, "sent_at")).toBe(false);
    expect(hasCorrespondenceSection(p)).toBe(true);
  });

  it("outgoing shows sent_at, not received_at", () => {
    const p = getDocumentTypeFormProfile("outgoing");
    expect(isMetadataFieldVisible(p, "sent_at")).toBe(true);
    expect(isMetadataFieldVisible(p, "received_at")).toBe(false);
  });

  it("internal hides correspondence block", () => {
    const p = getDocumentTypeFormProfile("internal");
    expect(hasCorrespondenceSection(p)).toBe(false);
  });

  it("validates required correspondent for incoming", () => {
    const p = getDocumentTypeFormProfile("incoming");
    const missing = validateDocumentFormByType({}, p, { correspondent_id: "Корреспондент" });
    expect(missing).toBe("Корреспондент");
  });
});
