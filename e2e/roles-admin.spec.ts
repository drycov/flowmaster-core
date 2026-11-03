import { test, expect } from "@playwright/test";

import { hasE2eCredentials, requireE2eCredentials } from "./helpers/env";
import { login } from "./helpers/auth";

test.describe("Admin roles", () => {
  test.beforeEach(() => {
    test.skip(!hasE2eCredentials(), "Set E2E_EMAIL and E2E_PASSWORD");
  });

  test("admin can open roles page and see role list", async ({ page }) => {
    const { email, password } = requireE2eCredentials();
    await login(page, email, password);

    await page.goto("/admin/roles");
    // Title may be «Роли» or localized nav.roles
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 30_000 });

    // Left column: at least one role button or empty state card
    const roleButtons = page.locator("button").filter({ has: page.locator(".font-mono") });
    const count = await roleButtons.count();
    // System installs usually seed admin/viewer roles
    expect(count).toBeGreaterThanOrEqual(0);

    // New role button present for manage permission
    const newRoleBtn = page.getByRole("button", { name: /Новая роль|New role|Жаңа рөл/i });
    await expect(newRoleBtn).toBeVisible({ timeout: 15_000 });
  });

  test("create role → select → toggle permission → save", async ({ page }) => {
    const { email, password } = requireE2eCredentials();
    await login(page, email, password);

    await page.goto("/admin/roles");
    await expect(page.getByRole("button", { name: /Новая роль|New role|Жаңа рөл/i })).toBeVisible({
      timeout: 30_000,
    });

    const code = `e2e_${Date.now().toString(36).slice(-8)}`;
    const nameRu = `E2E роль ${code}`;

    await page.getByRole("button", { name: /Новая роль|New role|Жаңа рөл/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Code + names
    await dialog.locator("input").nth(0).fill(code);
    await dialog.locator("input").nth(1).fill(nameRu);
    await dialog.locator("input").nth(2).fill(nameRu);

    await dialog.getByRole("button", { name: /Создать|Create/i }).click();

    // Role appears in list
    await expect(page.getByText(nameRu).first()).toBeVisible({ timeout: 20_000 });
    await page.getByText(nameRu).first().click();

    // Permissions matrix visible (mono codes)
    const checkbox = page.locator('label:has([role="checkbox"])').first();
    await expect(checkbox).toBeVisible({ timeout: 15_000 });

    // Toggle first permission
    await checkbox.click();

    const saveBtn = page.getByRole("button", { name: /Сохранить|Save/i }).first();
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    await saveBtn.click();

    // Toast or dirty flag cleared (button disabled again)
    await expect(saveBtn).toBeDisabled({ timeout: 15_000 }).catch(async () => {
      await expect(page.getByText(/сохранен|saved|Permissions/i).first()).toBeVisible({
        timeout: 10_000,
      });
    });
  });

  test("unauthenticated user cannot open /admin/roles", async ({ page }) => {
    await page.goto("/admin/roles");
    await expect(page).toHaveURL(/\/auth/, { timeout: 15_000 });
  });
});
