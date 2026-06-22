import { test, expect } from "@playwright/test";
import { seedAuth, stubPocketBase } from "./helpers/pwa";

/**
 * Regression for the mobile dark-mode "bleeding shadow" on the tab scroller.
 *
 * PrimeVue's TabList scroll (prev/next) buttons and their fade `box-shadow`
 * default to Aura's near-black `{content.background}`, which smeared a dark
 * gradient over the navy tablist. They're now remapped to --color-surface-card
 * (navy) under `.my-app-dark .wallecx-root`. A narrow viewport forces the
 * tablist to overflow so the scroll buttons actually render.
 */
test.describe("Wallet tab scroller — mobile dark mode", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");
  test.use({ viewport: { width: 360, height: 780 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem("kaheeta:theme", "dark"),
    );
    await seedAuth(page);
    await stubPocketBase(page);
    await page.goto("/wallet");
    await expect(page.locator("html")).toHaveClass(/my-app-dark/);
  });

  test("scroll buttons are navy, not Aura near-black", async ({ page }) => {
    const navButton = page.locator(".p-tablist-nav-button").first();
    await expect(navButton).toBeVisible();

    const bg = await navButton.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(bg).toBe("rgb(10, 44, 82)"); // #0a2c52 — surface-card (dark)
  });
});
