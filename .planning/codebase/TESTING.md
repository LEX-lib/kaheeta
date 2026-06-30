# Testing

**Analysis Date:** 2026-06-30

## Test Setup

**Framework:** Vitest (configured in `vitest.config.ts`)

**Environment:** `jsdom` — simulates a browser DOM for all tests.

**Config:** `vitest.config.ts` merges the full Vite config (`vite.config.ts`) so path aliases (`@/*`) and plugins are identical between app and test runs:
```ts
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
```

**TypeScript config for tests:** `tsconfig.vitest.json` (referenced from root `tsconfig.json`).

**ESLint plugin:** `@vitest/eslint-plugin` applied to `src/**/__tests__/*` files (configured in `eslint.config.ts`).

**Run commands:**
```bash
npm run test:unit          # Vitest in watch mode
npx vitest run             # All tests once (CI-style)
npx vitest run src/lib/wallecx/period.test.ts   # Single file
npx vitest run -t "name fragment"               # By test name
```

## Test Location & Naming

Two co-existing conventions:

**Pattern A — co-located `.test.ts`:** For pure domain/utility modules in `src/lib/wallecx/`. Test file lives next to the source file with a `.test.ts` suffix:
```
src/lib/wallecx/
  balances.ts
  balances.test.ts
  splitMath.ts
  splitMath.test.ts
  simplifyDebts.ts
  simplifyDebts.test.ts
  period.ts
  period.test.ts
```

**Pattern B — `__tests__/` subdirectory with `.spec.ts`:** For PocketBase layer tests in `src/lib/pocketbase/`. Tests live in a `__tests__/` folder, named `<module>.spec.ts`:
```
src/lib/pocketbase/
  expenseMapper.ts
  membershipMapper.ts
  vaccinationMapper.ts
  __tests__/
    expenseMapper.spec.ts
    membershipMapper.spec.ts
    vaccinationMapper.spec.ts
```

**Note:** The ESLint vitest plugin only covers `src/**/__tests__/*` (Pattern B). Pattern A files are not linted with vitest-specific rules.

## Test Types Present

