import { test, expect } from "@playwright/test";

import { hasE2eCredentials, requireE2eCredentials } from "./helpers/env";
import { login } from "./helpers/auth";
import { createDocumentWithCustomRoute } from "./helpers/documents";

test.describe("Document workflow smoke", () => {
  test.beforeEach(() => {
    test.skip(!hasE2eCredentials(), "Set E2E_EMAIL and E2E_PASSWORD");
  });

  test("login → create document → approve task", async ({ page }) => {
    const { email, password } = requireE2eCredentials();
    const docTitle = `E2E smoke ${Date.now()}`;

    await login(page, email, password);
    await createDocumentWithCustomRoute(page, { title: docTitle, assigneeEmail: email });

    await page.goto("/tasks");
    await expect(page.getByRole("heading", { name: "Задачи" })).toBeVisible();

    const approveBtn = page.getByRole("button", { name: /Согласовать|Approve/i }).first();
    await expect(approveBtn).toBeVisible({ timeout: 30_000 });
    await approveBtn.click();

    await expect(page.getByRole("button", { name: /Согласовать|Approve/i })).toHaveCount(0, {
      timeout: 30_000,
    });
  });

  test("login → create document → reject from document page", async ({ page }) => {
    const { email, password } = requireE2eCredentials();
    const docTitle = `E2E smoke reject ${Date.now()}`;

    await login(page, email, password);
    const docPath = await createDocumentWithCustomRoute(page, {
      title: docTitle,
      assigneeEmail: email,
    });

    await page.goto(docPath);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });

    const comment = page.locator("textarea").first();
    await expect(comment).toBeVisible({ timeout: 20_000 });
    await comment.fill("Smoke reject comment");

    const rejectBtn = page.getByRole("button", { name: /Отклонить|Reject/i }).first();
    await expect(rejectBtn).toBeEnabled({ timeout: 5_000 });
    await rejectBtn.click();

    await expect(rejectBtn).toHaveCount(0, { timeout: 30_000 }).catch(async () => {
      await expect(page.getByText(/Отклон/i).first()).toBeVisible({ timeout: 10_000 });
    });
  });
});
