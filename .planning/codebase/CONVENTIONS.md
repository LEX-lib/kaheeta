# Coding Conventions

**Analysis Date:** 2026-06-30

## Naming Conventions

**Files:**
- Vue components: PascalCase (`BaseMobileDialog.vue`, `ManageExpense.vue`, `GroupDetail.vue`)
- TypeScript modules: camelCase (`expenseMapper.ts`, `perfInstrument.ts`, `splitMath.ts`)
- Test files co-located with source using `.test.ts` suffix (`period.test.ts`, `balances.test.ts`, `splitMath.test.ts`) OR in `__tests__/` subdirectory using `.spec.ts` suffix (`expenseMapper.spec.ts`, `vaccinationMapper.spec.ts`)
- Type definition files: `types.d.ts` (one per feature, inside `src/types/wallecx/<feature>/`)
- Composables: `use` prefix, camelCase (`useToast.ts`, `useMobileEnv.ts`, `useTheme.ts`)
- Stores: `use` prefix + Store suffix (`useAuthStore` in `src/stores/auth.ts`)
- API/mapper files: descriptive noun + verb (`splitsApi.ts`, `expenseMapper.ts`, `membershipMapper.ts`)

**Functions:**
- camelCase for all functions: `computeBalances`, `formatCents`, `instrumentedGetFullList`, `mapToUpdateExpense`
- Composables return camelCase: `useToast()`, `useMobileEnv()`, `useTheme()`
- Boolean-returning helpers use `is`/`has`/`can` prefix: `isValidPeriod`, `isEditMode`, `isOwner`
- Mapper functions: `mapToUpdate<Entity>` pattern (`mapToUpdateExpense`, `mapToUpdateMembership`, `mapToUpdateVaccination`)

**Variables:**
- camelCase: `isSaving`, `loadedCategories`, `isLoadingCategories`, `activeSubTab`
- `ref<T>` used for all reactive state; `computed()` for derived values
- Boolean flags: `isLoading`, `isSaving`, `showManage`, `showPreview`

**Constants:**
- SCREAMING_SNAKE_CASE for exported constants: `DEFAULT_EXPENSE_CATEGORIES`, `PAYMENT_MODES`, `WALLECX_CURRENCY`, `COMMON_CURRENCIES`, `VALID_PERIODS`
- localStorage/sessionStorage keys namespaced as `kaheeta:<feature>-<qualifier>` (e.g. `kaheeta:theme`, `kaheeta:expense-period`, `kaheeta:perf-baseline`)

**Types/Interfaces:**
- PascalCase interfaces: `Expenses`, `GroupMember`, `SplitExpense`, `BalanceSummary`, `MobileEnv`, `SafeAreaInsets`
- Type aliases: PascalCase (`SplitType`, `Theme`, `SubTab`, `PaymentMode`, `FormSplitType`)
- Inferred Zod types: `ExpenseInput`, `ExpenseCategoryInput`
- `Omit<>` utility for derived write types: `AddExpense = Omit<Expenses, "id" | "created" | "updated">`

## Component Patterns

**Script setup style:** All components use `<script setup lang="ts">` — no Options API.

**Props:** Typed generic `defineProps<{...}>()` — no runtime validators:
```ts
const props = defineProps<{
  group: Group
  currentUserId: string
}>()
```

**Emits:** Typed generic `defineEmits<{...}>()`:
```ts
const emit = defineEmits<{
  created: [record: Expenses]
  updated: [record: Expenses]
  left: []
  deleted: []
}>()
```

**Models (two-way binding):** `defineModel` for visibility and record props:
```ts
const visible = defineModel('visible', { type: Boolean, default: false, required: true })
const record = defineModel<Expenses | null>('record', { default: null })
```

**Composables:** Instantiated at component top level, not inside functions:
```ts
const toast = useToast()
const { isMobile } = useMobileEnv()
const confirm = useConfirm()
```

**Async components:** Heavy feature tabs are lazy-loaded with `defineAsyncComponent`:
```ts
const VaccinationsTab = defineAsyncComponent(() => import("./VaccinationsTab.vue"))
```

