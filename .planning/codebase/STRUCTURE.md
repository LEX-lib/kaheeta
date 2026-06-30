# Directory Structure

**Analysis Date:** 2026-06-30

## Top-Level Layout

```
kaheeta/
├── src/                    # Application source code
├── public/                 # Static assets served as-is (PWA icons, screenshots, shortcuts)
├── pocketbase/             # Backend PocketBase config and hooks
│   └── pb_hooks/           # Server-side goja JS hook routes (kaheeta_splits.pb.js etc.)
├── e2e/                    # Playwright end-to-end tests
│   └── helpers/            # E2E test helper utilities
├── devdoc/                 # Developer documentation (not shipped)
├── docs/                   # Feature design docs and planning
│   └── features/           # Per-feature docs (shared-splits-plan.md etc.)
├── dist/                   # Production build output (gitignored)
├── .planning/              # GSD planning documents
│   └── codebase/           # Codebase analysis docs (this folder)
├── index.html              # SPA shell — includes inline theme-init script
├── vite.config.ts          # Vite + plugins config (PWA, PrimeVue auto-import, Tailwind)
├── tsconfig.json           # TypeScript config (noUncheckedIndexedAccess enabled)
├── tailwind.config.*       # Tailwind CSS config (if present)
├── package.json            # Dependencies and npm scripts
└── CLAUDE.md               # AI coding guidance for this repo
```

## Source Structure (src/)

