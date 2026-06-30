# Codebase Concerns

**Analysis Date:** 2026-06-30

---

## Known Issues

**Login failure shows no user-facing error:**
- Issue: `Login.vue` catches the auth error but only calls `console.error("Login failed:", error)` — the user never sees feedback for a wrong email/password or a network problem.
- File: `src/components/Login.vue:35-38`
- Impact: Users on failed login attempts receive no toast, no inline message. They see nothing happen and must guess why.
- Fix: Call `toast.error(...)` in the catch block with a human-readable message extracted from `ClientResponseError`.

**Commented-out signup code left in auth store:**
- Issue: `src/stores/auth.ts:24-33` contains a commented-out `signup` function and its call in the return statement comment (`//, signup, logout`).
- File: `src/stores/auth.ts`
- Impact: Self-registration is unavailable. Users can only be onboarded by an admin or invite. The dead code implies this was once planned but not finished.
- Fix: Either implement signup properly or delete the commented block. As-is there is no self-registration path.

**`useChecklists` module-scope singletons are never reset:**
- Issue: `src/lib/wallecx/useChecklists.ts` uses module-scope `ref`s (`checklists`, `tasks`, `isLoading`) with a `loaded` boolean flag. If the user logs out and a different user logs in during the same browser session, the stale first-user data is still live.
- File: `src/lib/wallecx/useChecklists.ts:28-31`
- Impact: Data leakage between sessions if the browser tab is reused without a hard reload after logout.
- Fix: Add a `reset()` function that clears the refs and resets `loaded = false`, and call it from `useAuthStore`'s `logout`.

---

## Technical Debt

**Massive single-file components (god components):**
- Several Vue SFCs exceed 500 lines, mixing data-fetching, form state, validation, and template in one file:
  - `src/components/wallecx/ChecklistsTab.vue` — 602 lines
  - `src/components/wallecx/ExpensesReportsView.vue` — 583 lines
  - `src/components/wallecx/ManageExpense.vue` — 561 lines
  - `src/components/wallecx/GroupDetail.vue` — 545 lines
  - `src/components/wallecx/ManageMembership.vue` — 531 lines
  - `src/components/wallecx/ManageVaccination.vue` — 495 lines
  - `src/components/wallecx/VaccinationsTab.vue` — 492 lines
- Impact: Hard to test, high cognitive load when making targeted changes, merge conflict risk.
- Fix approach: Extract data-fetching into composables (mirrors the `useChecklists.ts` pattern already adopted for checklists). Extract sub-sections into smaller child components.

**Duplicated file-upload/EXIF-strip logic across three dialogs:**
- Issue: `ManageExpense.vue`, `ManageMembership.vue`, and `ManageVaccination.vue` each implement the same EXIF-strip canvas pattern inline in `onFileSelect`. Only the compression step was extracted to `compressToWebP.ts`.
- Files: `src/components/wallecx/ManageExpense.vue:192-220`, `src/components/wallecx/ManageMembership.vue`, `src/components/wallecx/ManageVaccination.vue`
- Impact: A bug fix or allowedTypes change must be applied in three places.
- Fix: Extract a shared `useFileSelect(options)` composable that handles validation, EXIF strip, and `compressToWebP`, mirroring the `compressToWebP` extraction already done.

**Personal expenses use decimal amounts; split expenses use integer cents — two conventions coexist:**
- Issue: `wallecx_expenses.amount` is a floating-point decimal (PHP). `kaheeta_split_expenses.amount` is integer minor units (cents, any currency). Both fields are named `amount` on their respective types.
- Files: `src/types/wallecx/expenses/types.d.ts`, `src/types/wallecx/splits/types.d.ts`
- Impact: Subtle arithmetic bugs if the wrong formatter or converter is applied. The `currency.ts` formatter (PHP-locked, formats decimals) and `splitFormat.ts` `formatCents` (divides by 100) must never be swapped.
- Fix: Not easily reversible — document the boundary clearly in both type files. Consider adding a branded type or a helper that makes the unit explicit.

