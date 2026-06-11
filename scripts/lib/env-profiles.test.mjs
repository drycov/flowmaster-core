import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildProfileValues } from "./env-profiles.mjs";
import { installationIdFromDomain } from "./env-crypto.mjs";

describe("buildProfileValues production", () => {
  it("sets consistent ONLYOFFICE and domain URLs", () => {
    const values = buildProfileValues("production", {
      domain: "edms.satory.kz",
      certEmail: "support@satory.kz",
      publicUrl: "https://edms.satory.kz",
      existing: new Map(),
      rotateSecrets: true,
      force: true,
    });

    assert.equal(values.APP_URL, "https://edms.satory.kz");
    assert.equal(values.PROXY_DOMAIN, "edms.satory.kz");
    assert.equal(values.CERTBOT_EMAIL, "support@satory.kz");
    assert.equal(values.ONLYOFFICE_CALLBACK_BASE_URL, "http://nginx");
    assert.equal(values.ONLYOFFICE_STORAGE_INTERNAL_URL, "http://kong:8000");
    assert.match(values.ONLYOFFICE_JWT_SECRET, /^[0-9a-f]{64}$/);
    assert.equal(values.JWT_SECRET, values.SUPABASE_JWT_SECRET);
    assert.equal(values.INSTALLATION_ID, installationIdFromDomain("edms.satory.kz"));
    assert.equal(values.SMTP_ADMIN_EMAIL, "support@satory.kz");
    assert.equal(values.LICENSE_SERVER_ADMIN_SECRET, undefined);
  });
});
