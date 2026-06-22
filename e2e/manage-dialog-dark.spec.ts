import { test, expect } from "@playwright/test";
import { seedAuth, stubPocketBase } from "./helpers/pwa";

/**
 * Regression for the edit-modal "bleeding background" in mobile dark mode.
 *
 * The sticky Save/Cancel action bar is remapped to the navy surface globally,
 * but the Drawer surface dark override lived as a scoped :deep() rule in
 * BaseMobileDialog — and PrimeVue teleports the Drawer to <body>, outside the
 * scoped subtree, so it never matched. Result: near-black drawer content with a
 * navy action-bar band bleeding through. Both must share the navy surface.
 */
test.describe("Manage dialog (mobile drawer) — dark mode", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");
  test.use({ viewport: { width: 390, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem("kaheeta:theme", "dark"),
    );
    await seedAuth(page);
    await stubPocketBase(page);
    await page.goto("/wallet");
    await expect(page.locator("html")).toHaveClass(/my-app-dark/);
  });

  test("drawer surface and sticky action bar share the navy surface", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /add vaccination/i }).click();

    await expect(page.locator(".p-drawer")).toBeVisible();

    const bgs = await page.evaluate(() => {
      const get = (s: string) => {
        const el = document.querySelector(s);
        return el ? getComputedStyle(el).backgroundColor : "NULL";
      };
      return {
        drawer: get(".p-drawer"),
        content: get(".p-drawer-content"),
        actions: get(".wallecx-manage-actions"),
      };
    });

    const NAVY = "rgb(10, 44, 82)"; // #0a2c52 surface-card (dark)
    // Drawer surface must be navy and the action bar must match it (no band).
    expect(bgs.drawer).toBe(NAVY);
    expect(bgs.actions).toBe(NAVY);
  });
});
