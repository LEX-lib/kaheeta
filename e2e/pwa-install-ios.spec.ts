import { test, expect } from "@playwright/test";
import { seedAuth, stubPocketBase, BANNER_DISMISSED_KEY } from "./helpers/pwa";

/**
 * iOS Safari never fires `beforeinstallprompt`, so the banner shows an
 * instructional "Share → Add to Home Screen" message instead of an Install
 * button. This spec runs only on the webkit-iphone project (see
 * playwright.config.ts), whose iPhone UA makes isIosSafari() true.
 */
test.describe("iOS install banner (instructional)", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await stubPocketBase(page);
    await page.goto("/wallet");
  });

  test("shows the Add to Home Screen instructions on iOS Safari", async ({
    page,
  }) => {
    await expect(page.getByText("Add to Home Screen")).toBeVisible();
  });

  test("Dismiss writes an ios 30-day record and hides the banner", async ({
    page,
  }) => {
    await expect(page.getByText("Add to Home Screen")).toBeVisible();

    await page.getByRole("button", { name: "Dismiss install banner" }).click();
    await expect(page.getByText("Add to Home Screen")).toBeHidden();

    const raw = await page.evaluate(
      (k) => localStorage.getItem(k),
      BANNER_DISMISSED_KEY,
    );
    const record = JSON.parse(raw as string);
    expect(record.platform).toBe("ios");
  });

  test("stays suppressed after reload within the 30-day window", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Dismiss install banner" }).click();
    await page.reload();
    await expect(page.getByText("Add to Home Screen")).toBeHidden();
  });
});
