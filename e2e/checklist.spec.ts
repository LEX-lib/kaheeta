import { test, expect } from "@playwright/test";
import { seedAuth, stubPocketBase } from "./helpers/pwa";

/**
 * Checklist MVP. Data is a local mock (useChecklists seeds localStorage), so no
 * backend stub is needed for the checklist itself — but the default Vaccinations
 * tab still loads, so we stub /api to keep /wallet deterministic.
 */
test.describe("Checklist tab", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await stubPocketBase(page);
    await page.goto("/wallet");
    await page.getByRole("tab", { name: /checklist/i }).click();
    await expect(page.getByText("Groceries").first()).toBeVisible();
  });

  test("shows the seeded checklists", async ({ page }) => {
    for (const name of ["Groceries", "Errands", "Work", "Home"]) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
  });

  test("toggling a task updates the progress count", async ({ page }) => {
    // Groceries is selected by default → 4 of 8 done.
    await expect(page.locator(".cl-detail-count")).toHaveText("4 of 8 done");
    await page.locator(".cl-task", { hasText: "Coffee" }).locator(".cl-check").click();
    await expect(page.locator(".cl-detail-count")).toHaveText("5 of 8 done");
  });

  test("can create a new checklist", async ({ page }) => {
    await page.getByRole("button", { name: "New checklist" }).click();
    await page.getByPlaceholder("e.g., Groceries, Errands").fill("Travel");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Travel", { exact: true }).first()).toBeVisible();
  });
});
