---
phase: 04-manual-save-with-draft-recovery
fixed_at: 2026-07-01T14:22:00Z
review_path: .planning/phases/04-manual-save-with-draft-recovery/04-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-07-01T14:22:00Z
**Source review:** .planning/phases/04-manual-save-with-draft-recovery/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (3 Critical + 4 Warning; Info findings excluded per scope)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01 + CR-02: flushDraftWrite made async; awaited in onSave

**Files modified:** `src/components/wallecx/ManageNote.vue`
**Commit:** `0819bdf`
**Applied fix:** Changed `flushDraftWrite` from `void`-returning to `async function flushDraftWrite(): Promise<void>`, replacing the un-awaited `void executeDraftWrite()` call with `await executeDraftWrite()`. Updated `onSave` to `await flushDraftWrite()` before proceeding to `saveFn()` and `clearDraft()`, eliminating the race where a late async write could re-persist a just-cleared draft. The `onBeforeUnmount` path is now explicitly `void flushDraftWrite()` with a comment documenting it as best-effort only (cannot await in a sync lifecycle hook). CR-01 and CR-02 share one commit because the fix is a single coherent change to the same function.

---

### CR-03: onHide fallback added to draft-recovery confirm dialog

**Files modified:** `src/components/wallecx/ManageNote.vue`
**Commit:** `56b3c3b`
**Applied fix:** Added an `onHide` callback to the `confirm.require({...})` call. When the dialog is dismissed via Escape key or backdrop click without invoking `accept` or `reject`, `onHide` checks `if (isDecrypting.value)` (guard against double-fire) and sets `editorContent.value = decryptedContent` and `isDecrypting.value = false`, falling back to saved content while keeping the draft in localStorage for the next open.

---

### WR-01: saveDraft localStorage write guarded for quota / private-mode errors

**Files modified:** `src/lib/wallecx/noteDraft.ts`, `src/lib/wallecx/noteDraft.test.ts`
**Commit (source fix):** `d20f55f`
**Commit (tests):** `6491f3d`
**Applied fix:** Wrapped the `localStorage.setItem(...)` call in `saveDraft` with try/catch, emitting a `console.warn` on failure. The function always resolves rather than propagating a `QuotaExceededError` to callers. Added a new `saveDraft — localStorage quota guard (WR-01)` test suite that spies on `Storage.prototype.setItem` to throw `DOMException` and asserts the returned promise resolves without throwing.

---

### WR-02: isDraftNewer returns true when recordUpdated is unparseable

**Files modified:** `src/lib/wallecx/noteDraft.ts`, `src/lib/wallecx/noteDraft.test.ts`
**Commit (source fix):** `d20f55f` (same commit as WR-01, same file)
**Commit (tests):** `6491f3d`
**Applied fix:** Added `if (Number.isNaN(savedTime)) return true` after the existing `draftTime` NaN guard in `isDraftNewer`. An empty string or malformed `recordUpdated` now returns `true` (draft wins) rather than `false` (draft silently discarded). Two new test cases added: `returns true when recordUpdated is an empty string` and `returns true when recordUpdated is a non-date string`.

---

### WR-03: New-note draft cleared under server-assigned id after create

**Files modified:** `src/components/wallecx/ManageNote.vue`
**Commit:** `45f8578`
**Applied fix:** Added `clearDraft(record.value.id || null)` after the existing `clearDraft(oldNoteId)` and `clearDraft(null)` calls in `onSave`. After `saveFn()` completes a create, `record.value.id` holds the real server-assigned id. Clearing it prevents a debounce tick that raced the id assignment from writing a stale draft under the new id that would trigger a spurious recovery prompt on next open.

---

### WR-04: plainBody derived from rawContent to eliminate null-fallback divergence

**Files modified:** `src/components/wallecx/ManageNote.vue`
**Commit:** `dce598a`
**Applied fix:** Changed `const plainBody = JSON.stringify(editorContent.value)` to `const plainBody = JSON.stringify(rawContent)` in `saveFn`. `rawContent` is already declared as `editorContent.value ?? { type: 'doc', content: [] }` and is used for snippet generation. Both `body` and `snippet` now derive from the same null-fallback representation, ensuring they are consistent when `editorContent` is null.

## Skipped Issues

None — all findings were fixed.

---

**Verification results:**
- `npx vitest run`: 143 tests passed across 13 test files (0 failures)
- `npm run type-check`: exit 0, no errors (`vue-tsc --build` clean)

---

_Fixed: 2026-07-01T14:22:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
