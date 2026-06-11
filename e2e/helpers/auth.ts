import { expect, type Page } from "@playwright/test";

function signInPanel(page: Page) {
  return page.getByRole("tabpanel", { name: "Вход" });
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/auth");
  const panel = signInPanel(page);
  await panel.getByPlaceholder("Адрес электронной почты").fill(email);
  await panel.locator('input[type="password"]').fill(password);
  await panel.getByRole("button", { name: "Войти в систему" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
