import { test, expect } from "@playwright/test";
import { seedAuth, stubPocketBase } from "./helpers/pwa";
import { mockChecklistApi, checklistSeed } from "./helpers/checklist";

/**
 * Checklist tab against a stubbed PocketBase (the real kaheeta_checklists /
 * kaheeta_checklist_tasks collections don't exist yet). stubPocketBase keeps the
 * default Vaccinations tab deterministic; mockChecklistApi (registered after, so
 * it wins) provides a stateful in-memory backend for the two checklist
 * collections, exercising the real pb read/write code path.
 */
test.describe("Checklist tab", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await stubPocketBase(page);
    await mockChecklistApi(page, checklistSeed());
    await page.goto("/wallet");
    await page.getByRole("tab", { name: /checklist/i }).click();
    await expect(page.getByText("Groceries").first()).toBeVisible();
  });

  test("loads checklists from the backend", async ({ page }) => {
    await expect(page.getByText("Groceries", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Errands", { exact: true }).first()).toBeVisible();
  });

  test("toggling a task persists and updates the progress count", async ({ page }) => {
    // Groceries is selected by default → 2 of 4 done.
    await expect(page.locator(".cl-detail-count")).toHaveText("2 of 4 done");

    const [patch] = await Promise.all([
      page.waitForRequest(
        (r) =>
          r.method() === "PATCH" &&
          r.url().includes("/api/collections/kaheeta_checklist_tasks/records/"),
      ),
      page.locator(".cl-task", { hasText: "Coffee" }).locator(".cl-check").click(),
    ]);
    expect(JSON.parse(patch.postData() ?? "{}")).toMatchObject({ done: true });
    await expect(page.locator(".cl-detail-count")).toHaveText("3 of 4 done");
  });

  test("creating a checklist POSTs and shows the new card", async ({ page }) => {
    await page.getByRole("button", { name: "New checklist" }).click();
    await page.getByPlaceholder("e.g., Groceries, Errands").fill("Travel");

    const [post] = await Promise.all([
      page.waitForRequest(
        (r) =>
          r.method() === "POST" &&
          r.url().includes("/api/collections/kaheeta_checklists/records"),
      ),
      page.getByRole("button", { name: "Create" }).click(),
    ]);
    expect(JSON.parse(post.postData() ?? "{}")).toMatchObject({ name: "Travel" });
    await expect(page.getByText("Travel", { exact: true }).first()).toBeVisible();
  });
});
