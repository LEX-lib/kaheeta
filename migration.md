# Wallecx → Kaheeta Migration Plan

Extract the **Wallecx** feature from Lexarium (`lex-lib.github.io`) into the standalone Vue 3 PWA at `/Users/cedrickjhandeferia/WebstormProjects/kaheeta`, **rebranding it to "Kaheeta"**.

> This plan was rewritten on 2026-06-05 after auditing the live source. The previous version was written for an older, smaller Wallecx (vaccinations + memberships only) and is superseded. See **§0 Corrections** for what changed.

---

## Decisions (locked)

| Decision | Choice |
|---|---|
| **Scope** | **Full current app** — Vaccinations + Memberships + **Expenses** (charts, budgets, reports) |
| **Branding** | **Rebrand to "Kaheeta"** — manifest name, `<title>`, theme key, `wallecx:*` localStorage prefixes, and user-facing display strings |
| **Backend** | **Same PocketBase** — `https://lexarium-backend.fly.dev` via `VITE_API_BASE_URL` |

---

## 0. Corrections vs. the old plan

The old plan was stale. Verified differences against the live source:

- **kaheeta is already scaffolded** (Vite 8, Vue Router 5, Pinia 3, ESLint 10, TS 6, Vitest 4, Node 24 tooling). **Do not re-scaffold and do not downgrade** to the old pinned versions (`@types/node@22`, `@vue/tsconfig@0.7`, `@tsconfig/node22`, etc.). Keep kaheeta's existing toolchain; only **add missing runtime deps** (§2).
- Wallecx is now **24 reachable components**, not 15. The whole **Expenses feature** exists: `ExpensesTab`, `ExpensesListView`, `ExpensesToolbar`, `ExpenseItem`, `ExpensesReportsView`, `ManageExpense`, `ManageBudget`. Plus `BaseMobileDialog`, `DragHandle`, `WallecxSkeleton`.
- A whole **`src/lib/wallecx/`** directory exists and is required: `compressToWebP.ts`, `currency.ts`, `expenseSchema.ts`, `period.ts`.
- **5 type dirs**, not 2: `vaccinations`, `memberships`, `expenses`, `expense-categories`, `expense-budgets`.
- Composables are `useIsMobile`, `useMobileEnv`, `useChartTheme`, `useTheme`. **`useDevCredentials.ts` no longer exists** — ignore all references to it.
- Two new deps the old plan missed: **`chart.js`** (expense reports) and **`@vueuse/core`** (`useMediaQuery` inside `useMobileEnv`).
- The session-expiry redirect is at **`WallecxApp.vue:82`**, not line 59.
- Source uses **rolldown-vite** (`build.rolldownOptions` + `codeSplitting.groups`). kaheeta uses standard Vite 8 → convert to `build.rollupOptions.output.manualChunks`.
- `pdfjs-dist` is a peer of `vue-pdf-embed` and is **not** in the source `package.json` — install it explicitly.

---

## ⚠️ Critical gotcha: what "rebrand" must NOT touch

The string "wallecx" appears in three distinct roles. Only **one** gets rebranded:

| Role | Examples | Rebrand? |
|---|---|---|
| **User-facing display text** | `<h1>Wallecx</h1>`, `"A new version of Wallecx is available"`, `aria-label="Install Wallecx"`, `<title>`, PWA `manifest.name`/`short_name`/`description` | ✅ **YES → "Kaheeta"** |
| **localStorage *preference* keys** | `wallecx:view-mode`, `wallecx:memberships-sort-mode`, `wallecx:expense-sort`, `wallecx:expense-period*`, `wallecx_pwa_banner_dismissed`, `wallecx:perf-*` | ✅ Rename `wallecx*` → `kaheeta*` (fresh app, no existing users) |
| **PocketBase collection names** | `wallecx_vaccinations`, `wallecx_memberships`, `wallecx_expenses`, `wallecx_expense_categories`, `wallecx_expense_budgets` | ❌ **NEVER** — these are real tables in the shared backend |
| **Internal CSS classes & component filenames** | `.wallecx-root`, `.wallecx-main-tabs`, `.wallecx-sub-tabs`, `WallecxApp.vue`, `WallecxSkeleton.vue`, `WallecxToolbar.vue` | ❌ Leave as-is (cosmetic, high churn, zero user benefit) |

**Rule of thumb:** `wallecx_` (underscore) = backend collection, never touch. `wallecx:` (colon) = pref key, rename. Bare "Wallecx" in markup/strings = display, rebrand.

---

## Ordered execution checklist

