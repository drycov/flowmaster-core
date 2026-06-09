import { test, expect } from "@playwright/test";

test.describe("Health API", () => {
  test("returns database status", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBeLessThan(600);

    const body = (await res.json()) as {
      ok: boolean;
      checks: Record<string, string>;
    };

    expect(body).toHaveProperty("checks");
    expect(body.checks.app).toBe("ok");
    expect(["ok", "error"]).toContain(body.checks.database);
  });
});