**`ExpensesTab` category seeding runs on every fresh dialog open:**
- Issue: `ManageExpense.vue:132-165` fetches `wallecx_expense_categories` on every dialog open and seeds 7 default categories with `Promise.all` creates if the list is empty. A user who has deleted all categories triggers re-seeding silently.
- File: `src/components/wallecx/ManageExpense.vue:132`
- Impact: Multiple network calls per dialog open; potential for duplicate rows if the user opens two dialogs simultaneously before categories load.
- Fix: Cache the seeded state in a module-scope flag (like `useChecklists` uses `loaded`), or move seeding to a one-time call on app startup / PocketBase signup hook.

**`currency.ts` hardcodes PHP as the personal expenses currency:**
- Issue: `src/lib/wallecx/currency.ts:3-4` exports `WALLECX_CURRENCY = 'PHP'` and `WALLECX_CURRENCY_LOCALE = 'en-PH'` as a compile-time constant. The comment says multi-currency is "deferred to EXP-ADV-03".
- File: `src/lib/wallecx/currency.ts`
- Impact: The entire personal expenses feature is hardcoded to PHP with no user preference or per-expense currency. International users see wrong formatting.

---

## Security Concerns

**Login error leaks no information (acceptable) but also gives no feedback (UX bug):**
- Covered above under Known Issues. The security posture is fine (errors are not reflected to the page), but the missing user feedback is a functional gap.

**File upload MIME type check is client-side only:**
- Issue: `ManageExpense.vue:203-207`, `ManageMembership.vue`, and `ManageVaccination.vue` validate `file.type` (a browser-supplied MIME hint) and `file.size` on the client. There is no server-side MIME validation visible in the hooks.
- Impact: A crafted request bypassing the browser UI could upload arbitrary file types. PocketBase's collection-level file constraints (allowed MIME types and size) must be configured in the PocketBase admin — whether this is configured is not verifiable from the frontend code alone.
- Fix: Verify PocketBase collection definitions enforce MIME type and size constraints server-side. The comment on `ManageExpense.vue:193` references "T-35-04" as the enforcement point but this is a code comment, not a server rule.

**`redirect` query parameter in login is validated but only by prefix:**
- Issue: `Login.vue:23-29` accepts `?redirect=` values that start with `/` and don't start with `//`. This prevents open redirect to external origins but would allow redirect to any app path.
- File: `src/components/Login.vue:23-29`
- Impact: Legitimate, low-risk. Internal redirects are the intended behaviour. No cross-origin risk.

**`VITE_API_BASE_URL` defaults to a public shared backend:**
- Issue: `.env` files point to `https://api.delveen.cc` — a shared backend. All Kaheeta users share this instance. If a user clones this repo and runs it locally without setting `VITE_API_BASE_URL`, they are pointing at the production backend.
- Files: `.env.development`, `.env.production` (contents not read, but noted from CLAUDE.md)
- Impact: Development testing can accidentally write to the live database. Consider a local PocketBase for dev with a clear warning if `VITE_API_BASE_URL` points at production.

---

## Performance Concerns

**All personal data collections fetched with `getFullList` (no pagination):**
- Issue: `instrumentedGetFullList` calls `pb.collection(collection).getFullList<T>()` — fetching every record for the logged-in user in one go. This is used for vaccinations, memberships, expenses, budgets, split expenses, and split shares.
- Files: `src/lib/pocketbase/perfInstrument.ts:24`, all tab components
- Impact: At low record counts (current use case) this is fine. As a user accumulates years of expense records, the initial load time and payload size will grow without bound. Expenses in particular are unbounded — the export path also issues a second `getFullList` call on top of the load-time one.
- Fix: Introduce pagination or a "load more" pattern for expenses as a future phase. Budgets, vaccinations, and memberships are naturally small sets and are fine.