```
1.  Add runtime + dev dependencies (§2) — do NOT touch existing scaffold deps
2.  Copy source trees (§3): components, lib, types, composables, store, assets, public
3.  Rebrand display strings "Wallecx" → "Kaheeta" (§4) — respecting the gotcha table above
4.  Rename localStorage pref keys wallecx* → kaheeta* (§4)
5.  useTheme.ts: 'lexarium:theme' → 'kaheeta:theme' (§4)
6.  WallecxApp.vue:82 redirect '/projects/wallecx' → '/' (§4)
7.  Write vite.config.ts (§5 — rollupOptions + VitePWA, manifest rebranded, start_url '/')
8.  Write env.d.ts, confirm tsconfig.app.json paths (§5)
9.  Rewrite index.html (§5 — title, theme key, icons; drop dead apple-splash links unless assets copied)
10. Write main.ts (§6 — PrimeVue + Aura preset; REMOVE MotionPlugin)
11. Write App.vue + KaheetaNavBar.vue (§6)
12. Write router/index.ts (§7) and delete src/stores/counter.ts + src/__tests__/App.spec.ts
13. Create .env / .env.development / .env.production with VITE_API_BASE_URL (§8)
14. npm run dev — verify login → all three tabs render
15. npm run type-check — fix residual @/ path errors
16. npm run build — verify PWA manifest + chunks
17. PocketBase CORS: add kaheeta's dev/prod origin to allowed origins (§9)
```

---

## 1. Scaffold

**Already done.** kaheeta has `package.json`, `vite.config.ts`, `tsconfig.*`, `src/{App.vue,main.ts,router,stores}`. Keep it. Just delete the placeholders later: `src/stores/counter.ts`, `src/__tests__/App.spec.ts`.

---

## 2. Dependencies (delta only)

kaheeta already has `vue`, `vue-router`, `pinia` and the full dev toolchain (vite 8, vue-tsc, eslint, oxlint, vitest, prettier, etc.). **Only add what's missing.**

### Runtime (`dependencies`)

```bash
npm install \
  primevue @primeuix/themes primeicons @primevue/forms \
  pocketbase \
  "vue-sonner@^2.0.9" \
  dayjs \
  jsbarcode qrcode.vue \
  browser-image-compression \
  iconify-icon \
  vue-pdf-embed pdfjs-dist \
  chart.js \
  @vueuse/core \
  zod \
  tailwindcss @tailwindcss/vite
```

