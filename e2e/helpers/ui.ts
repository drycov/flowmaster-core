import { type Locator, type Page } from "@playwright/test";

/** Radix Select: open trigger and pick an option by visible text. */
export async function pickSelectOption(
  page: Page,
  trigger: Locator,
  optionName: string | RegExp,
) {
  await trigger.click();
  await page.getByRole("option", { name: optionName }).click();
}
