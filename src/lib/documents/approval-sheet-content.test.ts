import { describe, expect, it } from "vitest";
import {
  buildApprovalSheetBody,
  buildApprovalSheetTitle,
  getNodeSheetLabel,
} from "./approval-sheet-content";

describe("buildApprovalSheetTitle", () => {
  it("prefixes parent title", () => {
    expect(buildApprovalSheetTitle("Служебная записка")).toBe(
      "Лист согласования: Служебная записка",
    );
  });
});

describe("buildApprovalSheetBody", () => {
  it("renders route rows in table", () => {
    const body = buildApprovalSheetBody(
      {
        title: "Служебная записка",
        regNumber: "INT-00042",
        documentDate: "10.06.2026",
        organizationName: "АО «Тест»",
      },
      [
        {
          order: 1,
          stepLabel: "Согласование начальником",
          nodeType: "Согласование",
          assigneeName: "Иванов И.И.",
          assigneePosition: "Начальник отдела",
          decisionDate: "",
          signature: "",
          result: "",
        },
      ],
    );

    expect(body).toContain("ЛИСТ СОГЛАСОВАНИЯ");
    expect(body).toContain("INT-00042");
    expect(body).toContain("Иванов И.И.");
    expect(body).toContain("Согласование начальником");
  });
});

describe("getNodeSheetLabel", () => {
  it("uses node label when present", () => {
    expect(getNodeSheetLabel({ id: "n1", type: "APPROVAL", label: "Юрист", position: { x: 0, y: 0 } })).toBe(
      "Юрист",
    );
  });
});
