import { test, expect } from "@playwright/test";
import { seedAuth, stubPocketBase } from "./helpers/pwa";

/**
 * The "Download records" button is hidden on mobile, shown on desktop. It's
 * wrapped in a plain `<div class="hidden sm:contents">` rather than putting
 * `hidden` on the PrimeVue Button — PrimeVue's runtime `.p-button{display}`
 * would otherwise win over Tailwind's `.hidden` (equal specificity, later
 * source) and the button stayed visible on mobile.
 */
test.describe("Download records visibility", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  test("hidden on mobile, shown on desktop (Vaccinations tab)", async ({
    page,
  }) => {
    await seedAuth(page);
    await stubPocketBase(page);

    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/wallet");
    const dl = page.getByRole("button", { name: "Download records" });
    await expect(dl).toBeHidden();

    await page.setViewportSize({ width: 1100, height: 800 });
    await expect(dl).toBeVisible();
  });
});
