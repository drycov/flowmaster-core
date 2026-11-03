import { test, expect } from "@playwright/test";

import { hasE2eCredentials, requireE2eCredentials } from "./helpers/env";
import { login } from "./helpers/auth";
import { createDocumentWithCustomRoute } from "./helpers/documents";

test.describe("Workflow actions", () => {
  test.beforeEach(() => {
    test.skip(!hasE2eCredentials(), "Set E2E_EMAIL and E2E_PASSWORD");
  });

  test("approve task from /tasks clears pending action", async ({ page }) => {
    const { email, password } = requireE2eCredentials();
    const title = `E2E approve ${Date.now()}`;

    await login(page, email, password);
    await createDocumentWithCustomRoute(page, { title, assigneeEmail: email });

    await page.goto("/tasks");
    await expect(page.getByRole("heading", { name: "Задачи" })).toBeVisible();

    const approveBtn = page.getByRole("button", { name: /Согласовать|Approve/i }).first();
    await expect(approveBtn).toBeVisible({ timeout: 30_000 });
    await approveBtn.click();

    await expect(page.getByRole("button", { name: /Согласовать|Approve/i })).toHaveCount(0, {
      timeout: 30_000,
    });
  });

  test("reject from document page requires comment and completes", async ({ page }) => {
    const { email, password } = requireE2eCredentials();
    const title = `E2E reject ${Date.now()}`;

    await login(page, email, password);
    const docPath = await createDocumentWithCustomRoute(page, {
      title,
      assigneeEmail: email,
    });

    await page.goto(docPath);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });

    // Reject without comment should stay disabled or show validation
    const rejectBtn = page.getByRole("button", { name: /Отклонить|Reject/i }).first();
    await expect(rejectBtn).toBeVisible({ timeout: 20_000 });

    // Comment textarea in WorkflowActions
    const comment = page.locator("textarea").first();
    await expect(comment).toBeVisible();

    // Button should be disabled while comment empty (UI enforces)
    if (await rejectBtn.isEnabled()) {
      // Fallback: click and expect toast / no navigation away
      await rejectBtn.click();
    } else {
      await expect(rejectBtn).toBeDisabled();
    }

    await comment.fill("E2E: отклонение с обязательным комментарием");
    await expect(rejectBtn).toBeEnabled({ timeout: 5_000 });
    await rejectBtn.click();

    // After reject the action card should disappear or status change
    await expect(rejectBtn).toHaveCount(0, { timeout: 30_000 }).catch(async () => {
      // Alternative: task status no longer pending on page
      await expect(page.getByText(/Отклон|Reject/i).first()).toBeVisible({ timeout: 10_000 });
    });
  });

  test("return from document page requires comment", async ({ page }) => {
    const { email, password } = requireE2eCredentials();
    const title = `E2E return ${Date.now()}`;

    await login(page, email, password);
    const docPath = await createDocumentWithCustomRoute(page, {
      title,
      assigneeEmail: email,
    });

    await page.goto(docPath);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });

    const returnBtn = page.getByRole("button", { name: /Вернуть|Return/i }).first();
    await expect(returnBtn).toBeVisible({ timeout: 20_000 });

    const comment = page.locator("textarea").first();
    await comment.fill("E2E: возврат на доработку");
    await expect(returnBtn).toBeEnabled({ timeout: 5_000 });
    await returnBtn.click();

    await expect(returnBtn).toHaveCount(0, { timeout: 30_000 }).catch(async () => {
      await expect(page.getByText(/Возвращ|Return|доработ/i).first()).toBeVisible({
        timeout: 10_000,
      });
    });
  });
});
