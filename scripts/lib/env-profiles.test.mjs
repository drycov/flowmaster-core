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
    assert.equal(values.ONLYOFFICE_JWT_ENABLED, "true");
    assert.match(values.ONLYOFFICE_JWT_SECRET, /^[0-9a-f]{64}$/);
    assert.equal(values.JWT_SECRET, values.SUPABASE_JWT_SECRET);
    assert.equal(values.INSTALLATION_ID, installationIdFromDomain("edms.satory.kz"));
    assert.equal(values.SMTP_ADMIN_EMAIL, "support@satory.kz");
    assert.equal(values.LICENSE_SERVER_ADMIN_SECRET, undefined);
    assert.equal(values.LICENSE_SERVER_ENABLED, undefined);
  });

  it("defaults to z-license cloud with --with-license-server", () => {
    const values = buildProfileValues("production", {
      domain: "edms.satory.kz",
      certEmail: "support@satory.kz",
      publicUrl: "https://edms.satory.kz",
      withLicenseServer: true,
      existing: new Map(),
      rotateSecrets: true,
      force: true,
    });

    assert.equal(values.LICENSE_MODE, "online");
    assert.equal(values.LICENSE_SERVER_URL, "https://z-license.vercel.app");
    assert.equal(values.LICENSE_SERVER_ENABLED, undefined);
    assert.equal(values.LICENSE_SERVER_ADMIN_SECRET, undefined);
  });

  it("configures cloud license client with URL and installation id", () => {
    const installationId = "da23803d-1048-4526-b5d8-09c9e95c2999";
    const values = buildProfileValues("production", {
      domain: "edms.satory.kz",
      certEmail: "support@satory.kz",
      publicUrl: "https://edms.satory.kz",
      withLicenseServer: true,
      licenseServerUrl: "https://z-license.vercel.app",
      installationId,
      existing: new Map(),
      rotateSecrets: true,
      force: true,
    });

    assert.equal(values.LICENSE_MODE, "online");
    assert.equal(values.LICENSE_SERVER_URL, "https://z-license.vercel.app");
    assert.equal(values.LICENSE_SERVER_ENABLED, undefined);
    assert.equal(values.INSTALLATION_ID, installationId);
    assert.equal(values.LICENSE_SERVER_ADMIN_SECRET, undefined);
  });

  it("configures local replica + cloud upstream", () => {
    const installationId = "da23803d-1048-4526-b5d8-09c9e95c2999";
    const edms = buildProfileValues("production", {
      domain: "edms.client.kz",
      certEmail: "admin@client.kz",
      publicUrl: "https://edms.client.kz",
      withLicenseServer: true,
      licenseReplica: true,
      licenseDomain: "license.client.kz",
      licenseServerUrl: "https://z-license.vercel.app",
      installationId,
      existing: new Map(),
      rotateSecrets: true,
      force: true,
    });

    assert.equal(edms.LICENSE_MODE, "online");
    assert.equal(edms.LICENSE_SERVER_URL, "https://license.client.kz");
    assert.equal(edms.LICENSE_SERVER_ENABLED, undefined);
    assert.equal(edms.INSTALLATION_ID, installationId);

    const local = buildProfileValues("license-server", {
      domain: "license.client.kz",
      certEmail: "admin@client.kz",
      publicUrl: "https://license.client.kz",
      licenseReplica: true,
      licenseServerUrl: "https://z-license.vercel.app",
      installationId,
      existing: new Map(),
      rotateSecrets: true,
      force: true,
    });

    assert.equal(local.LICENSE_UPSTREAM_URL, "https://z-license.vercel.app");
    assert.equal(local.LICENSE_SERVER_ENABLED, "true");
    assert.equal(local.INSTALLATION_ID, installationId);
  });
});
