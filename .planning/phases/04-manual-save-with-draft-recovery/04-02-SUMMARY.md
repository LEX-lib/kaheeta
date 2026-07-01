---
phase: 04-manual-save-with-draft-recovery
plan: "02"
subsystem: notes-editor
tags: [manual-save, draft-recovery, encrypted-draft, ux]
dependency_graph:
  requires: [src/lib/wallecx/noteDraft.ts]
  provides: [src/components/wallecx/ManageNote.vue, src/components/wallecx/NotesTab.vue]
  affects: [notes-editor-ux, notes-list]
tech_stack:
  added: []
  patterns: [manual-save, debounced-draft-write, restore-discard-prompt, dirty-guard]
key_files:
  created: []
  modified:
    - src/components/wallecx/ManageNote.vue
    - src/components/wallecx/NotesTab.vue
decisions:
  - "Local 800ms debounce via setTimeout ref for draft writes — useAutoSave composable not reused because its PocketBase serialisation semantics (isRunning, rerunRequested, status machine) add accidental complexity to a localStorage-only draft path"
  - "onDiscard does NOT clearDraft — the whole point of EDIT-02 is that closing keeps the draft so the user can recover it on next open"
  - "onBeforeUnmount always calls flushDraftWrite() — even when onDiscard fired, the timer is already null so flushDraftWrite is a no-op; no extra guard needed"
  - "New-note Restore/Discard logic treats any :new draft as newer unconditionally (isNew.value = true path) rather than calling isDraftNewer, because a new note has no record.updated timestamp"
  - "Save button kept dialog open after save (save-in-place UX) rather than auto-closing — cleaner for multi-edit sessions"
metrics:
  duration_seconds: 420
  completed_date: "2026-07-01"
  tasks_completed: 2
  files_created: 0
  files_modified: 2
---

# Phase 4 Plan 2: ManageNote Manual Save + Draft Recovery Summary

**One-liner:** Rewired ManageNote.vue from transparent auto-save to explicit manual Save with debounced encrypted localStorage draft writes and Restore/Discard recovery on reopen; NotesTab.vue clears orphaned drafts on delete.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace auto-save with manual Save + debounced encrypted draft writes | ea3b39c | src/components/wallecx/ManageNote.vue |
| 2 | Clear the local draft when a note is deleted in NotesTab.vue | 6c240e0 | src/components/wallecx/NotesTab.vue |

## What Was Built

### ManageNote.vue (Task 1)

**Removed:**
- `useAutoSave` composable import and usage (`trigger`, `flush`, `cancel`, `status`)
- Auto-save status computed refs (`statusText`, `statusColor`) and their `<span>` in the template

**Added:**
- `isDirty = ref(false)` — set to `true` on any `@input` / `@update:model-value`, reset to `false` on successful Save
- `isSaving = ref(false)` — guards concurrent saves, disables the Save button in flight
- `scheduleDraftWrite()` — 800ms debounce via `setTimeout` ref; calls `saveDraft(noteId, {title, body}, key)` from `noteDraft.ts`; guards against writing during the decrypt phase
- `flushDraftWrite()` — synchronous flush of the pending timer for `onBeforeUnmount`
- Draft recovery in `onMounted`: after decrypt completes, calls `loadDraft`; if draft exists and is newer (or note is new), fires `useConfirm().require({ header: 'Unsaved changes found', … })` with Restore / Discard options
- `onSave()` — flushes draft timer, calls `saveFn()`, clears draft (both `note.id` key and `:new` key on success), resets `isDirty`; toast.error on failure
- `onDiscard()` — cancels the debounce timer only; draft is intentionally kept
- `onBeforeUnmount` → `flushDraftWrite()` to persist the last keystroke on accidental close
- Save `<Button>` in `#actions` slot: `:disabled="!isDirty || isSaving"`, `:loading="isSaving"`
- Dirty indicator: `<span aria-live="polite">` showing "Unsaved changes" when dirty, empty string when clean

**Justification for local debounce over `useAutoSave`:** `useAutoSave` serialises concurrent PocketBase calls via `isRunning` + `rerunRequested` and carries a status state machine (`idle | pending | saving | saved | error`). Those semantics are meaningless for a pure localStorage write (no concurrency risk, no status to surface). Pulling in the full composable for a `setTimeout` would be misleading abstraction leakage. A focused 10-line local debounce is cleaner and consistent with the CONTEXT.md "extract a focused composable" guidance.

### NotesTab.vue (Task 2)

- Added `import { clearDraft } from '@/lib/wallecx/noteDraft'`
- In `requestDelete` accept handler: `clearDraft(note.id)` called after successful `pb.collection('kaheeta_notes').delete(note.id)` and list splice, before the success toast
- No other change to the delete flow

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Coverage

| Threat | Disposition | Implementation |
|--------|-------------|----------------|
| T-04-04: Information Disclosure (draft → localStorage) | mitigated | `scheduleDraftWrite` passes `getOrDeriveKey()` key to `saveDraft` — AES-GCM ciphertext only reaches localStorage |
| T-04-05: Information Disclosure (stale draft after delete) | mitigated | `clearDraft(note.id)` in `requestDelete` accept handler |
| T-04-06: Tampering / Repudiation (silent content swap) | mitigated | `loadDraft` returns null on corrupt/tampered draft (AES-GCM auth-tag); explicit Restore/Discard confirm required before any draft content replaces saved content |

## Known Stubs

None — the manual Save flow is fully implemented end-to-end. The dirty indicator shows real state, the Save button performs real PocketBase writes, and the draft is real encrypted localStorage content.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced beyond those documented in the plan's threat model.

## Self-Check: PASSED

- [x] `src/components/wallecx/ManageNote.vue` exists and contains `saveDraft`, `loadDraft`, `clearDraft`, `isDraftNewer`
- [x] `ManageNote.vue` does NOT contain `useAutoSave` (grep count = 0)
- [x] `saveFn` called only from `onSave` (line 263 only)
- [x] Save `<Button>` present in `#actions` slot with `:disabled="!isDirty || isSaving"`
- [x] `onDiscard` does NOT call `clearDraft`
- [x] `onBeforeUnmount` calls `flushDraftWrite()`
- [x] `src/components/wallecx/NotesTab.vue` imports `clearDraft` and calls `clearDraft(note.id)` in delete handler
- [x] Task 1 commit `ea3b39c` exists
- [x] Task 2 commit `6c240e0` exists
- [x] `npm run type-check` exits 0 after both tasks
