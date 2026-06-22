import { test, expect } from "@playwright/test";

/**
 * The floating scroll-to-top button is hidden until the user scrolls past the
 * features heading (".section-title"), then returns the page to the top.
 */
test.describe("Landing scroll-to-top button", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  test("hidden until past the features heading, then scrolls to top", async ({
    page,
  }) => {
    await page.goto("/");
    const btn = page.getByRole("button", { name: "Scroll to top" });
    await expect(btn).toBeHidden();

    // Scroll the features heading above the viewport top.
    await page.evaluate(() => {
      document.querySelector(".section-title")?.scrollIntoView();
      window.scrollBy(0, 500);
    });
    await expect(btn).toBeVisible();

    await btn.click();
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeLessThan(50);
    await expect(btn).toBeHidden();
  });
});
