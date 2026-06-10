# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # run-p type-check + build-only (production build + PWA)
npm run type-check   # vue-tsc --build (run this after non-trivial TS/Vue edits)
npm run test:unit    # Vitest in watch mode
npm run lint         # oxlint --fix then eslint --fix
npm run format       # prettier
```

Run tests once / a single test (CI-style, no watch):

```sh
npx vitest run                                   # all tests once
npx vitest run src/lib/wallecx/period.test.ts    # one file
npx vitest run -t "name fragment"                # by test name
```

Requires `VITE_API_BASE_URL` in `.env*` (points at the PocketBase backend). `local.jsonc` holds dev login autofill credentials and is gitignored.

## The big picture: two apps in one SPA

This is **not** a single product. It's the **delveen** brand site fronting the **Kaheeta** app, sharing one Vue Router instance (`src/router/index.ts`):

- `/` → `landing/LandingPage.vue` — public delveen marketing page (dark navy theme baked into scoped CSS). Login entry points here route to `/login?redirect=/wallet`.
- `/wallet` → `wallecx/WallecxApp.vue` — the actual Kaheeta app, `meta.requiresAuth`. The `beforeEach` guard bounces unauthenticated users to `/login`.
- `/login` → `Login.vue`. On success, redirects to `?redirect=` or defaults to `/wallet`.

`App.vue` renders one shared navbar — `KaheetaNavBar` — across **all** routes inside a flex-column shell (`<div class="flex min-h-screen flex-col">` → navbar + `<main class="flex flex-1 flex-col">`). The navbar adapts to auth state via `useProfileMenu`: logged-out shows a theme toggle + "Log in" CTA; logged-in shows the profile menu (My Wallet / theme toggle / Log out). `App.vue` passes `:show-login="route.name !== 'login'"` so the login page doesn't show a redundant "Log in" button.

## The "wallecx" vs "kaheeta" boundary (read before renaming anything)

This app was extracted and rebranded from a feature called "Wallecx". The string `wallecx` survives in several roles, and they are **not** interchangeable:

- **`wallecx_*` = PocketBase collection names** (`wallecx_vaccinations`, `wallecx_memberships`, `wallecx_expenses`, `wallecx_expense_categories`, `wallecx_expense_budgets`). These are real tables on a **shared backend** — **never rename them** or data access breaks.
- **`.wallecx-*` CSS classes and `WallecxApp`/`WallecxSkeleton`/`WallecxToolbar` filenames** are internal and intentionally left un-rebranded. Don't churn them.
- **`kaheeta:*` localStorage keys** (`kaheeta:theme`, `kaheeta:view-mode`, etc.) and all user-facing display text are the rebranded surface. New keys should use the `kaheeta:` prefix.

The backend is shared with the origin project (default `VITE_API_BASE_URL=https://lexarium-backend.fly.dev`); its CORS is wildcard, so no origin allowlisting is needed.

## PocketBase data layer (`src/lib/pocketbase/`)

All backend access goes through this layer — components never `new PocketBase()`:

- `index.ts` exports the singleton `pb`. `stores/auth.ts` (Pinia) wraps `pb.authStore` for `isLoggedIn` / `login` / `logout`.
- **List reads use `instrumentedGetFullList<T>(collection, options)`** (`perfInstrument.ts`), not `pb.collection().getFullList()` directly. It records payload size / duration to `kaheeta:perf-*` and logs counts only (never record content).
- **Writes go through `mapToUpdateX(record)` mappers** (`vaccinationMapper.ts`, `membershipMapper.ts`, `expenseMapper.ts`, `expenseBudgetMapper.ts`) that strip a typed record down to its writable fields before create/update.

Per-feature types live in `src/types/wallecx/<feature>/types.d.ts`; feature helpers (image compression, currency, period math, zod schemas) live in `src/lib/wallecx/`.

## Conventions that aren't obvious from a single file

- **PrimeVue components are auto-imported** via `unplugin-vue-components` + `PrimeVueResolver` (`vite.config.ts`). Use `<Card>`, `<Button>`, `<Tabs>`, `<Dialog>`, `<Form>`, etc. with **no import statement**. `components.d.ts` is generated and gitignored — don't commit or hand-edit it.
- **`<iconify-icon>` is a registered custom element** (`isCustomElement` in `vite.config.ts`). Icons are `<iconify-icon icon="mdi:...">`, fetched at runtime from the Iconify API.
- **Dark mode** is the `.my-app-dark` class on `<html>`, toggled by `composables/useTheme.ts` and persisted to `kaheeta:theme`. An inline script in `index.html` applies it pre-hydration to prevent a flash — keep that script's key in sync with `useTheme`. The PrimeVue Aura preset (navy `#002244` / amber `#E89820`) is customized in `main.ts`.
- **Mobile-first dialogs:** `composables/useMobileEnv` / `useIsMobile` drive layout. `BaseMobileDialog.vue` renders as a bottom `Drawer` on mobile and a `Dialog` on desktop; `assets/wallecx-overrides.css` handles safe-area insets, 44px touch targets, and iOS auto-zoom prevention.
- **PWA:** `vite-plugin-pwa` with `registerType: 'prompt'` (deliberately never `autoUpdate` — CRUD forms hold unsaved state). The service worker is disabled in dev. `WallecxApp.vue`'s `onMounted` handles iOS 7-day localStorage eviction (re-checks `pb.authStore.isValid`, calls `navigator.storage.persist()`).
- TypeScript runs with `noUncheckedIndexedAccess` (stricter than the source project) — indexed access is `T | undefined`.
