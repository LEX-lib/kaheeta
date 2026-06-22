import { test, expect } from "@playwright/test";
import { seedAuth, stubPocketBase } from "./helpers/pwa";

/**
 * The SW is registered via `useRegisterSW` inside WallecxApp.vue (not injected
 * globally — injectRegister is left at its default and the virtual register
 * module is imported), so registration only happens once /wallet mounts.
 * These tests therefore seed auth and visit /wallet.
 */
test.describe("Service worker (production preview)", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "SW assertions run on Chromium",
  );

  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await stubPocketBase(page);
  });

  test("registers and activates after reaching the wallet", async ({ page }) => {
    await page.goto("/wallet");
    const active = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return !!reg.active;
    });
    expect(active).toBeTruthy();
  });

  test("precaches assets into a workbox cache", async ({ page }) => {
    await page.goto("/wallet");
    await page.evaluate(() => navigator.serviceWorker.ready);
    const cacheKeys = await page.evaluate(() => caches.keys());
    expect(
      cacheKeys.some((k) => /workbox|precache/i.test(k)),
      `expected a workbox precache cache, got: ${cacheKeys.join(", ")}`,
    ).toBeTruthy();
  });

  test("does not show the SW update toast on a fresh install", async ({
    page,
  }) => {
    await page.goto("/wallet");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect(
      page.getByText("A new version of Kaheeta is available"),
    ).toBeHidden();
  });

  // Triggering needRefresh requires a second SW build to install mid-session,
  // which can't be reproduced deterministically against one static preview.
  // The live "new version → Refresh/Later toast" path is covered manually in
  // e2e/DEVICE-TEST-PLAN.md (§ SW update).
  test.fixme(
    "shows the Refresh/Later toast when a new SW is waiting",
    async () => {},
  );
});
