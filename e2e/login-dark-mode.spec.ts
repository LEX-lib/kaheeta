import { test, expect } from "@playwright/test";

/**
 * Regression for dark-mode color bleeding on the login page.
 *
 * The brand showcase panel must stay NAVY in both themes. It uses
 * --color-brand-navy (theme-independent), NOT --color-brand-primary (which
 * inverts to amber under .my-app-dark). If it regresses to amber, the amber
 * accents on it (.em "digitized.", the accent rule, the feature icons) turn
 * amber-on-amber and disappear — exactly the reported bug.
 */
test.describe("Login brand panel — dark mode", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  test.beforeEach(async ({ page }) => {
    // The inline pre-hydration script in index.html reads this key.
    await page.addInitScript(() =>
      localStorage.setItem("kaheeta:theme", "dark"),
    );
    await page.goto("/login");
    await expect(page.locator("html")).toHaveClass(/my-app-dark/);
  });

  test("brand panel stays navy, not amber", async ({ page }) => {
    const bg = await page
      .locator(".brand-panel")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe("rgb(0, 34, 68)"); // #002244 brand navy
  });

  test("amber accent stays visible against the navy panel", async ({ page }) => {
    const em = page.locator(".brand-title .em");
    await expect(em).toBeVisible();

    const color = await em.evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe("rgb(232, 152, 32)"); // #e89820 amber

    const bg = await page
      .locator(".brand-panel")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    // The whole point: accent must not equal the panel background.
    expect(color).not.toBe(bg);
  });
});
