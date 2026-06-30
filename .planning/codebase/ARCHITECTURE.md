# Architecture

**Analysis Date:** 2026-06-30

## Application Type

Single-Page Application (SPA) with PWA support. Vue 3 + Vite + PocketBase backend. Two logical sub-apps share one Vue Router instance: a public marketing landing page (`/`) and the authenticated Kaheeta wallet app (`/wallet`).

## Top-Level Design

```text
┌───────────────────────────────────────────────────────────┐
│                    App.vue (shell)                         │
│   KaheetaNavBar (always rendered, all routes)             │
│   <RouterView> → one of three page components             │
└────────────┬──────────────────────────────────────────────┘
             │
    ┌────────┼────────────────────┐
    ▼        ▼                   ▼
LandingPage  Login.vue       WallecxApp.vue  (requiresAuth)
/            /login           /wallet
             │                    │
             │            ┌───────┴──────────────────────────┐
             │            │  PrimeVue <Tabs> (5 tabs)         │
             │            │  each tab: <Suspense> + async     │
             │            │  component via defineAsyncComponent│
             │            └──────────────────────────────────┘
             │                    │
             │         VaccinationsTab  MembershipsTab
             │         ExpensesTab      ChecklistsTab
             │         GroupsTab
             ▼
      ┌──────────────┐
      │  Pinia stores │  (auth.ts — wraps pb.authStore)
      └──────┬───────┘
             ▼
      ┌──────────────────────────────────┐
      │  src/lib/pocketbase/             │
      │  pb singleton + instrumentedGet  │
      │  splitsApi.ts (hook routes)      │
      │  *Mapper.ts (write filters)      │
      └──────────────────────────────────┘
             ▼
      PocketBase backend (https://api.delveen.cc)
```

## Data Flow

**Read path:**
1. Tab component mounts inside `<Suspense>` — uses `await` in `setup()` (top-level await pattern).
2. Data fetched via `instrumentedGetFullList<T>(collection, options)` in `src/lib/pocketbase/perfInstrument.ts`. This wraps `pb.collection().getFullList()` with performance timing and localStorage metrics ring-buffer.
3. Direct collection reads go through `pb.collection(name).getFullList()` with `requestKey` options to prevent PocketBase auto-cancel collisions.
4. Results typed via interfaces in `src/types/wallecx/<feature>/types.d.ts`, all extending PocketBase's `RecordModel`.

**Write path (standard collections):**
1. Component calls create/update through `pb.collection(name).create/update(mapToUpdate*(record))`.
2. Mapper functions in `src/lib/pocketbase/*Mapper.ts` strip read-only fields (`id`, `created`, `updated`, `collectionId`, `collectionName`, `expand`) before submission.
3. File fields (receipts, card images) submitted as `FormData` separately.

**Write path (splits/groups — kaheeta_* collections):**
1. Components call functions from `src/lib/pocketbase/splitsApi.ts`.
2. `splitsApi.ts` uses `pb.send()` to call custom PocketBase hook routes under `/api/kaheeta/*` (server-side goja JS hooks in `pocketbase/pb_hooks/`).
3. The kaheeta_* collections have admin-only write rules — all mutations must go through the hook routes, not direct collection writes.
4. Reads from kaheeta_* collections still use direct `pb.collection()` reads (party-scoped List/View rules).

**Auth flow:**
1. `pb` singleton in `src/lib/pocketbase/index.ts` auto-persists auth token to localStorage via PocketBase SDK.
2. `useAuthStore` (Pinia) wraps `pb.authStore` — the store's `user` ref updates reactively via `pb.authStore.onChange()`.
3. `pb.afterSend` hook clears the auth store on any 401 response, making logout reactive everywhere.
4. Router `beforeEach` guard clears stale JWT state and redirects unauthenticated access to `/login`.

## Key Patterns

- **Feature-tab architecture:** Each domain (vaccinations, memberships, expenses, checklists, groups) is a self-contained tab component loaded asynchronously via `defineAsyncComponent`. Each tab manages its own data loading.
- **`<Suspense>` for async tabs:** Tab components use top-level `await` in `<script setup>` for initial data; `<Suspense>` shows `WallecxSkeleton` while resolving.
- **Mapper pattern for writes:** Before any `create` or `update` call, typed records pass through a mapper function that returns only the writable fields. This prevents accidentally sending read-only PocketBase fields.
- **`instrumentedGetFullList` wrapper:** All list reads go through this wrapper rather than calling `pb.collection().getFullList()` directly — adds performance timing and localStorage ring-buffer without changing the return type.
- **Superuser hook routes for kaheeta_* writes:** Collections with admin-only write rules are mutated exclusively through PocketBase JS hook routes, called via `pb.send()`.
- **Computed-on-read balances:** Group expense balances are never stored — `computeBalances()` in `src/lib/wallecx/balances.ts` derives them from non-deleted expenses and shares every time the UI renders.
- **Integer minor units for split amounts:** All split expense amounts are stored as integer cents (`number` in JS) to avoid float drift. Personal expenses use decimals.
- **Module-level singleton composables:** `useTheme` and `useMobileEnv` hold module-scope reactive state (not Pinia) to share across all consumers without a store.