| Package | Used by |
|---|---|
| `primevue`, `@primeuix/themes`, `primeicons` | All components; Aura preset in `main.ts` |
| `@primevue/forms` (+ `/resolvers/zod`) | `ManageVaccination/Membership/Expense/Budget`, `Login` |
| `pocketbase` | `lib/pocketbase/index.ts` + every data component |
| `vue-sonner@^2.0.9` | toasts everywhere (pin `^2.0.9`; `2.0.8` drags in `nuxt`) |
| `dayjs` (+ `plugin/quarterOfYear`) | date formatting, `lib/wallecx/period.ts` |
| `jsbarcode`, `qrcode.vue` | `BarcodeDisplay.vue` |
| `browser-image-compression` | `lib/wallecx/compressToWebP.ts` |
| `iconify-icon` | nearly every component (web component) |
| `vue-pdf-embed` + `pdfjs-dist` | `AttachmentPreview.vue` (pdfjs is vue-pdf-embed's peer) |
| `chart.js` | `ExpensesReportsView.vue` (via PrimeVue `Chart`) + `useChartTheme` |
| `@vueuse/core` | `useMobileEnv.ts` (`useMediaQuery`) |
| `zod` | manage forms + `expenseSchema.ts` + `Login.vue` |
| `tailwindcss` + `@tailwindcss/vite` | `assets/base.css` (`@import "tailwindcss"`) |

### Dev (`devDependencies`) — only the PWA/auto-import bits kaheeta lacks

```bash
npm install -D \
  unplugin-vue-components \
  @primevue/auto-import-resolver \
  vite-plugin-pwa workbox-build workbox-window
```

Optional (only if regenerating PWA splash/icon assets): `@vite-pwa/assets-generator`.

**Do NOT install** (confirmed unused by Wallecx): `@imagekit/vue`, `leaflet`, `leaflet-control-geocoder`, `axios`, `lodash-es`, `quill`, `dompurify`, `@vueuse/motion`, `@vercel/speed-insights`.

> Note: kaheeta has `vue-router@^5`. Source code uses the stable v4/v5 API (`createRouter`, `createWebHistory`, `useRoute`, `useRouter`, `RouterView`, `beforeEach`, `push`/`replace`) — compatible. If anything breaks at runtime, that's the first suspect.

---

## 3. Files to copy

Source paths are relative to `lex-lib.github.io/`; destinations relative to `kaheeta/`. The `projects/` path segment is dropped (kaheeta is standalone).

### Components → `src/components/wallecx/`

```
FROM: src/components/projects/wallecx/   →   TO: src/components/wallecx/
```

Copy all 24 reachable files (relative `./Sibling.vue` imports survive the move unchanged):

```
WallecxApp.vue  WallecxToolbar.vue  WallecxSkeleton.vue
VaccinationsTab.vue  VaccinationGroupCard.vue  VaccinationGroupPanel.vue  VaccinationDetail.vue
MembershipsTab.vue  MembershipCard.vue  MembershipDetail.vue
ExpensesTab.vue  ExpensesListView.vue  ExpensesToolbar.vue  ExpenseItem.vue  ExpensesReportsView.vue
ManageVaccination.vue  ManageMembership.vue  ManageExpense.vue  ManageBudget.vue
BaseMobileDialog.vue  DragHandle.vue
AttachmentPreview.vue  BarcodeDisplay.vue  PwaInstallBanner.vue
```

Skip `VaccinationList.vue` (dead code — referenced only in a comment).

After copying, grep the copied tree for `@/components/projects/wallecx` and rewrite to `@/components/wallecx`.

### Login → `src/components/Login.vue`

```
FROM: src/components/Login.vue   →   TO: src/components/Login.vue
```
Self-contained (PrimeVue Forms + zod + vue-router + auth store). No env/dev-credential coupling. **Do not** copy `CustomNavBar.vue` (Home/Projects/Blog links irrelevant) — build `KaheetaNavBar.vue` instead (§6).

### Lib

```
FROM: src/lib/pocketbase/index.ts              →  src/lib/pocketbase/index.ts
FROM: src/lib/pocketbase/perfInstrument.ts     →  src/lib/pocketbase/perfInstrument.ts
FROM: src/lib/pocketbase/vaccinationMapper.ts  →  src/lib/pocketbase/vaccinationMapper.ts
FROM: src/lib/pocketbase/membershipMapper.ts   →  src/lib/pocketbase/membershipMapper.ts
FROM: src/lib/pocketbase/expenseMapper.ts      →  src/lib/pocketbase/expenseMapper.ts
FROM: src/lib/pocketbase/expenseBudgetMapper.ts→  src/lib/pocketbase/expenseBudgetMapper.ts
FROM: src/lib/wallecx/compressToWebP.ts        →  src/lib/wallecx/compressToWebP.ts
FROM: src/lib/wallecx/currency.ts              →  src/lib/wallecx/currency.ts
FROM: src/lib/wallecx/expenseSchema.ts         →  src/lib/wallecx/expenseSchema.ts
FROM: src/lib/wallecx/period.ts                →  src/lib/wallecx/period.ts
```
Skip the DSU mappers (`dsuMeetingMapper`, `dsuSupportMapper`, `dsuTaskMapper`) — not Wallecx.
Optional tests: `src/lib/pocketbase/__tests__/{vaccinationMapper,membershipMapper,expenseMapper}.spec.ts` and `src/lib/wallecx/period.test.ts`.

### Types → `src/types/wallecx/`

```
vaccinations/types.d.ts  memberships/types.d.ts  expenses/types.d.ts
expense-categories/types.d.ts  expense-budgets/types.d.ts
```

### Composables → `src/composables/`

```
useIsMobile.ts  useMobileEnv.ts  useChartTheme.ts  useTheme.ts
```

### Store → `src/stores/auth.ts`

Copy `auth.ts`. Then delete the scaffold's `src/stores/counter.ts`.

### Assets → `src/assets/`

```
base.css  main.css  wallecx-overrides.css
```
(`main.css` imports the Rubik Google Font + `base.css`; `base.css` is `@import "tailwindcss"` + theme tokens. `wallecx-overrides.css` is imported directly by `WallecxApp.vue`.)

### Public / PWA assets → `public/`

Minimum for the manifest + icons:
```
favicon.ico (already present — source one is fine to overwrite)
pwa-64x64.png  pwa-192x192.png  pwa-512x512.png  maskable-icon-512x512.png
apple-touch-icon-180x180.png
wallecx-icon.svg  branding_logo.svg
screenshots/   shortcuts/
```
Optional (only if keeping the full iOS splash matrix in `index.html`): all `apple-splash-*.png`. Otherwise drop those `<link>` tags from `index.html` (§5) to avoid 404s.

> Branding note: these icons are the Wallecx visuals. For a true Kaheeta rebrand you'll eventually want new artwork, but the existing icons are fine to ship the migration and swap later.

---

## 4. Files to adapt after copying

### a) `src/composables/useTheme.ts`
```ts
const STORAGE_KEY = 'lexarium:theme'   →   const STORAGE_KEY = 'kaheeta:theme'
```

### b) `src/components/wallecx/WallecxApp.vue`
- Line ~82 redirect: `query: { redirect: "/projects/wallecx" }` → `query: { redirect: "/" }`
- `<h1>Wallecx</h1>` → `<h1>Kaheeta</h1>`
- Toast: `"A new version of Wallecx is available."` → `"...of Kaheeta..."`
- iOS eviction tip string: "pin Wallecx to your home screen" → "pin Kaheeta..."
- Leave `.wallecx-root` / `.wallecx-main-tabs` CSS classes as-is.

### c) `src/components/wallecx/PwaInstallBanner.vue`
- `aria-label="Install Wallecx"` (×3), "install Wallecx" body strings → "Kaheeta"
- `BANNER_DISMISSED_KEY = 'wallecx_pwa_banner_dismissed'` → `'kaheeta_pwa_banner_dismissed'`

### d) localStorage preference keys (rename `wallecx*` → `kaheeta*`)
- `VaccinationsTab.vue`: `wallecx:view-mode` → `kaheeta:view-mode`
- `MembershipsTab.vue`: `wallecx:memberships-sort-mode` → `kaheeta:memberships-sort-mode`
- `ExpensesListView.vue`: `wallecx:expense-sort` → `kaheeta:expense-sort`
- `ExpensesReportsView.vue`: `wallecx:expense-period`, `…-from`, `…-to` → `kaheeta:*`
- `perfInstrument.ts`: `wallecx:perf-baseline`, `wallecx:perf-session:*` → `kaheeta:*`

### e) DO NOT change (collection names — shared backend)
Leave every `pb.collection("wallecx_…")` / `instrumentedGetFullList<…>('wallecx_…')` exactly as-is:
`wallecx_vaccinations`, `wallecx_memberships`, `wallecx_expenses`, `wallecx_expense_categories`, `wallecx_expense_budgets`.

### f) Export filenames (cosmetic, optional)
`ExpensesTab.vue` builds `wallecx-expenses-<date>.json`. Rename to `kaheeta-expenses-…` if desired.

---

## 5. Config files

### `vite.config.ts` (rewrite — standard Vite, not rolldown)

```ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import Components from 'unplugin-vue-components/vite'
import { PrimeVueResolver } from '@primevue/auto-import-resolver'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue({
      template: { compilerOptions: { isCustomElement: (tag) => tag === 'iconify-icon' } },
    }),
    ...(process.env.NODE_ENV !== 'production' ? [vueDevTools()] : []),
    Components({ resolvers: [PrimeVueResolver()] }),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      strategies: 'generateSW',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'branding_logo.svg'],
      manifest: {
        name: 'Kaheeta',
        short_name: 'Kaheeta',
        description: 'Your personal vaccination, membership, and expense vault',
        theme_color: '#002244',
        background_color: '#002244',
        display: 'standalone',
        scope: '/',
        start_url: '/',                 // was /projects/wallecx
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [
          { src: 'screenshots/screenshot-mobile.png', sizes: '390x844', type: 'image/png', label: 'Kaheeta' },
          { src: 'screenshots/screenshot-desktop.png', sizes: '1280x800', type: 'image/png', form_factor: 'wide', label: 'Kaheeta (Desktop)' },
        ],
        shortcuts: [
          { name: 'Add Expense', short_name: 'Add Expense', url: '/?action=add-expense', icons: [{ src: 'shortcuts/shortcut-add-expense.png', sizes: '96x96', type: 'image/png' }] },
          { name: 'Add Vaccination', short_name: 'Add Vaccination', url: '/?action=add-vaccination', icons: [{ src: 'shortcuts/shortcut-add-vaccination.png', sizes: '96x96', type: 'image/png' }] },
          { name: 'Add Membership', short_name: 'Add Membership', url: '/?action=add-membership', icons: [{ src: 'shortcuts/shortcut-add-membership.png', sizes: '96x96', type: 'image/png' }] },
          { name: 'Open Reports', short_name: 'Open Reports', url: '/?action=open-reports', icons: [{ src: 'shortcuts/shortcut-open-reports.png', sizes: '96x96', type: 'image/png' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [{ urlPattern: /\/api\/.*/i, handler: 'NetworkOnly' }],
      },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/chart.js')) return 'chart-js'
          if (id.includes('/jsbarcode')) return 'jsbarcode'
          if (id.includes('/browser-image-compression')) return 'image-compression'
          if (/\/primevue|\/@primevue|\/@primeuix/.test(id)) return 'primevue'
          if (/\/vue\b|\/pinia|\/vue-router|\/@vue/.test(id)) return 'vendor'
        },
      },
    },
  },
})
```

### `env.d.ts`
```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vue" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

### `tsconfig.app.json`
Already correct (extends `@vue/tsconfig/tsconfig.dom.json`, has `@/*` path, excludes `__tests__`). No change needed.

### `index.html` (rewrite)
- `<title>` → `Kaheeta`
- Inline flash-prevention script: `localStorage.getItem('lexarium:theme')` → `'kaheeta:theme'`
- `<meta name="apple-mobile-web-app-title" content="Wallecx">` → `Kaheeta`
- `<link rel="icon">` → `/branding_logo.svg` (or favicon)
- Keep the `viewport-fit=cover` viewport + theme-color metas (needed for safe-area insets)
- **Drop all `apple-touch-startup-image` `<link>` tags** unless you copied the full `apple-splash-*.png` set (otherwise they 404).

### `package.json` scripts
kaheeta's existing scripts are fine. Optional: add `"generate-pwa-assets": "pwa-assets-generator"` if you install the assets generator.

---

## 6. Entry points

### `src/main.ts`
Port the source `main.ts` verbatim **except remove the MotionPlugin** (`@vueuse/motion` is not used by Wallecx):
- Keep: `PrimeVue` config, the `definePreset(Aura, …)` navy/amber `MyPreset`, `darkModeSelector: '.my-app-dark'`, `ConfirmationService`, `import 'iconify-icon'`, `import './assets/main.css'`, `import 'primeicons/primeicons.css'`, `import 'vue-sonner/style.css'`.
- Remove: `import { MotionPlugin } from '@vueuse/motion'` and `app.use(MotionPlugin)`.
- (Source `main.ts` has no `SpeedInsights` — nothing to remove there.)

### `src/App.vue`
```vue
<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import KaheetaNavBar from '@/components/wallecx/KaheetaNavBar.vue'
</script>

<template>
  <KaheetaNavBar />
  <RouterView />
  <Toaster rich-colors position="top-right" />
</template>
```

### `src/components/wallecx/KaheetaNavBar.vue` (new, minimal)
Build fresh (do NOT port `CustomNavBar.vue`). Needs only:
- Kaheeta logo/wordmark (`branding_logo.svg`)
- Theme toggle → `useTheme().toggle()`
- Logout → `useAuthStore().logout()` then `router.push({ name: 'login' })`
- Hidden on the `/login` route.

---

## 7. Router (`src/router/index.ts`)

```ts
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'wallecx', component: () => import('@/components/wallecx/WallecxApp.vue'), meta: { requiresAuth: true } },
    { path: '/login', name: 'login', component: () => import('@/components/Login.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta?.requiresAuth && !auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
})

export default router
```
Keep `name: 'wallecx'` (or rename to `'home'` and update the guard/redirect refs in `WallecxApp.vue`). Then delete `src/__tests__/App.spec.ts` (tests the scaffold placeholder).

---

## 8. Environment variables

All `.env*` are gitignored — create manually:

**`.env`, `.env.development`, `.env.production`:**
```
VITE_API_BASE_URL=https://lexarium-backend.fly.dev
```

---

## 9. PocketBase CORS

Same backend, new origin. Add kaheeta's dev (`http://localhost:5173`) and any production origin to the PocketBase allowed origins, or auth/data requests will be blocked by CORS. Collections already exist (`wallecx_*`) — no schema changes needed.

---

## 10. Verification

```
npm run dev          # login → all 3 tabs (Vaccinations / Memberships / Expenses) render with data
npm run type-check   # vue-tsc --build — fix any residual @/ path errors
npm run build        # confirm PWA manifest (name: Kaheeta) + chunks generate
```

Spot-check after build:
- Service worker registers; "new version" prompt wording says "Kaheeta".
- `localStorage` shows `kaheeta:theme` and `kaheeta:*` pref keys (no new `wallecx:` keys created).
- Network tab: data calls hit `wallecx_*` collections on `lexarium-backend.fly.dev` and succeed.
- Expense reports tab renders charts (chart.js loaded).
- PDF attachment preview + barcode/QR render.
