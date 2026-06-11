import { afterEach, describe, expect, it } from "vitest";
import { verifyOnlyOfficeCallbackRequest } from "./office-callback-auth.server";

const ENV_KEYS = ["NODE_ENV", "ONLYOFFICE_JWT_ENABLED", "ONLYOFFICE_JWT_SECRET"] as const;

function snapshotEnv(): Record<string, string | undefined> {
  return Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

describe("verifyOnlyOfficeCallbackRequest", () => {
  let snapshot = snapshotEnv();

  afterEach(() => {
    restoreEnv(snapshot);
  });

  it("allows raw body in non-production when JWT disabled", () => {
    snapshot = snapshotEnv();
    process.env.NODE_ENV = "development";
    delete process.env.ONLYOFFICE_JWT_ENABLED;

    const request = new Request("http://localhost/hooks/office-callback", { method: "POST" });
    const body = { key: "test-key", status: 2, url: "http://onlyoffice/cache/file" };

    expect(verifyOnlyOfficeCallbackRequest(request, body)).toEqual(body);
  });

  it("rejects unauthenticated body in production when JWT disabled", () => {
    snapshot = snapshotEnv();
    process.env.NODE_ENV = "production";
    delete process.env.ONLYOFFICE_JWT_ENABLED;

    const request = new Request("http://localhost/hooks/office-callback", { method: "POST" });
    const body = { key: "test-key", status: 2, url: "http://onlyoffice/cache/file" };

    expect(verifyOnlyOfficeCallbackRequest(request, body)).toBeNull();
  });
});
