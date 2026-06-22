import { test, expect } from "@playwright/test";

interface ManifestIcon {
  src: string;
  purpose?: string;
}

test.describe("PWA manifest & icons", () => {
  test("injects a manifest link and serves a valid manifest", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      /manifest\.webmanifest/,
    );

    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBeTruthy();

    const manifest = await res.json();
    expect(manifest.name).toBe("Kaheeta");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
    expect(manifest.shortcuts?.length).toBe(4);
    // A maskable icon is required for adaptive Android home-screen icons.
    expect(
      manifest.icons.some((i: ManifestIcon) =>
        String(i.purpose).includes("maskable"),
      ),
    ).toBeTruthy();
  });

  test("declares theme-color meta tag(s)", async ({ page }) => {
    await page.goto("/");
    const count = await page.locator('meta[name="theme-color"]').count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("every manifest icon is reachable", async ({ page, request }) => {
    await page.goto("/");
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    for (const icon of manifest.icons as ManifestIcon[]) {
      const res = await request.get("/" + String(icon.src).replace(/^\//, ""));
      expect(res.ok(), `icon ${icon.src} should be reachable`).toBeTruthy();
    }
  });
});
