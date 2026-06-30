---
phase: 01-core-notes-crud
plan: "02"
subsystem: notes-editor
tags: [tiptap, editor, auto-save, composable, tdd]
dependency_graph:
  requires: []
  provides:
    - useAutoSave composable (src/composables/useAutoSave.ts)
    - NoteEditor.vue Tiptap wrapper (src/components/wallecx/NoteEditor.vue)
    - WallecxSkeleton note-row variant
    - ProseMirror dark-mode + placeholder CSS
  affects:
    - src/components/wallecx/WallecxSkeleton.vue
    - src/assets/wallecx-overrides.css
tech_stack:
  added:
    - "@tiptap/vue-3 ^3.27.1 — Vue 3 editor bindings"
    - "@tiptap/pm ^3.27.1 — ProseMirror peer dependency"
    - "@floating-ui/dom ^1.7.6 — menu positioning (BubbleMenu v3)"
    - "@tiptap/extension-bold ^3.27.1"
    - "@tiptap/extension-italic ^3.27.1"
    - "@tiptap/extension-heading ^3.27.1"
    - "@tiptap/extension-bullet-list ^3.27.1"
    - "@tiptap/extension-link ^3.27.1"
    - "@tiptap/extension-document ^3.27.1"
    - "@tiptap/extension-paragraph ^3.27.1"
    - "@tiptap/extension-text ^3.27.1"
    - "@tiptap/extension-list-item ^3.27.1"
    - "@tiptap/extension-hard-break ^3.27.1"
    - "@tiptap/extension-history ^3.27.1"
  patterns:
    - "TDD RED/GREEN for useAutoSave composable"
    - "Custom debounce with flush() — replaces @vueuse/core useDebounceFn (no .flush() in v14)"
    - "Tiptap v3 BubbleMenu imported from @tiptap/vue-3/menus (not @tiptap/vue-3)"
    - "visualViewport resize listener for iOS keyboard avoidance"
    - "emitUpdate:false on setContent to prevent phantom auto-saves on load"
key_files:
  created:
    - src/composables/useAutoSave.ts
    - src/composables/useAutoSave.test.ts
    - src/components/wallecx/NoteEditor.vue
  modified:
    - src/components/wallecx/WallecxSkeleton.vue
    - src/assets/wallecx-overrides.css
    - package.json
    - package-lock.json
decisions:
  - "Custom setTimeout debounce with explicit flush() used instead of @vueuse/core useDebounceFn — v14.x does not expose .flush() on the returned function (UseDebounceFnReturn = PromisifyFn<T>, a plain wrapper)"
metrics:
  duration_minutes: 8
  completed_date: "2026-06-30"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 4
---

# Phase 1 Plan 02: Tiptap Editor Component + useAutoSave Summary

**One-liner:** Tiptap v3 editor wrapper with desktop toolbar, BubbleMenu, iOS keyboard handling, and custom debounce-with-flush auto-save composable.

## What Was Built

### Task 1: Tiptap packages + useAutoSave composable (TDD)

Installed 14 npm packages for the Tiptap v3 editor stack:
- `@tiptap/vue-3`, `@tiptap/pm`, `@floating-ui/dom` (core)
- 11 individual Tiptap extensions (no StarterKit — selective install for smaller bundle)

Created `src/composables/useAutoSave.ts` with:
- `AutoSaveStatus` type: `'idle' | 'pending' | 'saving' | 'saved' | 'error'`
- `useAutoSave(saveFn, delayMs = 1000)` returning `{ status, trigger, flush }`
- Custom debounce implementation (see Deviations) with explicit `flush()` support

Created `src/composables/useAutoSave.test.ts` with 4 tests:
1. status is idle on init
2. trigger() sets status to pending synchronously
3. after flush(), saveFn is called and status becomes saved
4. after flush() with failing saveFn, status becomes error

All 4 tests pass.

### Task 2: NoteEditor.vue + WallecxSkeleton note-row + CSS

