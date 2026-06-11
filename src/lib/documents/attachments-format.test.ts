import { describe, expect, it } from "vitest";
import { formatAttachmentsListText } from "./attachments-format";

describe("formatAttachmentsListText", () => {
  it("formats numbered list", () => {
    expect(
      formatAttachmentsListText([{ name: "scan.pdf" }, { name: "photo.jpg" }]),
    ).toBe("1. scan.pdf\n2. photo.jpg");
  });

  it("returns empty for no files", () => {
    expect(formatAttachmentsListText([])).toBe("");
  });
});