**`GroupDetail` reloads the entire ledger after every mutation:**
- Issue: `onExpenseSaved`, `onSettleSaved`, and `doDeleteExpense` each call `loadLedger()` which re-fetches both `kaheeta_split_expenses` and `kaheeta_split_shares` in parallel.
- File: `src/components/wallecx/GroupDetail.vue:234-246`
- Impact: Each write round-trips two queries. With many expenses or shares this is wasteful. Optimistic local updates (like the `toggleTask` pattern in `useChecklists`) would be faster.

**`ExpensesReportsView` loads `wallecx_expense_categories` separately from `ExpensesTab`:**
- Issue: `ExpensesReportsView.vue:253-260` fetches categories independently of `ManageExpense.vue`'s load path, using the same `requestKey` (`expense-categories-getFullList`). While the shared key allows PocketBase SDK deduplication, it only fires once per page-load — opening the Reports sub-tab triggers a fresh fetch.
- File: `src/components/wallecx/ExpensesReportsView.vue:253`
- Impact: Minor redundant network call on tab switch.

**Icons bundle: `mdi-icons.json` preloaded at startup:**
- Issue: `src/main.ts:7-14` calls `addCollection(mdiIcons)` unconditionally at startup to avoid Iconify CDN fetches. The JSON file is loaded synchronously in the main chunk.
- Impact: Any new MDI icon must be added to `mdi-icons.json` manually, and that file must stay in sync. Icons not in it fall back to a runtime CDN fetch, causing a visible blank-then-render flash on first use.

---

## Scalability Concerns

**Balance computation is O(n × m) on the client:**
- Issue: `computeBalances` and `simplifyDebts` in `src/lib/wallecx/balances.ts` and `src/lib/wallecx/simplifyDebts.ts` iterate all expenses and shares on every computed property evaluation. These are called reactively whenever `expenses` or `shares` refs change.
- Impact: With a large group and many expenses (hundreds), every ledger reload re-runs the full computation. For current use this is negligible. A group with thousands of expenses would cause noticeable UI jank.
- Fix: Memoize or move balance computation server-side as a future phase.

**Group membership has no size limit (client or server):**
- Issue: `POST /api/kaheeta/groups/{id}/members` in `pocketbase/pb_hooks/kaheeta_splits.pb.js:464-514` adds members without checking group size. The member-validation loop in `createSplitExpense` iterates all provided shares with a per-share membership lookup (N+1 queries).
- File: `pocketbase/pb_hooks/kaheeta_splits.pb.js:140-152`
- Impact: A group with 50+ members and an expense with 50 shares would issue 50 individual `findRecordsByFilter` calls in the hook. No server-side membership cap.
- Fix: Batch the membership check or add a group-size cap.

**Expense search/filter is in-memory, client-side:**
- Issue: `ExpensesTab` and `VaccinationsTab` filtering (search query, date range, category) runs over the full in-memory array with `computed`. No server-side filtering for initial fetch.
- Files: `src/components/wallecx/ExpensesListView.vue`, `src/components/wallecx/VaccinationsTab.vue`
- Impact: Acceptable at small scale. Degrades as record count grows since the whole collection is already in memory.

---

## Dependency Risks

**`pdfjs-dist` v6 is a large bundle dependency:**
- Package: `pdfjs-dist: ^6.0.227`
- Risk: PDF.js is a heavy dependency (several MB). It is used for PDF receipt preview in `AttachmentPreview.vue`. Version 6 is relatively recent but the library has a history of breaking changes between major versions.
- Impact: Bundle chunk size. The `vite.config.ts` does not include a manual chunk for `pdfjs-dist`, so it lands in the main bundle or a large auto-chunk.

**`vue-router` v5 is in pre-release / major version territory:**
- Package: `vue-router: ^5.0.4`
- Risk: Vue Router v5 is a major version above the stable v4.x. It may carry breaking API changes. The project uses standard router patterns but should track the v5 changelog carefully.

**`typescript ~6.0.0` is a very recent major version:**
- Package: `typescript: ~6.0.0`
- Risk: TypeScript 6 is new. Tooling compatibility (vue-tsc, eslint plugins, IDE integrations) may lag. The `~` pin means only patch updates — good practice.