**Template refs:** Typed with `InstanceType<typeof Component> | null`:
```ts
const baseDialogRef = ref<InstanceType<typeof BaseMobileDialog> | null>(null)
```

**`defineExpose`:** Used selectively to expose imperative methods to parent refs:
```ts
defineExpose({ closeWithoutGuard })
```

**Watchers:** `watch(() => prop.value, handler)` arrow form for prop watching — not `watchEffect`.

**Mobile-first dialog pattern:** `BaseMobileDialog.vue` (`src/components/wallecx/BaseMobileDialog.vue`) is the standard wrapper; it renders as a `<Drawer>` (bottom sheet) on mobile and a `<Dialog>` on desktop based on `useIsMobile()`.

## TypeScript Usage

**Compiler options (from `tsconfig.app.json`):**
- Extends `@vue/tsconfig/tsconfig.dom.json`
- `noUncheckedIndexedAccess: true` — all indexed array/object access returns `T | undefined`
- Path alias `@/*` maps to `./src/*`
- Strict mode inherited from Vue TS config base

**Type locations:**
- Domain types: `src/types/wallecx/<feature>/types.d.ts` (one file per feature)
- API response shapes: co-located in `src/lib/pocketbase/splitsApi.ts` (small interfaces like `CreateGroupResult`)
- Composable return types: exported interface from composable file (`MobileEnv`, `SafeAreaInsets`, `BeforeInstallPromptEvent` in `src/composables/useMobileEnv.ts`)

**Import style:** Always use `import type` for type-only imports:
```ts
import type { Expenses } from '@/types/wallecx/expenses/types'
import type { SplitExpense, SplitShare } from '@/types/wallecx/splits/types'
```

**Zod schemas:** Used for form validation in `src/lib/wallecx/expenseSchema.ts`; inferred types with `z.infer<typeof schema>`.

**`as const` assertions:** Used on readonly tuples/objects to tighten literal types (`PAYMENT_MODES`, `DEFAULT_EXPENSE_CATEGORIES`, `COMMON_CURRENCIES`).

**Error handling with `unknown`:**
```ts
} catch (e: unknown) {
  toast.error('...')
  console.error('Context:', e)
}
```
Never `catch (e: any)` — always `e: unknown` or bare `catch {}`.

**Discriminated union approach for state:** Explicit `null` vs typed value refs — `ref<Expenses | null>(null)`, `ref<SplitExpense | null>(null)`.

## CSS / Styling Conventions

**Utility-first:** Tailwind CSS utility classes are the primary styling approach (e.g. `flex items-center gap-3 py-3 border-b`).

**Scoped styles:** `<style scoped>` is used only when component-specific overrides are needed. Many components have no style block at all.

**Global overrides file:** `src/assets/wallecx-overrides.css` — imported from `WallecxApp.vue` — handles PrimeVue teleported elements (`Dialog`, `Drawer`) that cannot be reached by scoped styles. Use this for PrimeVue panel overrides.

**CSS custom properties (tokens):** Brand/semantic colors referenced via `var(--color-*)` inline styles:
```html
style="color: var(--color-brand-primary)"
style="border-color: var(--color-surface-divider)"
style="background: var(--color-surface-card-2)"
```

**Dark mode:** `.my-app-dark` class on `<html>`. PrimeVue `darkModeSelector` is set to `.my-app-dark`. Never use `@media (prefers-color-scheme: dark)` — always use the `.my-app-dark` class selector.

**PrimeVue CSS classes:** PrimeVue tokens (`--p-card-background`, `--p-drawer-bottom`) are overridden in `wallecx-overrides.css`. Use `!important` only when required to beat PrimeVue's specificity.

**Wallecx-specific utility classes:** `.wallecx-root`, `.wallecx-manage-actions`, `.wallecx-*` — defined in `wallecx-overrides.css` for BEM-style component scoping.

**Icons:**
- `<iconify-icon icon="mdi:...">` — custom element for Iconify icons (fetched at runtime; preloaded set in `src/lib/mdi-icons.json`)
- `icon="pi pi-..."` on PrimeVue `<Button>` components — PrimeIcons

## Import Conventions

