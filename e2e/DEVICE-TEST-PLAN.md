# Kaheeta PWA — Device Test Plan

Manual verification matrix for what automated e2e (`npm run test:e2e`) **cannot**
cover: real OS install flows, standalone launch, splash screens, iOS storage
eviction, adaptive icons, app shortcuts, and the live service-worker update
prompt across two deployed versions.

> **Prereq:** a deployed (or LAN-served) production build over **HTTPS** — PWA
> install + service worker require a secure context. `npm run build && npm run
> preview -- --host` exposes the preview on your LAN; use a tunnel (e.g. an
> HTTPS dev tunnel) if the device needs TLS.

Legend: ☐ to do · ✅ pass · ❌ fail (file an issue with the ID)

---

## A. Android (Chrome) — real device

| ID | Step | Expected | Result |
|----|------|----------|--------|
| AND-1 | Open the site in Chrome (not installed, not dismissed) and reach **/wallet** | "Install Kaheeta for faster access…" banner appears at the bottom | ☐ |
| AND-2 | Tap **Install** | Native Chrome install dialog opens; accepting adds Kaheeta to the home screen | ☐ |
| AND-3 | Tap **✕** (dismiss) instead | Banner disappears; `localStorage["kaheeta_pwa_banner_dismissed"]` is JSON `{dismissedAt, platform:"android"}` | ☐ |
| AND-4 | Reopen within 30 days | Banner stays hidden | ☐ |
| AND-5 | Launch from the home-screen icon | Opens standalone (no address bar); title is "Kaheeta" | ☐ |
| AND-6 | Inspect the home-screen icon | Adaptive/maskable icon (respects device mask, not a square) | ☐ |
| AND-7 | Long-press the home-screen icon | 4 shortcuts: Add Expense, Add Vaccination, Add Membership, Open Reports | ☐ |
| AND-8 | Tap the **Add Expense** shortcut | App opens at `/wallet?action=add-expense` with the Expenses tab active | ☐ |
| AND-9 | Toggle airplane mode, navigate between tabs | Shell + precached assets load; API calls fail gracefully (no white screen) | ☐ |

## B. iOS (Safari) — real device

| ID | Step | Expected | Result |
|----|------|----------|--------|
| IOS-1 | Open in Safari (not installed) and reach **/wallet** | Instructional banner: "Tap **Share** then **Add to Home Screen**" | ☐ |
| IOS-2 | Tap **✕** (dismiss) | Banner hides; `localStorage` record has `platform:"ios"` | ☐ |
| IOS-3 | Add to Home Screen via the Share sheet, then launch the icon | Standalone; black-translucent status bar; title "Kaheeta"; no Safari chrome | ☐ |
| IOS-4 | Observe launch | Branded splash screen for the device size appears while loading | ☐ |
| IOS-5 | Confirm safe-area handling on a notch / Dynamic Island device | Banner + bottom toasts respect the safe-area inset (not under the home bar) | ☐ |
| IOS-6 | **Eviction sim:** install, then don't open for ~7 days (or clear Safari offline data) and relaunch | If the auth token was evicted/expired → toast: "iOS may have cleared local data…", redirected to login | ☐ |
| IOS-7 | Private Browsing: try to dismiss the banner | App still works; dismissal silently no-ops (banner may reappear next session) | ☐ |

## C. Service-worker update prompt (both platforms) — needs two versions

| ID | Step | Expected | Result |
|----|------|----------|--------|
| SW-1 | Install version N. Deploy version N+1 (any code change → new SW hash) | — | ☐ |
| SW-2 | Reopen the installed app; wait for the SW update check (~on load / periodic) | Toast: "A new version of Kaheeta is available." with **Refresh** / **Later** | ☐ |
| SW-3 | Tap **Refresh** | Page reloads into version N+1 | ☐ |
| SW-4 | Trigger again, tap **Later** | Toast dismisses; **never** auto-reloads (registerType is `prompt`, protecting unsaved CRUD form state) | ☐ |

## D. Desktop (Chrome/Edge) — optional

| ID | Step | Expected | Result |
|----|------|----------|--------|
| DSK-1 | Open in desktop Chrome | Install icon appears in the address bar | ☐ |
| DSK-2 | Install + launch | Opens in its own standalone window titled "Kaheeta" | ☐ |

---

## Known gaps / notes for testers

- **SW registers only after /wallet.** The service worker is registered by
  `useRegisterSW` inside `WallecxApp.vue`, so landing (`/`) and login (`/login`)
  are **not** precached or offline-capable until the user has authenticated and
  opened the wallet at least once. Confirm whether that's acceptable for the
  offline story; if not, registration should move to a global entry point.
- **Private-mode dismissal** is intentionally best-effort (silent fail) — IOS-7.
- `npm run generate-pwa-assets` is referenced in an `index.html` comment but is
  not a `package.json` script — regeneration of splash/icons is manual.

## What automation already covers (`npm run test:e2e`)

- Manifest served + correct fields + every icon reachable (incl. maskable).
- `beforeinstallprompt` capture (the FND-02 fix) — `preventDefault()` fires.
- Android banner: shows on event, **Install** calls the native prompt, dismiss
  writes the 30-day record, reload stays suppressed, `appinstalled` hides it.
- iOS banner (WebKit/iPhone emulation): instructional text, dismiss record, reload suppression.
- SW registers + activates + precaches in the production preview; no spurious update toast on fresh install.