Created `src/components/wallecx/NoteEditor.vue`:
- Tiptap `useEditor` with all required extensions (Document, Paragraph, Text, Bold, Italic, Heading[1,2,3], BulletList, ListItem, HardBreak, Link, History)
- `Link.configure({ openOnClick: false, protocols: ['http', 'https'] })` — XSS mitigation (T-02-01)
- Desktop toolbar with 7 PrimeVue `<Button text rounded>` icon buttons
- `BubbleMenu` imported from `@tiptap/vue-3/menus` (v3 breaking change path)
- `visualViewport` resize/scroll listener for iOS keyboard padding
- `watch(modelValue)` with `setContent(val, false)` — emitUpdate:false prevents phantom auto-saves on programmatic load
- Editor wrapper div with `aria-label="Note body"`, `role="textbox"`, `aria-multiline="true"`

Updated `src/components/wallecx/WallecxSkeleton.vue`:
- Added `'note-row'` to Props variant union
- New template block: `<Skeleton height="4rem" class="w-full rounded">` in `v-for` loop

Updated `src/assets/wallecx-overrides.css` (appended, existing rules untouched):
- `.ProseMirror` base typography (1rem, 1.6 line-height, 200px min-height)
- `.ProseMirror h1/h2/h3` heading sizes
- Light-mode link color
- Placeholder CSS via `attr(data-placeholder)` (float:left technique)
- `.my-app-dark .ProseMirror` surface/caret/text overrides
- `.my-app-dark .ProseMirror h1/h2/h3` heading color
- `.my-app-dark .ProseMirror a` amber link
- BubbleMenu dark-mode selectors (`.tiptap-bubble-menu`, `[data-tippy-content]`, `.floating-ui-bubble`)

## Verification Results

| Check | Result |
|-------|--------|
| `npx vitest run src/composables/useAutoSave.test.ts` | PASS — 4/4 tests |
| `npx tsc --noEmit` | PASS — 0 errors |
| NoteEditor.vue contains `from '@tiptap/vue-3/menus'` | PASS |
| NoteEditor.vue contains `protocols: ['http', 'https']` | PASS |
| NoteEditor.vue contains `aria-label="Note body"` | PASS |
| WallecxSkeleton.vue variant union contains `'note-row'` | PASS |
| wallecx-overrides.css contains `.my-app-dark .ProseMirror` | PASS |
| wallecx-overrides.css contains `data-placeholder` | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @vueuse/core 14.x useDebounceFn has no .flush() method**
- **Found during:** Task 1 GREEN phase
- **Issue:** The plan and RESEARCH.md (Assumption A4) stated that `useDebounceFn` from `@vueuse/core` returns a function with a `.flush()` method. In version 14.3.0, `UseDebounceFnReturn<T>` is typed as `PromisifyFn<T>` — a plain function wrapper with no `.flush()` property. The runtime confirmed this: `typeof debouncedSave.flush === 'undefined'`.
- **Fix:** Replaced `useDebounceFn` with a custom `setTimeout`-based debounce that explicitly tracks the pending execution and exposes a `flush()` function. The composable's public API (`status`, `trigger`, `flush`) is unchanged — only the internal implementation differs.
- **Files modified:** `src/composables/useAutoSave.ts`
- **Commit:** d8542f5

## Known Stubs

None — all code is wired to real logic. `promptLink()` uses `window.prompt()` which is the v1-approved approach per UI-SPEC.md §Link Prompt.

## Threat Surface Scan

No new threat surface introduced beyond what the plan's threat model covered:
- `Link.configure({ protocols: ['http', 'https'] })` mitigates T-02-01 (javascript: href XSS) — implemented as required
- Editor stores JSON (getJSON()) not HTML — no HTML round-trip XSS vector (T-02-02 accepted)
- `window.prompt()` for URL input is non-injectable (browser native dialog, no HTML rendering)

No new network endpoints, auth paths, or trust boundary crossings introduced in this plan.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test) | d8542f5 (test file created, failing before implementation) | PASS |
| GREEN (impl) | d8542f5 (composable + packages in same commit after tests passed) | PASS |
| REFACTOR | Not needed — implementation is clean | N/A |

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/composables/useAutoSave.ts | FOUND |
| src/composables/useAutoSave.test.ts | FOUND |
| src/components/wallecx/NoteEditor.vue | FOUND |
| .planning/phases/01-core-notes-crud/01-02-SUMMARY.md | FOUND |
| Commit d8542f5 (Task 1) | FOUND |
| Commit f7402e5 (Task 2) | FOUND |
