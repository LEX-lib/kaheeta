import { test, expect } from "@playwright/test";
import { seedAuth, stubPocketBase } from "./helpers/pwa";
import { mockSplitsApi } from "./helpers/splits";

/**
 * Section F — mobile / desktop parity for the group-detail surface. GroupsTab
 * renders the detail as a centered PrimeVue Dialog on desktop and a bottom
 * Drawer on mobile (useIsMobile, 639px breakpoint). The add-expense form
 * (BaseMobileDialog) follows the same split. We assert the right shell renders
 * per viewport and that form inputs are ≥16px on mobile (iOS no-zoom rule).
 */
test.describe("Split group detail — viewport parity", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  async function openTrip(page: import("@playwright/test").Page) {
    await page.goto("/wallet");
    await page.getByRole("tab", { name: /groups/i }).click();
    await page.getByText("Trip", { exact: true }).first().click();
    // Detail content is loaded once the Members heading is present.
    await expect(page.getByText("Members", { exact: true })).toBeVisible();
  }

  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await stubPocketBase(page);
    await mockSplitsApi(page);
  });

  test("desktop renders the detail as a Dialog (not a Drawer)", async ({ page }) => {
    // default chromium viewport is desktop-width
    await openTrip(page);

    await expect(page.locator(".p-dialog", { hasText: "Members" })).toBeVisible();
    await expect(page.locator(".p-drawer")).toHaveCount(0);
  });

  test.describe("mobile", () => {
    test.use({ viewport: { width: 390, height: 800 } });

    test("renders the detail as a bottom Drawer (not a Dialog)", async ({ page }) => {
      await openTrip(page);

      const drawer = page.locator(".p-drawer", { hasText: "Members" });
      await expect(drawer).toBeVisible();
      await expect(page.locator(".p-drawer-bottom")).toBeVisible();
      await expect(page.locator(".p-dialog")).toHaveCount(0);
    });

    test("add-expense inputs are ≥16px (iOS no-zoom)", async ({ page }) => {
      await openTrip(page);
      await page.getByRole("button", { name: "Add expense" }).click();
      await expect(page.locator("#manage-split-expense-form")).toBeVisible();

      const amount = page.locator("#manage-split-expense-form").getByRole("spinbutton").first();
      const fontPx = await amount.evaluate(
        (el) => parseFloat(getComputedStyle(el).fontSize),
      );
      expect(fontPx).toBeGreaterThanOrEqual(16);
    });
  });
});
