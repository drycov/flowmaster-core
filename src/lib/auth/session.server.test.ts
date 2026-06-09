import { describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "./session.server";

const SECRET = "test-jwt-secret-for-unit-tests-only";

describe("session.server", () => {
  it("round-trips access token with session id and org", () => {
    const token = signAccessToken("user-1", "u@test.local", SECRET, 3600, "sess-abc", "org-uuid-1");
    const claims = verifyAccessToken(token, SECRET);
    expect(claims?.sub).toBe("user-1");
    expect(claims?.email).toBe("u@test.local");
    expect(claims?.sid).toBe("sess-abc");
    expect(claims?.org_id).toBe("org-uuid-1");
  });

  it("rejects expired token", () => {
    const token = signAccessToken("user-1", "u@test.local", SECRET, -10);
    expect(verifyAccessToken(token, SECRET)).toBeNull();
  });

  it("rejects invalid signature", () => {
    const token = signAccessToken("user-1", "u@test.local", SECRET, 3600);
    expect(verifyAccessToken(`${token}x`, SECRET)).toBeNull();
  });
});