**Path alias:** Use `@/` for all `src/`-rooted imports. Never use relative `../../` paths across feature boundaries.

**Auto-imported PrimeVue components:** `<Card>`, `<Button>`, `<Tabs>`, `<Dialog>`, `<Drawer>`, `<Form>`, `<Select>`, etc. are auto-resolved by `unplugin-vue-components` + `PrimeVueResolver`. Do NOT add `import` statements for PrimeVue components.

**Explicitly imported PrimeVue composables:** Composables like `useConfirm` must be imported explicitly — they are NOT auto-resolved:
```ts
import { useConfirm } from 'primevue/useconfirm' // explicit — NOT auto-resolved by PrimeVueResolver
```

**Import ordering (observed pattern):**
1. Vue core (`ref`, `computed`, `watch`, `onMounted`)
2. Third-party libraries (`dayjs`, `pb`)
3. Internal lib (`@/lib/pocketbase/*`, `@/lib/wallecx/*`)
4. Internal composables (`@/composables/*`)
5. Type imports (`import type { ... } from '@/types/...'`)
6. Local component imports (`./BaseMobileDialog.vue`)

**No barrel files:** Each module is imported directly — no `index.ts` re-export barrel pattern in feature directories.

## Error Handling

**Try/catch with `e: unknown`:** All async operations use `try/catch` with typed unknown error:
```ts
try {
  await someAsyncOp()
} catch (e: unknown) {
  toast.error('Human-readable message.')
  console.error('ComponentName: methodName failed', e)
}
```

**Toast notifications for user-visible errors:** `useToast()` from `src/composables/useToast.ts` is the single entry point. Severity-specific methods: `toast.error()`, `toast.warning()`, `toast.info()`, `toast.success()`. Duration defaults are baked in (`error: 6000ms`, `success: 3000ms`).

**Shared toast messages:** Repeated error strings are defined as named helpers on the `useToast` return object (e.g. `toast.sessionExpired()`, `toast.fileTooLarge(maxMb)`).

**PocketBase 401 handling:** Global in `src/lib/pocketbase/index.ts` via `pb.afterSend` — clears auth store on 401 so the navbar reactively reflects logout.

**Silent fallbacks:** Non-critical failures (localStorage quota, sessionStorage in private mode, `navigator.storage.persist`) use empty `catch {}` blocks with comments explaining the silent degradation rationale.

**Never swallows rejections:** `pb.afterSend` is designed to not swallow the rejection — callers still receive the `ClientResponseError`.

**`console.error` as secondary channel:** Always paired with `toast.error` for user-visible failures. Format: `'ComponentName: methodName failed', e`.

## Code Organization Rules

**Separation of concerns:**
- Components (`src/components/wallecx/`) own rendering and user interaction
- `src/lib/pocketbase/` owns all backend access (singleton `pb`, mappers, `splitsApi`, `perfInstrument`)
- `src/lib/wallecx/` owns domain logic (math, formatting, schemas, period helpers)
- `src/types/wallecx/<feature>/types.d.ts` owns type definitions
- `src/composables/` owns reusable reactive logic
- `src/stores/` owns Pinia global state (currently only `auth.ts`)

**No direct PocketBase access from components:** Components must call `instrumentedGetFullList` (not `pb.collection().getFullList()` directly) and must use mapper functions before create/update writes.

**One concern per file:** Mappers each handle exactly one collection. Composables expose one logical capability each. Type files are one per feature.

**Inline snapshots for dirty-state tracking:** Components that manage forms take a `snapshot` ref on open and compute `isDirty` as a computed property comparing current state to snapshot — pattern established in `ManageExpense.vue` and `ManageMembership.vue`.

**`defineAsyncComponent` for feature tabs:** All heavy tab components in `WallecxApp.vue` are async to avoid bundling them in the initial chunk.

**PocketBase `requestKey` discipline:** Every `instrumentedGetFullList` call must pass a unique `requestKey` string to prevent PocketBase auto-cancel collisions. Keys follow the pattern `'<collection>-getFullList'` (e.g. `'expenses-getFullList'`, `'expense-budgets-getFullList'`).
