import { describe, expect, it } from "vitest";
import {
  computeNextRetryAt,
  computeRetryDelayMinutes,
  isOutboxExhausted,
  MAX_OUTBOX_ATTEMPTS,
} from "./retry.server";

describe("outbox retry", () => {
  it("computes exponential backoff capped at 60 minutes", () => {
    expect(computeRetryDelayMinutes(1)).toBe(2);
    expect(computeRetryDelayMinutes(3)).toBe(8);
    expect(computeRetryDelayMinutes(10)).toBe(60);
  });

  it("schedules next retry in the future", () => {
    const from = Date.parse("2026-01-01T00:00:00.000Z");
    const next = computeNextRetryAt(2, from);
    expect(Date.parse(next)).toBe(from + 4 * 60_000);
  });

  it("marks attempts as exhausted at MAX_OUTBOX_ATTEMPTS", () => {
    expect(isOutboxExhausted(MAX_OUTBOX_ATTEMPTS - 1)).toBe(false);
    expect(isOutboxExhausted(MAX_OUTBOX_ATTEMPTS)).toBe(true);
  });
});
