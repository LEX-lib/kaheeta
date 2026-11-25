import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedAuth, stubPocketBase } from "./helpers/pwa";
import { mockSplitsApi } from "./helpers/splits";

/**
 * Section F — mobile / desktop parity for the group surface. GroupsTab renders
 * a two-pane rail + inline detail on desktop and a drill-down on mobile
 * (useIsMobile, 767px breakpoint) — no Dialog/Drawer for the group itself. The
 * add-expense form (BaseMobileDialog) still follows the mobile-dialog split, so
 * we also assert ≥16px inputs there (iOS no-zoom rule).
 */
test.describe("Split group detail — viewport parity", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  async function openTrip(page: import("@playwright/test").Page) {
    await page.goto("/wallet");
    await page.getByRole("tab", { name: /groups/i }).click();
    await page.getByText("Trip", { exact: true }).first().click();
    // Detail content is loaded once the action toolbar is present.
    await expect(page.getByRole("button", { name: "Add expense" })).toBeVisible();
  }

  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await stubPocketBase(page);
    await mockSplitsApi(page);
  });

  test("desktop renders the group as an inline two-pane (no modal)", async ({ page }) => {
    // default chromium viewport is desktop-width
    await openTrip(page);

    await expect(page.locator(".groups-layout")).toBeVisible();
    await expect(page.locator(".groups-rail")).toBeVisible();
    await expect(page.locator(".groups-detail")).toBeVisible();
    await expect(page.locator(".p-dialog")).toHaveCount(0);
    await expect(page.locator(".p-drawer")).toHaveCount(0);
  });

  test("desktop JSON backup downloads from the group menu", async ({ page }) => {
    await openTrip(page);
    await page.getByRole("button", { name: "Group actions" }).click();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("menuitem", { name: "Download JSON" }).click(),
    ]);
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

    test("drills down from the rail into the inline detail (no Drawer)", async ({ page }) => {
      await openTrip(page);

      await expect(page.locator(".groups-detail")).toBeVisible();
      await expect(page.locator(".groups-rail")).toBeHidden();
      await expect(page.locator(".p-drawer")).toHaveCount(0);
      await expect(page.locator(".p-dialog")).toHaveCount(0);

      // Back returns to the group rail.
      await page.getByRole("button", { name: "Back to groups" }).click();
      await expect(page.locator(".groups-rail")).toBeVisible();
      await expect(page.locator(".groups-detail")).toBeHidden();
    });

    test("CSV is available on mobile, the JSON backup is not", async ({ page }) => {
      await openTrip(page);
      await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();

      await page.getByRole("button", { name: "Group actions" }).click();
      await expect(page.getByRole("menuitem", { name: "Download JSON" })).toHaveCount(0);
      await expect(page.getByRole("menuitem", { name: "Delete group" })).toBeVisible();
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