**`oxlint ~1.60.0` tied to `eslint-plugin-oxlint` version:**
- Packages: `oxlint ~1.60.0`, `eslint-plugin-oxlint ~1.60.0`
- Risk: The tilde pins are pinned to the same minor version. If they drift (one is updated, the other isn't), linting will break silently or noisily. Managed by the `run-s lint:*` script which runs both.

---

## Missing Features / Gaps

**No self-registration / signup flow:**
- Problem: `useAuthStore.signup` is commented out (`src/stores/auth.ts:24-33`). Users cannot create an account from the app — they must be provisioned by an admin. There is no "Forgot password" link on the login page.
- Blocks: Organic user growth; onboarding members to groups requires the invitee to already have an account.

**No multi-currency support for personal expenses:**
- Problem: `src/lib/wallecx/currency.ts` hardcodes PHP. The comment defers multi-currency to `EXP-ADV-03` with no planned timeline.
- Blocks: Users outside the Philippines cannot use the personal expenses feature in their local currency. Split expenses handle multiple currencies correctly, making the inconsistency more visible.

**Group archiving is implemented server-side but there is no UI to archive or un-archive:**
- Problem: `pocketbase/pb_hooks/kaheeta_splits.pb.js:553-588` handles `PATCH` with `archived: true/false` and `splitsApi.ts` exports `archiveGroup()`, but no UI surface in `GroupsTab.vue` or `GroupDetail.vue` calls it.
- Files: `src/lib/pocketbase/splitsApi.ts:67-72`, `src/components/wallecx/GroupsTab.vue`
- Impact: Archived groups still appear in the `kaheeta_groups` list unless the PocketBase query filters `archived_at = ""`. Check whether `loadGroups` in `GroupsTab` applies this filter.

**Friend-to-friend (no-group) split expenses are modelled but not exposed in UI:**
- Problem: `src/types/wallecx/splits/types.d.ts:55` shows `group` can be empty for friend-to-friend splits, and the docs reference this. No UI path exists to create such an expense.
- Blocks: The non-group split use case documented in the plan.

**No offline write support:**
- Problem: The PWA service worker caches assets but `runtimeCaching: [{ urlPattern: /\/api\/.*/i, handler: 'NetworkOnly' }]` forces all API calls online.
- Files: `vite.config.ts` workbox config
- Impact: The app is a read-only shell when offline — any create/update/delete attempt fails silently or with a toast error. Acceptable for v1 but worth noting as a gap for a wallet app used in low-connectivity environments.

---

## Observability

**No error tracking service (Sentry, etc.):**
- What's in place: `console.error(...)` in every catch block, surfacing errors in browser DevTools only.
- What's missing: No remote error capture. Production exceptions are invisible unless a user reports them or opens DevTools. Errors in PocketBase hooks (`kaheeta_splits.pb.js`) are also not forwarded anywhere.
- Risk: Silent failures in production (failed saves, failed loads) that users do not report go completely undetected.

**Performance metrics stored in `localStorage` only:**
- What's in place: `perfInstrument.ts` records payload size and duration for each collection fetch into `kaheeta:perf-baseline` in localStorage, and `console.info` logs on first load per session.
- What's missing: These metrics are per-device, per-browser, and ephemeral. There is no aggregation, no alerting, and no way to see trends across users.
- Risk: A regression that slows all users' fetches would be invisible until a user reports it.

**No health check or uptime monitoring for the shared backend (`api.delveen.cc`):**
- What's in place: Nothing visible from the frontend.
- What's missing: If the PocketBase instance goes down, the app fails silently (collection fetch errors surface as toasts). There is no status page or proactive alert.

**`console.warn` in `VaccinationsTab` for token refresh failure:**
- Location: `src/components/wallecx/VaccinationsTab.vue:170`
- What happens: A failed `listToken` refresh is logged as `warn` not `error`, and `console.warn` label incorrectly says "WallecxApp". Non-fatal, but the mislabelled prefix makes log searching harder.

---

*Concerns audit: 2026-06-30*
