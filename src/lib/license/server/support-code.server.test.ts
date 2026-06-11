import { describe, expect, it } from "vitest";
import {
  generateVendorSupportCode,
  signVendorAdminSession,
  verifyVendorAdminSession,
  verifyVendorSupportCode,
  VENDOR_SUPPORT_CODE_TTL_MS,
} from "./support-code.server";

const SECRET = "test-secret-for-support-code";

describe("vendor support code", () => {
  it("generates and verifies code in same slot", () => {
    const now = 1_700_000_000_000;
    const { code } = generateVendorSupportCode(SECRET, now);
    expect(code).toMatch(/^\d{8}$/);
    expect(verifyVendorSupportCode(SECRET, code, now)).toBe(true);
  });

  it("rejects wrong code", () => {
    const now = 1_700_000_000_000;
    expect(verifyVendorSupportCode(SECRET, "00000000", now)).toBe(false);
  });

  it("accepts previous slot within skew window", () => {
    const slotStart = 5 * VENDOR_SUPPORT_CODE_TTL_MS;
    const { code } = generateVendorSupportCode(SECRET, slotStart);
    const nextSlot = slotStart + VENDOR_SUPPORT_CODE_TTL_MS + 1000;
    expect(verifyVendorSupportCode(SECRET, code, nextSlot)).toBe(true);
  });

  it("session token round-trips", () => {
    const exp = Date.now() + 60_000;
    const token = signVendorAdminSession(SECRET, exp);
    expect(verifyVendorAdminSession(SECRET, token)).toBe(true);
    expect(verifyVendorAdminSession(SECRET, token + "x")).toBe(false);
  });
});
