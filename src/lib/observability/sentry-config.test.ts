import { afterEach, describe, expect, it } from "vitest";

import { isSentryEnabled, scrubSentryEvent } from "./sentry-config";

describe("sentry-config", () => {
  const prevDsn = process.env.SENTRY_DSN;

  afterEach(() => {
    if (prevDsn === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = prevDsn;
    }
  });

  it("is disabled without DSN on server", () => {
    delete process.env.SENTRY_DSN;
    expect(isSentryEnabled("server")).toBe(false);
  });

  it("is enabled when server DSN is set", () => {
    process.env.SENTRY_DSN = "https://example@o0.ingest.sentry.io/0";
    expect(isSentryEnabled("server")).toBe(true);
  });

  it("scrubs sensitive extra fields", () => {
    const event = scrubSentryEvent({
      extra: {
        request_id: "abc",
        password: "secret",
        authorization: "Bearer x",
      },
    });
    expect(event.extra?.request_id).toBe("abc");
    expect(event.extra?.password).toBe("[Filtered]");
    expect(event.extra?.authorization).toBe("[Filtered]");
  });
});
