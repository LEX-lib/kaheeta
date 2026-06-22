import { test, expect } from "@playwright/test";
import {
  seedAuth,
  stubPocketBase,
  dispatchBeforeInstallPrompt,
  BANNER_DISMISSED_KEY,
} from "./helpers/pwa";

const ANDROID_BANNER_TEXT =
  "Install Kaheeta for faster access and home-screen shortcuts.";

test.describe("Android install banner", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Android install flow is Chromium-only",
  );

  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await stubPocketBase(page);
    await page.goto("/wallet");
    // Banner stays hidden until the install event is captured.
    await expect(page.getByText(ANDROID_BANNER_TEXT)).toBeHidden();
  });

  test("appears after beforeinstallprompt; Install triggers the native prompt", async ({
    page,
  }) => {
    await dispatchBeforeInstallPrompt(page);
    await expect(page.getByText(ANDROID_BANNER_TEXT)).toBeVisible();

    await page.getByRole("button", { name: "Install Kaheeta" }).click();
    const promptCalled = await page.evaluate(
      () => (window as unknown as { __pwa?: { promptCalled: boolean } }).__pwa?.promptCalled,
    );
    expect(promptCalled).toBe(true);
  });

  test("Dismiss writes a 30-day android record and hides the banner", async ({
    page,
  }) => {
    await dispatchBeforeInstallPrompt(page);
    await expect(page.getByText(ANDROID_BANNER_TEXT)).toBeVisible();

    await page.getByRole("button", { name: "Dismiss install banner" }).click();
    await expect(page.getByText(ANDROID_BANNER_TEXT)).toBeHidden();

    const raw = await page.evaluate(
      (k) => localStorage.getItem(k),
      BANNER_DISMISSED_KEY,
    );
    expect(raw).toBeTruthy();
    const record = JSON.parse(raw as string);
    expect(record.platform).toBe("android");
    expect(typeof record.dismissedAt).toBe("string");
  });

  test("stays suppressed after reload within the 30-day window", async ({
    page,
  }) => {
    await dispatchBeforeInstallPrompt(page);
    await page.getByRole("button", { name: "Dismiss install banner" }).click();
    await page.reload();
    await dispatchBeforeInstallPrompt(page);
    await expect(page.getByText(ANDROID_BANNER_TEXT)).toBeHidden();
  });

  test("appinstalled clears the prompt and hides the banner", async ({
    page,
  }) => {
    await dispatchBeforeInstallPrompt(page);
    await expect(page.getByText(ANDROID_BANNER_TEXT)).toBeVisible();

    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await expect(page.getByText(ANDROID_BANNER_TEXT)).toBeHidden();
  });
});
