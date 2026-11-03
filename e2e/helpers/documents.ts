import { expect, type Page } from "@playwright/test";
import { pickSelectOption } from "./ui";

export type CreateDocumentOptions = {
  title: string;
  /** Assign the single custom-route step to this user (matched by email/name regex). */
  assigneeEmail: string;
  /** Action for the step: approve | sign | review. Default approve. */
  action?: "approve" | "sign" | "review";
};

/**
 * Create a document without a template, with a one-step custom route
 * assigned to the given user. Returns the document URL path `/documents/<uuid>`.
 */
export async function createDocumentWithCustomRoute(
  page: Page,
  opts: CreateDocumentOptions,
): Promise<string> {
  const { title, assigneeEmail, action = "approve" } = opts;

  await page.goto("/documents/new");
  await expect(page.getByRole("heading", { name: "Создание документа" })).toBeVisible({
    timeout: 30_000,
  });

  // Template: without template
  const templateField = page
    .locator("div")
    .filter({ has: page.getByText("На основе шаблона", { exact: true }) })
    .first();
  await pickSelectOption(page, templateField.getByRole("combobox"), "Без шаблона");

  await page.getByLabel("Заголовок документа (RU) *").fill(title);

  // Route: custom
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

  // Assignee (last combobox in route section tends to be the user picker after mode defaults to user)
  await pickSelectOption(
    page,
    routeSection.getByRole("combobox").last(),
    new RegExp(assigneeEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );

  // Optionally set action if UI exposes a second select on the step
  if (action !== "approve") {
    const actionLabels: Record<string, string | RegExp> = {
      sign: /Подпис|sign/i,
      review: /Ознаком|review/i,
    };
    const label = actionLabels[action];
    if (label) {
      const actionTriggers = routeSection.getByRole("combobox");
      const count = await actionTriggers.count();
      // Try middle selects for action type if present
      for (let i = 0; i < count; i++) {
        try {
          await pickSelectOption(page, actionTriggers.nth(i), label);
          break;
        } catch {
          /* try next */
        }
      }
    }
  }

  await page.getByRole("button", { name: "Зарегистрировать" }).click();
  await expect(page).toHaveURL(/\/documents\/[0-9a-f-]+/, { timeout: 60_000 });

  const url = page.url();
  const match = url.match(/\/documents\/([0-9a-f-]+)/);
  if (!match) throw new Error(`Could not parse document id from URL: ${url}`);
  return match[0];
}
