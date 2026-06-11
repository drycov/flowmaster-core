import { describe, expect, it } from "vitest";
import { harmonizeTemplateSubstitutionValues } from "./preset-fields";

describe("harmonizeTemplateSubstitutionValues", () => {
  it("syncs registration and name aliases", () => {
    const out = harmonizeTemplateSubstitutionValues({
      executor_name: "Петров П.П.",
      reg_number: "INT-001",
      title_ru: "Служебная записка",
    });

    expect(out.full_name).toBe("Петров П.П.");
    expect(out.registration_number).toBe("INT-001");
    expect(out.document_number).toBe("INT-001");
    expect(out.document_title).toBe("Служебная записка");
  });
});
