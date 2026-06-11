import { describe, expect, it } from "vitest";
import { signOnlyOfficeConfig } from "./jwt.server";

describe("signOnlyOfficeConfig", () => {
  it("returns config unchanged when JWT is disabled", () => {
    const config = { document: { title: "Test" }, editorConfig: { mode: "view" } };
    expect(signOnlyOfficeConfig(config)).toEqual(config);
  });

  it("returns signed token when JWT is enabled", () => {
    const prevEnabled = process.env.ONLYOFFICE_JWT_ENABLED;
    const prevSecret = process.env.ONLYOFFICE_JWT_SECRET;
    process.env.ONLYOFFICE_JWT_ENABLED = "true";
    process.env.ONLYOFFICE_JWT_SECRET = "test-secret";

    const config = { document: { title: "Test" }, editorConfig: { mode: "view" } };
    const signed = signOnlyOfficeConfig(config);

    expect(signed).toHaveProperty("token");
    expect(typeof signed.token).toBe("string");
    expect(String(signed.token).split(".")).toHaveLength(3);

    process.env.ONLYOFFICE_JWT_ENABLED = prevEnabled;
    process.env.ONLYOFFICE_JWT_SECRET = prevSecret;
  });
});
