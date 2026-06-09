import { afterEach, describe, expect, it } from "vitest";
import { verifyInternalHookRequest } from "./internal-hook-auth.server";

const ENV_KEYS = ["CRON_SECRET", "INTERNAL_HOOK_SECRET", "SUPABASE_PUBLISHABLE_KEY"] as const;

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

function snapshotEnv(): Record<string, string | undefined> {
  return Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
}

describe("verifyInternalHookRequest", () => {
  afterEach(() => {
    restoreEnv(snapshotRef);
  });

  let snapshotRef = snapshotEnv();

  it("accepts Bearer token when CRON_SECRET is set", () => {
    snapshotRef = snapshotEnv();
    process.env.CRON_SECRET = "cron-test-secret";
    const request = new Request("http://localhost/hooks", {
      headers: { Authorization: "Bearer cron-test-secret" },
    });
    expect(verifyInternalHookRequest(request)).toBe(true);
  });

  it("rejects wrong Bearer token when CRON_SECRET is set", () => {
    snapshotRef = snapshotEnv();
    process.env.CRON_SECRET = "cron-test-secret";
    const request = new Request("http://localhost/hooks", {
      headers: { Authorization: "Bearer wrong" },
    });
    expect(verifyInternalHookRequest(request)).toBe(false);
  });

  it("falls back to apikey when CRON_SECRET is unset", () => {
    snapshotRef = snapshotEnv();
    delete process.env.CRON_SECRET;
    delete process.env.INTERNAL_HOOK_SECRET;
    process.env.SUPABASE_PUBLISHABLE_KEY = "anon-key-test";
    const request = new Request("http://localhost/hooks", {
      headers: { apikey: "anon-key-test" },
    });
    expect(verifyInternalHookRequest(request)).toBe(true);
  });
});
