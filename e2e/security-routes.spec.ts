import { test, expect } from "@playwright/test";

import { hasE2eCredentials, requireE2eCredentials } from "./helpers/env";
import { login } from "./helpers/auth";

test.describe("Route guards", () => {
  test("unauthenticated user is redirected from protected routes", async ({ page }) => {
    await page.goto("/documents/new");
    await expect(page).toHaveURL(/\/auth/, { timeout: 15_000 });

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth/, { timeout: 15_000 });
  });

  test("authenticated user can open document creation", async ({ page }) => {
    test.skip(!hasE2eCredentials(), "Set E2E_EMAIL and E2E_PASSWORD");

    const { email, password } = requireE2eCredentials();
    await login(page, email, password);

    await page.goto("/documents/new");
    await expect(page).toHaveURL(/\/documents\/new/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Создание документа" })).toBeVisible({
      timeout: 30_000,
    });
  });
});
