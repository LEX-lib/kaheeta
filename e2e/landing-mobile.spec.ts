import { test, expect } from "@playwright/test";

/**
 * Regression for the mobile landing hero rendering edge-to-edge.
 *
 * `.hero-inner` and `.cta-box` are both `.container <x>` elements. A
 * `padding: V 0` shorthand on the second class silently zeroed `.container`'s
 * horizontal padding (hidden on desktop by the max-width centering, but
 * full-bleed on mobile). They now use vertical longhands so the container's
 * horizontal padding survives.
 */
test.describe("Landing page — mobile layout", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");
  test.use({ viewport: { width: 390, height: 800 } });

  const horizontalPadding = (selector: string) =>
    async ({ page }: { page: import("@playwright/test").Page }) => {
      await page.goto("/");
      const pad = await page.locator(selector).first().evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          left: parseFloat(s.paddingLeft),
          right: parseFloat(s.paddingRight),
        };
      });
      expect(pad.left, `${selector} padding-left`).toBeGreaterThanOrEqual(16);
      expect(pad.right, `${selector} padding-right`).toBeGreaterThanOrEqual(16);
    };

  test("hero content is not edge-to-edge", horizontalPadding(".hero-inner"));
  test("CTA box is not edge-to-edge", horizontalPadding(".cta-box"));
});
