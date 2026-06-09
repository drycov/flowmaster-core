import { test, expect } from "@playwright/test";

import { hasE2eCredentials, requireE2eCredentials } from "./helpers/env";
import { login } from "./helpers/auth";
import { pickSelectOption } from "./helpers/ui";

test.describe("Document workflow smoke", () => {
  test.beforeEach(() => {
    test.skip(!hasE2eCredentials(), "Set E2E_EMAIL and E2E_PASSWORD");
  });

  test("login → create document → approve task", async ({ page }) => {
    const { email, password } = requireE2eCredentials();
    const docTitle = `E2E smoke ${Date.now()}`;

    await login(page, email, password);

    await page.goto("/documents/new");
    await expect(page.getByRole("heading", { name: "Создание документа" })).toBeVisible({
      timeout: 30_000,
    });

    const templateField = page
      .locator("div")
      .filter({ has: page.getByText("На основе шаблона", { exact: true }) })
      .first();
    await pickSelectOption(page, templateField.getByRole("combobox"), "Без шаблона");

    await page.getByLabel("Заголовок документа (RU) *").fill(docTitle);

    const routeSection = page
      .locator("div")
      .filter({ has: page.getByRole("heading", { name: "Маршрут согласования" }) })
      .first();

    await pickSelectOption(
      page,
      routeSection.getByRole("combobox").first(),
      "Разрешить пользователю собрать собственный маршрут",
    );

    await routeSection.getByRole("button", { name: "Добавить шаг" }).click();

    await pickSelectOption(
      page,
      routeSection.getByRole("combobox").last(),
      new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );

    await page.getByRole("button", { name: "Зарегистрировать" }).click();
    await expect(page).toHaveURL(/\/documents\/[0-9a-f-]+/, { timeout: 60_000 });

    await page.goto("/tasks");
    await expect(page.getByRole("heading", { name: "Задачи" })).toBeVisible();

    const approveBtn = page.getByRole("button", { name: "Согласовать" }).first();
    await expect(approveBtn).toBeVisible({ timeout: 30_000 });
    await approveBtn.click();

    await expect(page.getByRole("button", { name: "Согласовать" })).toHaveCount(0, {
      timeout: 30_000,
    });
  });
});