```
src/
├── App.vue                 # Root shell: KaheetaNavBar + <RouterView> + Toaster
├── main.ts                 # App bootstrap: Pinia, Router, PrimeVue (custom Aura preset), iconify preload
│
├── router/
│   └── index.ts            # Vue Router: 3 named routes + beforeEach auth guard
│
├── stores/
│   └── auth.ts             # Pinia auth store: wraps pb.authStore with reactive user + isLoggedIn
│
├── composables/
│   ├── useTheme.ts         # Module-singleton: theme ref, toggle(), setTheme(), OS pref listener
│   ├── useMobileEnv.ts     # Module-singleton: isMobile, isTablet, isStandalone, installPromptEvent
│   ├── useIsMobile.ts      # Single-source 639px breakpoint ref (used internally by useMobileEnv)
│   ├── useProfileMenu.ts   # Navbar profile menu items + displayName + userInitials
│   ├── useChartTheme.ts    # Chart.js colour tokens per theme
│   └── useToast.ts         # Wrapper around vue-sonner toast API
│
├── components/
│   ├── Login.vue           # Login page (/login route)
│   ├── landing/
│   │   └── LandingPage.vue # Public delveen marketing page (/ route, dark navy theme)
│   └── wallecx/            # Authenticated Kaheeta app components
│       ├── WallecxApp.vue          # /wallet route root: Tabs shell, PWA update, auth check
│       ├── WallecxSkeleton.vue     # Loading skeleton (Suspense fallback for each tab)
│       ├── WallecxToolbar.vue      # Shared toolbar component
│       ├── KaheetaNavBar.vue       # App-wide navbar (rendered in App.vue, all routes)
│       ├── BaseMobileDialog.vue    # Drawer (mobile) / Dialog (desktop) adaptive modal
│       ├── PwaInstallBanner.vue    # iOS/Android PWA install prompt UI
│       │
│       │  ── Vaccinations ──
│       ├── VaccinationsTab.vue     # Tab: list of vaccination groups
│       ├── VaccinationGroupCard.vue
│       ├── VaccinationGroupPanel.vue
│       ├── VaccinationDetail.vue   # Detail/edit view for one vaccination
│       ├── ManageVaccination.vue   # Create/edit dialog
│       │
│       │  ── Memberships ──
│       ├── MembershipsTab.vue      # Tab: membership cards list
│       ├── MembershipCard.vue
│       ├── MembershipDetail.vue
│       ├── ManageMembership.vue    # Create/edit dialog
│       ├── BarcodeDisplay.vue      # Barcode renderer for membership cards
│       │
│       │  ── Expenses ──
│       ├── ExpensesTab.vue         # Tab: list/reports switcher
│       ├── ExpensesListView.vue    # Expense list with filters
│       ├── ExpensesReportsView.vue # Charts and budget reports
│       ├── ExpensesToolbar.vue     # Filter/search toolbar for expenses
│       ├── ExpenseItem.vue         # Single expense row
│       ├── ManageExpense.vue       # Create/edit dialog
│       ├── ManageBudget.vue        # Budget management dialog
│       │
│       │  ── Checklists ──
│       ├── ChecklistsTab.vue       # Tab: checklists list
│       ├── ManageChecklist.vue     # Create/edit dialog
│       ├── DragHandle.vue          # Drag-to-reorder handle
│       │
│       │  ── Groups (Splits) ──
│       ├── GroupsTab.vue           # Tab: group expense splitting list
│       ├── GroupDetail.vue         # Group detail: expenses + balances
│       ├── ManageSplitExpense.vue  # Create/edit split expense dialog
│       ├── SettleUpDialog.vue      # Debt settlement dialog
│       └── ProgressRing.vue        # SVG ring for balance visualisation
│
├── lib/
│   ├── pocketbase/                 # All backend access
│   │   ├── index.ts                # pb singleton + afterSend 401 handler
│   │   ├── perfInstrument.ts       # instrumentedGetFullList wrapper (perf timing + ring-buffer)
│   │   ├── splitsApi.ts            # pb.send() wrappers for /api/kaheeta/* hook routes
│   │   ├── expenseMapper.ts        # mapToUpdateExpense() — strips read-only fields
│   │   ├── expenseBudgetMapper.ts  # mapToUpdateExpenseBudget()
│   │   ├── membershipMapper.ts     # mapToUpdateMembership()
│   │   ├── vaccinationMapper.ts    # mapToUpdateVaccination()
│   │   ├── checklistMapper.ts      # mapToUpdateChecklist()
│   │   ├── checklistTaskMapper.ts  # mapToUpdateChecklistTask()
│   │   └── __tests__/              # Unit tests for mappers
│   │       ├── expenseMapper.spec.ts
│   │       ├── membershipMapper.spec.ts
│   │       └── vaccinationMapper.spec.ts
│   │
│   ├── wallecx/                    # Domain utilities and pure logic
│   │   ├── balances.ts             # computeBalances() — computed-on-read balance engine
│   │   ├── balances.test.ts
│   │   ├── splitMath.ts            # equalSplit(), weightedSplit() — integer cent arithmetic
│   │   ├── splitMath.test.ts
│   │   ├── simplifyDebts.ts        # Debt simplification algorithm
│   │   ├── simplifyDebts.test.ts
│   │   ├── splitFormat.ts          # Display formatting for split amounts
│   │   ├── currency.ts             # Currency formatting helpers
│   │   ├── period.ts               # Date period helpers (month/year math)
│   │   ├── period.test.ts
│   │   ├── expenseSchema.ts        # Zod schema + DEFAULT_EXPENSE_CATEGORIES + PAYMENT_MODES
│   │   ├── compressToWebP.ts       # browser-image-compression wrapper for file uploads
│   │   └── useChecklists.ts        # Checklist-specific composable
│   │
│   └── mdi-icons.json              # Pre-bundled MDI icon set (avoids Iconify CDN cold-load)
│
├── types/
│   └── wallecx/                    # TypeScript type declarations per feature
│       ├── expenses/types.d.ts         # Expenses, AddExpense
│       ├── expense-categories/types.d.ts
│       ├── expense-budgets/types.d.ts
│       ├── vaccinations/types.d.ts
│       ├── memberships/types.d.ts
│       ├── checklists/types.d.ts
│       └── splits/types.d.ts           # Group, GroupMember, SplitExpense, SplitShare, BalanceSummary, etc.
│
└── assets/
    ├── main.css                    # Entry CSS (imports base.css, Tailwind)
    ├── base.css                    # CSS custom properties / base resets
    ├── wallecx-overrides.css       # PrimeVue overrides: safe-area insets, 44px touch targets, iOS zoom fix
    └── sonner-brand.css            # vue-sonner brand colour overrides (currently commented out)
```

## Key Files

