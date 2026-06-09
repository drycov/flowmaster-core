import { afterEach, describe, expect, it } from "vitest";

import { getAccessTokenTtlSec } from "./access-token-ttl.server";

describe("getAccessTokenTtlSec", () => {
  const prev = process.env.ACCESS_TOKEN_TTL_MINUTES;

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.ACCESS_TOKEN_TTL_MINUTES;
    } else {
      process.env.ACCESS_TOKEN_TTL_MINUTES = prev;
    }
  });

  it("defaults to 60 minutes", () => {
    delete process.env.ACCESS_TOKEN_TTL_MINUTES;
    expect(getAccessTokenTtlSec()).toBe(3600);
  });

  it("respects configured minutes within bounds", () => {
    process.env.ACCESS_TOKEN_TTL_MINUTES = "30";
    expect(getAccessTokenTtlSec()).toBe(1800);
  });

  it("falls back when value is too small", () => {
    process.env.ACCESS_TOKEN_TTL_MINUTES = "1";
    expect(getAccessTokenTtlSec()).toBe(3600);
  });
});
