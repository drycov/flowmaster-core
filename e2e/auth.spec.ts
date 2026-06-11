import { test, expect } from "@playwright/test";

import { hasE2eCredentials, requireE2eCredentials } from "./helpers/env";
import { login } from "./helpers/auth";

test.describe("Authentication", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/auth");
    const panel = page.getByRole("tabpanel", { name: "Вход" });
    await expect(panel.getByPlaceholder("Адрес электронной почты")).toBeVisible();
    await expect(panel.locator('input[type="password"]')).toBeVisible();
    await expect(panel.getByRole("button", { name: "Войти в систему" })).toBeVisible();
  });

  test("email login succeeds", async ({ page }) => {
    test.skip(!hasE2eCredentials(), "Set E2E_EMAIL and E2E_PASSWORD");

    const { email, password } = requireE2eCredentials();
    await login(page, email, password);
    await expect(page.locator("nav")).toBeVisible();
  });
});
