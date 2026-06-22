import { test, expect } from "@playwright/test";
import { dispatchBeforeInstallPrompt } from "./helpers/pwa";

/**
 * Regression test for the FND-02 fix: App.vue must listen for
 * `beforeinstallprompt` and call preventDefault(). The listener is global
 * (registered on the root component), so this needs no auth — any route works.
 *
 * Before the fix there was NO listener, so the event's defaultPrevented stayed
 * false and the Android install banner could never render. This test fails
 * loudly if that regresses.
 */
test.describe("beforeinstallprompt capture (FND-02 fix)", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "beforeinstallprompt is a Chromium-only event",
  );

  test("App.vue captures the event and calls preventDefault()", async ({
    page,
  }) => {
    await page.goto("/");
    const prevented = await dispatchBeforeInstallPrompt(page);
    expect(
      prevented,
      "App.vue must capture beforeinstallprompt and preventDefault()",
    ).toBe(true);
  });
});
