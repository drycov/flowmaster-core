import { test, expect } from "@playwright/test";

import { hasTenantIsolationE2e, requireTenantIsolationE2e } from "./helpers/env";
import { login } from "./helpers/auth";

test.describe("Cross-tenant isolation", () => {
  test("user from another org sees access denied on foreign document", async ({ page }) => {
    test.skip(
      !hasTenantIsolationE2e(),
      "Set E2E_TENANT_B_EMAIL, E2E_TENANT_B_PASSWORD, E2E_CROSS_TENANT_DOCUMENT_ID",
    );

    const { email, password, documentId } = requireTenantIsolationE2e();
    await login(page, email, password);

    await page.goto(`/documents/${documentId}`);
    await expect(page.getByRole("heading", { name: "Доступ к документу запрещён" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: "Создание документа" })).not.toBeVisible();
  });
});
