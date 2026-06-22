import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const baseURL = `http://localhost:${PORT}`;

/**
 * PWA e2e config.
 *
 * The service worker is disabled in `npm run dev` (vite.config.ts → devOptions.enabled
 * is false), so every PWA assertion must run against a PRODUCTION build served by
 * `vite preview`. The webServer below builds first, then previews, so the SW and
 * generated manifest are real.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      // iOS banner is a WebKit/iPhone concern — covered by the webkit-iphone project.
      testIgnore: "**/pwa-install-ios.spec.ts",
    },
    {
      name: "webkit-iphone",
      use: { ...devices["iPhone 13"] },
      testMatch: "**/pwa-install-ios.spec.ts",
    },
  ],
});
