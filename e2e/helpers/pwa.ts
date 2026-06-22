import type { Page } from "@playwright/test";

/** PocketBase's default localStorage auth key. */
export const PB_AUTH_KEY = "pocketbase_auth";
/** PwaInstallBanner's dismissal key (BANNER_DISMISSED_KEY in the component). */
export const BANNER_DISMISSED_KEY = "kaheeta_pwa_banner_dismissed";

function base64url(value: string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Build an unsigned JWT whose `exp` is far in the future. PocketBase's
 * `authStore.isValid` only base64-decodes the payload and checks `exp`
 * client-side — it never verifies the signature — so this passes `isValid`
 * with no backend, letting us render auth-gated routes offline.
 */
export function makeFakeToken(secondsFromNow = 60 * 60 * 24 * 365): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + secondsFromNow;
  const payload = base64url(
    JSON.stringify({
      id: "e2e_user",
      type: "auth",
      collectionId: "_pb_users_auth_",
      exp,
    }),
  );
  return `${header}.${payload}.e2e_signature`;
}

/**
 * Seed a valid PocketBase session in localStorage BEFORE the app boots, so the
 * router guard passes and WallecxApp (which hosts PwaInstallBanner) mounts
 * without a real login. Runs as an init script → executes before any app JS.
 */
export async function seedAuth(page: Page, name = "E2E Tester"): Promise<void> {
  const token = makeFakeToken();
  const record = {
    id: "e2e_user",
    collectionId: "_pb_users_auth_",
    collectionName: "users",
    email: "e2e@example.com",
    name,
    verified: true,
  };
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [PB_AUTH_KEY, JSON.stringify({ token, record })] as [string, string],
  );
}

/**
 * Stub every PocketBase REST call so /wallet loads deterministically offline.
 * List endpoints return an empty, well-formed getList result; everything else
 * returns 200 `{}`. Keeps the 401 auto-logout path (pb.afterSend) from firing.
 */
export async function stubPocketBase(page: Page): Promise<void> {
  await page.route("**/api/**", (route) => {
    const url = route.request().url();
    if (url.includes("/api/collections/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          page: 1,
          perPage: 200,
          totalItems: 0,
          totalPages: 0,
          items: [],
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
}

/**
 * Dispatch a synthetic, cancelable `beforeinstallprompt` on window — the event
 * Chrome fires and that App.vue's listener (the FND-02 fix) must capture.
 * Records prompt() invocations on `window.__pwa` for later assertions.
 * Returns the event's `defaultPrevented` flag: true proves the listener ran.
 */
export async function dispatchBeforeInstallPrompt(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const w = window as unknown as { __pwa: { promptCalled: boolean } };
    w.__pwa = { promptCalled: false };
    const event = new Event("beforeinstallprompt", {
      cancelable: true,
    }) as Event & {
      platforms: string[];
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string; platform: string }>;
    };
    event.platforms = ["web"];
    event.prompt = () => {
      w.__pwa.promptCalled = true;
      return Promise.resolve();
    };
    event.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
}