## Routing

**Strategy:** Vue Router with `createWebHistory` (HTML5 history API, no hash).

**Routes:**

| Path | Name | Component | Guard |
|------|------|-----------|-------|
| `/` | `landing` | `components/landing/LandingPage.vue` | none |
| `/wallet` | `wallet` | `components/wallecx/WallecxApp.vue` | `requiresAuth: true` |
| `/login` | `login` | `components/Login.vue` | none |
| `/:pathMatch(.*)*` | — | redirect to `/` | none |

**Auth guard in `src/router/index.ts` `beforeEach`:**
1. If `pb.authStore` token is invalid but record exists (passive expiry), clears the store.
2. If route has `meta.requiresAuth` and `useAuthStore().isLoggedIn` is false, redirects to `/login?redirect=<original path>`.

**PWA shortcut deep links:** The `?action=` query param on `/wallet` maps to tab activation (handled in `WallecxApp.vue` `onMounted`). After consumption the param is stripped via `router.replace({ query: {} })`.

## State & Reactivity

**Global state (Pinia store):**
- `src/stores/auth.ts` — `useAuthStore`: `user` ref, `isLoggedIn` computed, `login()`, `logout()`. Reactive because it subscribes to `pb.authStore.onChange()`.

**Module-level singleton state (not Pinia):**
- `src/composables/useTheme.ts` — `theme` ref, `toggle()`, `setTheme()`. Persisted to `localStorage` under `kaheeta:theme`. An inline script in `index.html` applies the class before hydration to prevent flash.
- `src/composables/useMobileEnv.ts` — `installPromptEvent` ref (module-scope singleton). `isMobile`, `isTablet`, `isStandalone` refs seeded synchronously from `window.matchMedia`.

**Local component state:**
- Each tab component holds its own data arrays as `ref` or reactive state — there is no global data store for vaccinations, expenses, etc.
- `WallecxApp.vue` holds `activeTab` ref and `pendingAction` ref for cross-tab PWA shortcut coordination.

**PocketBase auth persistence:**
- PocketBase SDK auto-persists the auth token to `localStorage`. The store layer (`auth.ts`) reads from `pb.authStore` reactively, not from localStorage directly.

## Backend Communication

**Client:** PocketBase JS SDK (`pocketbase` npm package). Singleton exported from `src/lib/pocketbase/index.ts`.

**Base URL:** `VITE_API_BASE_URL` env var (defaults to `https://api.delveen.cc`).

**Request types:**

| Operation | Method | Usage |
|-----------|--------|-------|
| List reads | `pb.collection(name).getFullList<T>(options)` via `instrumentedGetFullList` | All standard collections |
| Single reads | `pb.collection(name).getOne<T>(id)` | Detail views |
| Creates | `pb.collection(name).create(mapToUpdate*(record))` | Standard collections |
| Updates | `pb.collection(name).update(id, mapToUpdate*(record))` | Standard collections |
| Deletes | `pb.collection(name).delete(id)` | Standard collections |
| Hook routes | `pb.send('/api/kaheeta/*', { method, body })` | kaheeta_* write operations |

**Auth:** PocketBase SDK attaches the stored JWT as a `Authorization: Bearer <token>` header automatically. No manual header injection needed.

**Error handling:**
- 401 responses trigger `pb.afterSend` hook (in `src/lib/pocketbase/index.ts`) which calls `pb.authStore.clear()`, making the navbar and route guard react reactively.
- Component-level errors are caught with try/catch and surfaced via `useToast` (vue-sonner toasts).
- `requestKey` options on `getFullList` calls prevent PocketBase auto-cancellation when the same collection is queried concurrently.

**Collections:**

| Collection | Prefix | Write route |
|------------|--------|-------------|
| `wallecx_vaccinations` | wallecx_ | Direct pb.collection() |
| `wallecx_memberships` | wallecx_ | Direct pb.collection() |
| `wallecx_expenses` | wallecx_ | Direct pb.collection() |
| `wallecx_expense_categories` | wallecx_ | Direct pb.collection() |
| `wallecx_expense_budgets` | wallecx_ | Direct pb.collection() |
| `kaheeta_groups` | kaheeta_ | `/api/kaheeta/groups` hook |
| `kaheeta_group_members` | kaheeta_ | `/api/kaheeta/groups/*/members` hook |
| `kaheeta_split_expenses` | kaheeta_ | `/api/kaheeta/split-expenses` hook |
| `kaheeta_split_shares` | kaheeta_ | (created atomically with split-expenses) |

**CORS:** Backend is wildcard — no origin allowlisting required.

---

*Architecture analysis: 2026-06-30*
