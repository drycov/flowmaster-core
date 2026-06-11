import { afterEach, describe, expect, it } from "vitest";
import {
  parseOnlyOfficeCallbackPayload,
  signOnlyOfficeConfig,
  verifyOnlyOfficeJwtToken,
} from "./jwt.server";
import { verifyOnlyOfficeCallbackRequest } from "./office-callback-auth.server";

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

describe("verifyOnlyOfficeJwtToken", () => {
  const prevEnabled = process.env.ONLYOFFICE_JWT_ENABLED;
  const prevSecret = process.env.ONLYOFFICE_JWT_SECRET;
  const prevNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.ONLYOFFICE_JWT_ENABLED = prevEnabled;
    process.env.ONLYOFFICE_JWT_SECRET = prevSecret;
    process.env.NODE_ENV = prevNodeEnv;
  });

  it("round-trips callback payload in JWT", () => {
    process.env.ONLYOFFICE_JWT_ENABLED = "true";
    process.env.ONLYOFFICE_JWT_SECRET = "callback-secret";

    const payload = {
      key: "00000000-0000-0000-0000-000000000001-v1-deadbeefcafebabe",
      status: 2,
      url: "http://onlyoffice/cache/files/doc.docx",
    };
    const signed = signOnlyOfficeConfig(payload as never);
    const decoded = verifyOnlyOfficeJwtToken(String(signed.token));
    expect(decoded?.key).toBe(payload.key);
    expect(decoded?.status).toBe(payload.status);
    expect(parseOnlyOfficeCallbackPayload(decoded!)).toEqual(payload);
  });
});

describe("verifyOnlyOfficeCallbackRequest", () => {
  const prevEnabled = process.env.ONLYOFFICE_JWT_ENABLED;
  const prevSecret = process.env.ONLYOFFICE_JWT_SECRET;
  const prevNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.ONLYOFFICE_JWT_ENABLED = prevEnabled;
    process.env.ONLYOFFICE_JWT_SECRET = prevSecret;
    process.env.NODE_ENV = prevNodeEnv;
  });

  it("rejects unauthenticated callback in production without JWT", () => {
    process.env.NODE_ENV = "production";
    process.env.ONLYOFFICE_JWT_ENABLED = "false";
    delete process.env.ONLYOFFICE_JWT_SECRET;

    const request = new Request("http://localhost/api/public/hooks/office-callback", {
      method: "POST",
    });
    const body = { key: "x", status: 2, url: "http://onlyoffice/cache/x" };
    expect(verifyOnlyOfficeCallbackRequest(request, body)).toBeNull();
  });

  it("accepts JWT in Authorization header", () => {
    process.env.NODE_ENV = "production";
    process.env.ONLYOFFICE_JWT_ENABLED = "true";
    process.env.ONLYOFFICE_JWT_SECRET = "prod-secret";

    const inner = {
      key: "00000000-0000-0000-0000-000000000001-v1-deadbeefcafebabe",
      status: 2,
      url: "http://onlyoffice/cache/files/doc.docx",
    };
    const signed = signOnlyOfficeConfig(inner as never);
    const request = new Request("http://localhost/api/public/hooks/office-callback", {
      method: "POST",
      headers: { Authorization: `Bearer ${signed.token}` },
    });
    expect(verifyOnlyOfficeCallbackRequest(request, {})).toEqual(inner);
  });
});
