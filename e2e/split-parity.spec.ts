import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
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

  test("desktop shows Download records and it triggers a JSON download", async ({ page }) => {
    await openTrip(page);
    const btn = page.getByRole("button", { name: "Download records" });
    await expect(btn).toBeVisible();

    const [download] = await Promise.all([page.waitForEvent("download"), btn.click()]);
    expect(download.suggestedFilename()).toContain("kaheeta-trip");
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test("CSV export downloads a per-member shares report", async ({ page }) => {
    await mockSplitsApi(page, {
      expenses: [
        {
          id: "d1",
          group: "g1",
          paid_by: "u_bob",
          added_by: "u_bob",
          name: "Dinner",
          amount: 10000,
          currency: "PHP",
          split_type: "equal",
          expense_date: "2026-06-01",
        },
      ],
      shares: [
        { id: "sh_a", expense: "d1", user: "e2e_user", amount: 5000 },
        { id: "sh_b", expense: "d1", user: "u_bob", amount: 5000 },
      ],
    });
    await openTrip(page);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export CSV" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^kaheeta-trip-shares-\d{4}-\d{2}-\d{2}\.csv$/);

    const content = readFileSync((await download.path())!, "utf8");
    expect(content.startsWith("\ufeff")).toBe(true);
    expect(content).toContain("member_share");
    expect(content).toContain("2026-06-01,Dinner,equal,PHP,100.00,Bob,You,50.00,false,50.00");
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

    test("Download records is hidden on mobile, CSV is available", async ({ page }) => {
      await openTrip(page);
      await expect(page.getByRole("button", { name: "Download records" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
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