| File | Purpose |
|------|---------|
| `src/main.ts` | App entry: mounts Vue, registers Pinia + Router + PrimeVue with custom navy/amber Aura preset |
| `src/App.vue` | Root shell: navbar, RouterView, Toaster, PWA install prompt capture |
| `src/router/index.ts` | Route definitions and auth guard |
| `src/stores/auth.ts` | Only Pinia store — reactive auth state wrapping pb.authStore |
| `src/lib/pocketbase/index.ts` | pb singleton with 401 auto-logout hook |
| `src/lib/pocketbase/perfInstrument.ts` | `instrumentedGetFullList` — required wrapper for all list reads |
| `src/lib/pocketbase/splitsApi.ts` | All write operations for kaheeta_* collections (hook routes) |
| `src/components/wallecx/WallecxApp.vue` | Authenticated app root: tabs, PWA update prompt, session check |
| `src/components/wallecx/BaseMobileDialog.vue` | Adaptive modal used throughout the app |
| `src/composables/useTheme.ts` | Dark mode state and persistence |
| `src/composables/useMobileEnv.ts` | Breakpoint detection and PWA install event capture |
| `src/lib/wallecx/expenseSchema.ts` | Zod validation schema + category/payment-mode constants |
| `vite.config.ts` | Vite config: Vue, PrimeVue auto-import, Tailwind, PWA plugin, chunk splitting |
| `index.html` | SPA shell with inline theme-init script (must stay in sync with `useTheme`'s storage key) |
| `pocketbase/pb_hooks/` | Server-side goja JS hooks for kaheeta_* write operations |

## Feature Organization

Features are organized by **domain tab** within `src/components/wallecx/`. Each domain owns:
- A `*Tab.vue` (top-level tab component, loaded async via `defineAsyncComponent`)
- Domain-specific list, detail, and manage (create/edit dialog) components
- A type definition file at `src/types/wallecx/<domain>/types.d.ts`
- A mapper at `src/lib/pocketbase/<domain>Mapper.ts` (for write-field stripping)
- Optional pure-logic helpers at `src/lib/wallecx/` (e.g., `balances.ts`, `splitMath.ts`)

**Domain summary:**

| Domain | Tab Component | Types | Mapper | Lib helpers |
|--------|--------------|-------|--------|-------------|
| Vaccinations | `VaccinationsTab.vue` | `vaccinations/types.d.ts` | `vaccinationMapper.ts` | — |
| Memberships | `MembershipsTab.vue` | `memberships/types.d.ts` | `membershipMapper.ts` | — |
| Expenses | `ExpensesTab.vue` | `expenses/types.d.ts` | `expenseMapper.ts` | `expenseSchema.ts`, `currency.ts`, `period.ts` |
| Checklists | `ChecklistsTab.vue` | `checklists/types.d.ts` | `checklistMapper.ts`, `checklistTaskMapper.ts` | `useChecklists.ts` |
| Groups (Splits) | `GroupsTab.vue` | `splits/types.d.ts` | `splitsApi.ts` (hook routes) | `balances.ts`, `splitMath.ts`, `simplifyDebts.ts`, `splitFormat.ts` |

## Where to Add New Code

**New feature tab:**
- Tab component: `src/components/wallecx/<Feature>Tab.vue`
- Supporting components: `src/components/wallecx/<Feature>*.vue`
- Types: `src/types/wallecx/<feature>/types.d.ts`
- Mapper: `src/lib/pocketbase/<feature>Mapper.ts`
- Register tab in `src/components/wallecx/WallecxApp.vue` (TabList + TabPanel + defineAsyncComponent)

**New standard PocketBase collection (wallecx_* prefix):**
- Add types to `src/types/wallecx/<feature>/types.d.ts`
- Create mapper at `src/lib/pocketbase/<feature>Mapper.ts`
- Use `instrumentedGetFullList()` for list reads

**New kaheeta_* collection (admin-only write rules):**
- Add write functions to `src/lib/pocketbase/splitsApi.ts` using `pb.send('/api/kaheeta/...')`
- Add corresponding goja hook route in `pocketbase/pb_hooks/`
- Direct collection reads via `pb.collection()` are still allowed

**New composable:**
- Shared stateless composables: `src/composables/use<Name>.ts`
- Module-level singleton state (non-Pinia): use module-scope `ref` inside the composable file, export a function that returns `readonly()` wrapped refs

**New pure domain utility:**
- `src/lib/wallecx/<name>.ts` with co-located `<name>.test.ts`

**New localStorage key:**
- Use `kaheeta:` prefix (e.g., `kaheeta:my-feature`)

---

*Structure analysis: 2026-06-30*
