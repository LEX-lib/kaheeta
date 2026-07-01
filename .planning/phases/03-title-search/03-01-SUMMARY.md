---
phase: 03-title-search
plan: "01"
subsystem: notes
tags: [search, filter, client-side, pure-function, tdd, primevue]
dependency_graph:
  requires: [02-03]
  provides: [LIST-03]
  affects: [src/components/wallecx/NotesTab.vue]
tech_stack:
  added: []
  patterns: [pure-filter-helper, computed-composition, tdd-red-green]
key_files:
  created:
    - src/lib/wallecx/noteSearch.ts
    - src/lib/wallecx/noteSearch.test.ts
  modified:
    - src/components/wallecx/NotesTab.vue
decisions:
  - "filterNotesByTitle returns the input array reference unchanged for empty query (no copy overhead)"
  - "filteredNotes composes over sortedNotes so sort order is preserved through the filter"
  - "hasActiveQuery derived from trimmed searchQuery.length rather than filteredNotes.length so clear button shows/hides based on input, not results"
  - "Search bar sits between the New note button row and the list — clean visual flow"
  - "Simple flex wrapper (not IconField/InputIcon) used for search bar — keeps clear button adjacent without nesting PrimeVue compound inside compound"
metrics:
  duration: "2m 54s"
  completed: "2026-07-01"
  tasks_completed: 2
  files_changed: 3
---

# Phase 3 Plan 1: Client-Side Title Search Summary

**One-liner:** Instant case-insensitive title filtering via a pure `filterNotesByTitle` helper wired into `NotesTab.vue` with a PrimeVue search `<InputText>`, conditional clear button, and a distinct search-empty state — no server round-trip.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add failing Vitest tests for filterNotesByTitle | bb6ed8e | src/lib/wallecx/noteSearch.test.ts |
| 1 (GREEN) | Implement filterNotesByTitle pure helper | 5fe8c3e | src/lib/wallecx/noteSearch.ts |
| 2 | Wire search state + UI into NotesTab.vue | 252622d | src/components/wallecx/NotesTab.vue |

## What Was Built

### Task 1 — `src/lib/wallecx/noteSearch.ts` + `noteSearch.test.ts`

A pure, synchronous `filterNotesByTitle(notes: Note[], query: string): Note[]` function:
- Trims and lowercases the query once; returns the input array unchanged for empty/whitespace queries
- Case-insensitive substring match on `note.title` only (body/snippet not touched)
- Notes with empty title are excluded when query is active
- 14 Vitest cases covering all `<behavior>` clauses — all green

### Task 2 — `src/components/wallecx/NotesTab.vue` additions

- `const searchQuery = ref('')` — ephemeral UI state, never persisted
- `const hasActiveQuery = computed(() => searchQuery.value.trim().length > 0)`
- `const filteredNotes = computed(() => filterNotesByTitle(sortedNotes.value, searchQuery.value))` — composes on top of the existing newest-first sort
- PrimeVue `<InputText>` (auto-imported) with `v-model="searchQuery"` and `aria-label`
- Conditional `<Button icon="pi pi-times">` clear button (`v-if="hasActiveQuery"`) — sets `searchQuery = ''` on click
- List iterates `v-for="note in filteredNotes"` / `v-if="filteredNotes.length > 0"`
- Two empty-state branches: search-specific (`mdi:file-search-outline`) when `hasActiveQuery && filteredNotes.length === 0`; original "No notes yet." when no query and no notes

## Verification

- `npx vitest run src/lib/wallecx/noteSearch.test.ts` — 14/14 passed
- `npm run type-check` — exits 0
- `grep -c instrumentedGetFullList src/components/wallecx/NotesTab.vue` — returns 2 (import + 1 usage; unchanged from pre-task state, no search-path backend call added)

## Deviations from Plan

### Plan Acceptance Criteria — grep gate count discrepancy

**Found during:** Task 2 acceptance check
**Issue:** The plan acceptance criteria states `grep -c instrumentedGetFullList src/components/wallecx/NotesTab.vue` returns 1, but the original file (pre-task) already had 2 occurrences: the import statement (line 5) and the actual call (line 46). The plan's stated count was inaccurate.
**Resolution:** The intent of the gate — "no new backend call in the search path" — is fully satisfied. Count is still 2 (import + 1 call), identical to pre-task. No new `instrumentedGetFullList`, `pb.collection`, or watcher was added for search. Documented as a plan inaccuracy, not a code deviation.

No other deviations — plan executed as written.

## TDD Gate Compliance

- RED gate commit: `bb6ed8e` — `test(03-01): add failing tests for filterNotesByTitle (RED)`
- GREEN gate commit: `5fe8c3e` — `feat(03-01): implement filterNotesByTitle pure helper (GREEN)`
- REFACTOR: not needed — implementation was already clean

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Search operates entirely in-memory on the already-loaded `notes` array. The search query is consumed only as a JS substring argument against `note.title`. Vue text interpolation (`{{ }}`) handles rendering — no `v-html`. No new threat surface beyond what the plan's STRIDE register already assessed (T-03-01, T-03-02 both accepted).

## Self-Check

Files created/modified:
- [x] `src/lib/wallecx/noteSearch.ts` — EXISTS
- [x] `src/lib/wallecx/noteSearch.test.ts` — EXISTS
- [x] `src/components/wallecx/NotesTab.vue` — MODIFIED

Commits:
- [x] `bb6ed8e` — exists (test RED)
- [x] `5fe8c3e` — exists (feat GREEN)
- [x] `252622d` — exists (feat Task 2)

## Self-Check: PASSED
