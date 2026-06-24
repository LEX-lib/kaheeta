import { test, expect } from "@playwright/test";

/**
 * Landing uses PrimeVue's <ScrollTop> (target="window", threshold 400px): the
 * button appears after scrolling down and returns the page to the top.
 */
test.describe("Landing scroll-to-top (PrimeVue ScrollTop)", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  test("appears after scrolling, returns to top, then hides", async ({
    page,
  }) => {
    await page.goto("/");
    const btn = page.locator(".p-scrolltop");
    await expect(btn).toBeHidden();

    // Scroll past the threshold.
    await page.evaluate(() => window.scrollTo(0, 900));
    await expect(btn).toBeVisible();

    await btn.click();
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeLessThan(50);
    await expect(btn).toBeHidden();
  });
});
