# Tech Stack

**Analysis Date:** 2026-06-30

## Runtime & Language

**Primary:**
- TypeScript ~6.0.0 — all source files in `src/`
- JavaScript (ES Modules) — `pocketbase/pb_hooks/kaheeta_splits.pb.js` (PocketBase server-side hooks run in goja, not Node)

**Runtime:**
- Node.js `^20.19.0 || >=22.12.0` (enforced via `engines` in `package.json`)
- Browser (SPA) — the production artifact is a static site served to browsers

**Package Manager:**
- npm — lockfile: `package-lock.json` present and committed

## Frameworks & Core Libraries

**Frontend:**
- Vue 3 `^3.5.32` — Composition API throughout; `<script setup>` style in all components
- Vue Router `^5.0.4` — `createWebHistory`, single `src/router/index.ts`; `beforeEach` guard enforces auth
- Pinia `^3.0.4` — store per feature; auth store at `src/stores/auth.ts` uses Composition API style

**Validation:**
- Zod `^4.4.3` — schema definitions at `src/lib/wallecx/expenseSchema.ts` and co-located per-feature

**Date Handling:**
- Day.js `^1.11.21` — used in period/budget calculations in `src/lib/wallecx/period.ts`

## Build & Tooling

**Bundler:**
- Vite `^8.0.8` — config at `vite.config.ts`; manual chunk splitting for `chart-js`, `jsbarcode`, `image-compression`, `primevue`, and `vendor`

**Type Checking:**
- vue-tsc `^3.2.6` — run via `npm run type-check`; project references via `tsconfig.json` → `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.vitest.json`
- `noUncheckedIndexedAccess: true` enforced in `tsconfig.app.json`

**Linting:**
- oxlint `~1.60.0` — runs first (`lint:oxlint`), config at `.oxlintrc.json`
- ESLint `^10.2.1` — runs second (`lint:eslint`); config at `eslint.config.ts`; plugins: `eslint-plugin-vue ~10.8.0`, `@vue/eslint-config-typescript ^14.7.0`, `@vitest/eslint-plugin ^1.6.16`, `eslint-plugin-oxlint ~1.60.0`
- Lint pipeline: `run-s lint:oxlint lint:eslint` (oxlint → eslint, sequential)

**Formatting:**
- Prettier `3.8.3` — `npm run format` targets `src/`; `eslint-config-prettier` disables conflicting ESLint rules

**Component Auto-Import:**
- `unplugin-vue-components ^32.1.0` + `@primevue/auto-import-resolver ^4.5.5` — PrimeVue components require no import statement; `components.d.ts` is generated and gitignored

**Task Runner:**
- `npm-run-all2 ^8.0.4` — powers `run-p` (parallel) and `run-s` (sequential) in scripts

**PWA:**
- `vite-plugin-pwa ^1.3.0` — `registerType: 'prompt'` (never `autoUpdate`); Workbox `generateSW` strategy; SW disabled in dev
- `workbox-build ^7.4.1`, `workbox-window ^7.4.1`
- PWA asset generation: `@vite-pwa/assets-generator ^1.0.2`

**Dev Extras:**
- `vite-plugin-vue-devtools ^8.1.1` — injected in non-production builds only

## UI / Styling

**Component Library:**
- PrimeVue `^4.5.5` — all UI components (Card, Button, Tabs, Dialog, Drawer, Form, etc.); auto-imported via `unplugin-vue-components`
- `@primeuix/themes ^2.0.3` — Aura preset customized with brand navy `#002244` / amber `#E89820`; configured in `src/main.ts`
- `@primevue/forms ^4.5.5` — form handling
- PrimeIcons `^7.0.0` — icon font

**CSS Framework:**
- Tailwind CSS `^4.3.0` — v4 (Vite plugin via `@tailwindcss/vite ^4.3.0`); utility classes used alongside PrimeVue
- Dark mode: `.my-app-dark` class on `<html>`, toggled by `src/composables/useTheme.ts`, pre-hydration script in `index.html` prevents flash

**Icons:**
- `iconify-icon ^3.0.2` — registered as a custom element (`isCustomElement` in `vite.config.ts`); MDI icons bundled locally at `src/lib/mdi-icons.json` to avoid CDN fetch on cold load; additional icons fetched at runtime from Iconify API

**Notifications:**
- `vue-sonner ^2.0.9` — toast notifications; styles imported globally in `src/main.ts`

**QR / Barcode:**
- `qrcode.vue ^3.9.1` — QR code display component
- `jsbarcode ^3.12.3` — barcode rendering (separate chunk in build)

**PDF:**
- `pdfjs-dist ^6.0.227` — PDF parsing/rendering
- `vue-pdf-embed ^2.1.4` — Vue wrapper for PDF display

**Charts:**
- `chart.js ^4.5.1` — expense/budget charting (separate chunk in build)

**Image Handling:**
- `browser-image-compression ^2.0.2` — client-side image compression before upload; used in `src/lib/wallecx/compressToWebP.ts`; separate build chunk

## State Management

- **Pinia `^3.0.4`** — one store per domain slice:
  - `src/stores/auth.ts` — authentication state, wraps `pb.authStore`
  - Additional stores are co-located in `src/stores/` (feature-specific)
- **localStorage** — theme preference (`kaheeta:theme`), perf baseline (`kaheeta:perf-baseline`); keys prefixed `kaheeta:`
- **sessionStorage** — per-session perf flags (`kaheeta:perf-session:<collection>`)
- No Vuex; no global reactive state outside Pinia stores and PocketBase's built-in `authStore`

## Testing

**Unit / Integration:**
- Vitest `^4.1.4` — config at `vitest.config.ts`; extends Vite config; environment: `jsdom`
- `@vue/test-utils ^2.4.6` — Vue component mounting
- `jsdom ^29.0.2` — DOM simulation; `@types/jsdom ^28.0.1`
- Run: `npx vitest run` (all once), `npx vitest run <file>` (single file), `npx vitest run -t "<name>"` (by name fragment)

**E2E:**
- Playwright `^1.61.0` — config at `playwright.config.ts`; test directory `e2e/`
- Projects: `chromium` (Desktop Chrome) and `webkit-iphone` (iPhone 13 device emulation)
- Runs against a production build served by `vite preview` on port 4173 (required for real PWA/SW testing)
- Run: `npm run test:e2e`, UI mode: `npm run test:e2e:ui`

**Test file locations:**
- Unit: `src/lib/wallecx/*.test.ts`, `src/lib/pocketbase/__tests__/*.spec.ts`
- E2E: `e2e/**/*.spec.ts`

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `pocketbase` | `^0.27.0` | Backend BaaS client — all data access; singleton at `src/lib/pocketbase/index.ts` |
| `@vueuse/core` | `^14.3.0` | Vue composition utilities (used in composables) |
| `jiti` | `^2.6.1` | Runtime TypeScript execution (used for ESLint config loading) |

---

*Stack analysis: 2026-06-30*