**Unit tests only.** No integration tests, no e2e tests are present (the `e2e/**` directory is excluded in `vitest.config.ts` but doesn't contain any files).

All 7 test files test pure TypeScript functions in isolation — no Vue components are mounted in any test.

## Coverage

No coverage threshold is configured. Coverage tooling is not set up.

**Tested areas:**
- `src/lib/wallecx/balances.ts` — `computeBalances` function (6 cases)
- `src/lib/wallecx/splitMath.ts` — `equalSplit` and `weightedSplit` (13 cases, including property-based loops)
- `src/lib/wallecx/simplifyDebts.ts` — `simplifyDebts` (6 cases, cross-referencing `computeBalances`)
- `src/lib/wallecx/period.ts` — constants, `isValidPeriod`, `getPeriodRange`, `formatPeriodLabel` (12 cases)
- `src/lib/pocketbase/expenseMapper.ts` — `mapToUpdateExpense` field stripping and preservation (9 cases)
- `src/lib/pocketbase/membershipMapper.ts` — `mapToUpdateMembership` field stripping and preservation (11 cases)
- `src/lib/pocketbase/vaccinationMapper.ts` — `mapToUpdateVaccination` field stripping and preservation (9 cases)

**Untested areas (see Gaps section):**
- All Vue components (`src/components/wallecx/*.vue`)
- All composables (`src/composables/*.ts`)
- PocketBase API module (`src/lib/pocketbase/splitsApi.ts`, `perfInstrument.ts`)
- Pinia store (`src/stores/auth.ts`)
- Router (`src/router/index.ts`)
- Currency formatting (`src/lib/wallecx/currency.ts`, `splitFormat.ts`)
- Schema validation (`src/lib/wallecx/expenseSchema.ts`)
- Utility libs (`src/lib/wallecx/compressToWebP.ts`, `useChecklists.ts`)

## Testing Patterns

**Imports — explicit Vitest API:**
```ts
import { describe, it, expect } from 'vitest'
```
No globals — `vitest.config.ts` does not set `globals: true`, so all test APIs must be imported explicitly.

**Factory functions for test fixtures:** Each test file defines one or more local builder functions that produce domain objects with sensible defaults and an overrides parameter:
```ts
// balances.test.ts
function expense(partial: Partial<SplitExpense> & { paid_by: string }): SplitExpense {
  seq += 1
  return {
    id: `e${seq}`,
    created: '',
    updated: '',
    group: 'g1',
    name: 'Test',
    amount: 0,
    currency: 'USD',
    split_type: 'equal' as SplitType,
    expense_date: '2026-06-01',
    ...partial,
  } as SplitExpense
}

// mapper specs
const makeExpense = (overrides: Partial<Expenses> = {}): Expenses => ({
  id: 'server-id-123',
  // ...all required fields...
  ...overrides,
})
```

**No mocking.** All tested functions are pure — no `vi.mock`, `vi.fn`, or `vi.spyOn` appear anywhere. Tests call real functions with real inputs.

**`describe` grouping:** Tests are grouped by function name or contract name at the top level, with nested `describe` blocks for sub-concerns:
```ts
describe('period.ts', () => {
  describe('isValidPeriod', () => { ... })
  describe('getPeriodRange — quarterOfYear plugin sanity', () => { ... })
  describe('formatPeriodLabel', () => { ... })
})
```

Mapper specs use separate top-level `describe` blocks per contract:
```ts
describe('mapToUpdateExpense strips server-managed fields', () => { ... })
describe('mapToUpdateExpense preserves writable fields', () => { ... })
describe('create-then-update id-refresh contract', () => { ... })
```

**Assertion style:**
- `expect(value).toEqual(expected)` — deep equality, primary assertion
- `expect(value).toBe(expected)` — reference/primitive equality
- `expect(value).toHaveLength(n)` — array length
- `expect(value).not.toHaveProperty('field')` — absence checks (mapper specs)
- `expect(array).toEqual(expect.arrayContaining([...]))` — order-agnostic membership
- `expect(fn).not.toThrow()` — error-boundary checks
- `expect(value).toMatch(/regex/)` — string pattern checks

**Property-based loops (manual):** Used in `splitMath.test.ts` to verify mathematical invariants across ranges:
```ts
it('always sums to the total across many remainder sizes', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
  for (let total = 0; total <= 100; total++) {
    for (let n = 1; n <= ids.length; n++) {
      expect(sum(equalSplit(total, ids.slice(0, n)))).toBe(total)
    }
  }
})
```

**Module-level counter for unique IDs:** `let seq = 0` at the top of test files to generate distinct IDs across test cases without collisions:
```ts
let seq = 0
function expense(...): SplitExpense {
  seq += 1
  return { id: `e${seq}`, ... }
}
```

**Inline comments explain domain context:** Test cases include comments explaining the financial scenario being modeled (e.g. `// Alice pays 100.00, split equally with Bob.`).

**`create-then-update id-refresh contract`:** A reusable contract test appears in all three mapper spec files, verifying that `Object.assign(localItem, serverRecord)` correctly propagates the server-assigned `id` for subsequent PATCH calls.

## Gaps

**No component tests.** None of the 35 Vue components in `src/components/wallecx/` have tests. All user-visible behavior (form validation, dirty-state guards, mobile/desktop branching in `BaseMobileDialog`, dialog open/close lifecycle) is untested.

**No composable tests.** `useTheme`, `useMobileEnv`, `useIsMobile`, `useToast`, `useProfileMenu`, `useChartTheme` are all untested.

**No store tests.** `src/stores/auth.ts` (Pinia) has no tests. Auth lifecycle (login/logout, token expiry via `pb.afterSend`) is not covered.

**No router guard tests.** The `beforeEach` auth guard in `src/router/index.ts` is untested.

**No PocketBase API tests.** `src/lib/pocketbase/splitsApi.ts` (all group/expense/share write routes) and `perfInstrument.ts` are untested — they depend on `pb.send` and would require mocking.

**No schema validation tests.** `src/lib/wallecx/expenseSchema.ts` (Zod schema) is not tested — valid/invalid input sets and error messages are untested.

**No currency/formatting tests.** `src/lib/wallecx/currency.ts` (`formatCurrency`) and `src/lib/wallecx/splitFormat.ts` (`formatCents`) are untested.

**No e2e tests.** The `e2e/**` directory is excluded in config but contains no files. No Playwright/Cypress setup exists.
