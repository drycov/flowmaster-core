import { afterEach, describe, expect, it } from "vitest";
import { assertAllowedOfficeDownloadUrl } from "./office-download.server";

const ENV_KEYS = ["ONLYOFFICE_STORAGE_INTERNAL_URL", "ONLYOFFICE_CALLBACK_BASE_URL"] as const;

function snapshotEnv(): Record<string, string | undefined> {
  return Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

describe("assertAllowedOfficeDownloadUrl", () => {
  let snapshot = snapshotEnv();

  afterEach(() => {
    restoreEnv(snapshot);
  });

  it("blocks cloud metadata SSRF target", async () => {
    snapshot = snapshotEnv();
    process.env.ONLYOFFICE_STORAGE_INTERNAL_URL = "http://onlyoffice";

    await expect(
      assertAllowedOfficeDownloadUrl("http://169.254.169.254/latest/meta-data/"),
    ).rejects.toThrow(/not allowed/i);
  });
});
