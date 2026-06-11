import { describe, expect, it } from "vitest";
import { isAutoFilledTemplateField, resolveTemplateFieldSource } from "./template-field-source";

describe("resolveTemplateFieldSource", () => {
  it("respects explicit source", () => {
    expect(resolveTemplateFieldSource({ key: "foo", source: "user" })).toBe("user");
  });

  it("infers system and organization keys", () => {
    expect(resolveTemplateFieldSource({ key: "document_number" })).toBe("system");
    expect(resolveTemplateFieldSource({ key: "organization_name" })).toBe("organization");
  });

  it("infers author vs signatory", () => {
    expect(resolveTemplateFieldSource({ key: "executor_name" })).toBe("author");
    expect(resolveTemplateFieldSource({ key: "sender_name" })).toBe("signatory");
  });
});

describe("isAutoFilledTemplateField", () => {
  it("returns false for user-entered fields", () => {
    expect(isAutoFilledTemplateField({ key: "document_subject" })).toBe(false);
    expect(isAutoFilledTemplateField({ key: "recipient_name" })).toBe(false);
  });

  it("returns true for auto fields", () => {
    expect(isAutoFilledTemplateField({ key: "document_date" })).toBe(true);
    expect(isAutoFilledTemplateField({ key: "executor_phone" })).toBe(true);
  });
});
