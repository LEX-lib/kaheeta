---
phase: 04-manual-save-with-draft-recovery
verified: 2026-07-01T14:35:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "EDIT-02 last-keystroke durability under fast close"
    expected: >
      Editing a note and immediately closing the dialog (within 800ms of the last
      keystroke, before the debounce fires) should still persist the draft so it
      is recoverable on next open.
    why_human: >
      The 800ms debounced draft write is inherently async (Web Crypto AES-GCM
      cannot encrypt synchronously). The onBeforeUnmount flush is void/best-effort
      and cannot be awaited. This creates a theoretical last-keystroke loss window
      of up to 800ms on fast close. The REVIEW-FIX.md accepted this as an
      architectural constraint. Human testing is needed to confirm whether the
      best-effort unmount flush completes in practice on typical browser behaviour,
      or whether the 800ms window is a real durability gap for the stated goal
      ("accidental refresh or close does not lose work").
  - test: "Restore/Discard prompt — visual and interaction smoke test"
    expected: >
      Opening a note that has a newer encrypted localStorage draft shows a PrimeVue
      ConfirmDialog with header "Unsaved changes found", Accept label "Restore",
      Reject label "Discard". Clicking Restore populates the editor with the draft
      content and marks it dirty. Clicking Discard loads the saved version.
      Dismissing via Escape key falls back to saved content and keeps the draft.
    why_human: >
      The confirm.require wiring is verified in code, but the actual PrimeVue
      ConfirmDialog rendering and the three dismissal paths (Accept / Reject /
      onHide) cannot be tested programmatically without a running browser.
  - test: "Draft is kept (not cleared) when closing dialog with unsaved edits"
    expected: >
      Edit a note, do NOT save, close the dialog. The onDiscard confirm fires.
      After closing, localStorage should still contain the draft under
      kaheeta:note-draft:<id>. Reopening the note should trigger the
      Restore/Discard prompt.
    why_human: >
      onDiscard does not call clearDraft (verified in code), but confirming the
      full round-trip (close → draft persists → reopen → prompt appears) requires
      manual browser interaction.
  - test: "New-note draft lifecycle: save clears :new key, no spurious prompt on reopen"
    expected: >
      Create a new note, type content (draft goes to kaheeta:note-draft:new), Save.
      After save: localStorage should have no kaheeta:note-draft:new and no
      kaheeta:note-draft:<new-id> entry. Opening the newly created note should show
      no recovery prompt.
    why_human: >
      Three clearDraft calls in onSave (oldNoteId, null, record.value.id) cover
      all key variants. Verifying this in a real create flow with timing requires
      browser testing, as the WR-03 fix relies on the id assignment timing after
      Object.assign in saveFn.
  - test: "Draft value in localStorage is ciphertext, not readable plaintext"
    expected: >
      After editing a note, inspect localStorage in DevTools.
      The value under kaheeta:note-draft:<id> should be a JSON object with a
      'content' field containing Base64 ciphertext, a 'savedAt' field, and NO
      'title' or 'body' fields. The content value should not contain any readable
      note text.
    why_human: >
      The ciphertext-at-rest property is unit-tested in noteDraft.test.ts, but
      end-to-end verification that the ManageNote.vue path also produces only
      ciphertext (via getOrDeriveKey + saveDraft) is a useful sanity check.
---

# Phase 4: Manual Save with Draft Recovery — Verification Report

**Phase Goal:** Replace the transparent auto-save in the note editor with an explicit
manual Save action. While a note is open, unsaved edits are continuously stashed to
localStorage as a draft; on reopening a note with a newer local draft the user is
offered draft recovery. Saving commits the draft to PocketBase (encrypted per Phase 2)
and clears the local draft; discarding drops it.

**Verified:** 2026-07-01T14:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A note draft can be written to localStorage under a `kaheeta:`-prefixed per-note key | VERIFIED | `draftKey()` returns `kaheeta:note-draft:<id>` / `kaheeta:note-draft:new` (noteDraft.ts:57). 4 draftKey tests pass. |
| 2 | The stored draft value contains only ciphertext — never readable plaintext title/body | VERIFIED | `saveDraft` JSON-serialises `{title,body}`, encrypts via `encryptBody` (AES-GCM), writes `{content: ciphertext, savedAt}`. Test explicitly asserts `raw` does not contain plaintext title substring (noteDraft.test.ts:63-70). |
| 3 | A stored draft round-trips: encrypt-then-decrypt returns the original title and body | VERIFIED | 3 round-trip tests pass (title+body JSONContent, null body, savedAt as parseable ISO). Real `CryptoKey` via `deriveKey`, no mocks. |
| 4 | A corrupt or absent draft is read as null and never throws | VERIFIED | 5 absent/corrupt guard tests pass: missing key, garbage JSON, wrong key (tampered), plaintext content field, missing content field. Both `JSON.parse` calls and `decryptBody` wrapped in independent try/catch blocks. |
| 5 | "Newer than saved" is decided by comparing draft's `savedAt` against record's `updated` | VERIFIED | `isDraftNewer` uses `Date.parse` comparison (noteDraft.ts:166-177); returns false for falsy/unparseable savedAt; returns true when recordUpdated is unparseable (WR-02 fix). 9 isDraftNewer tests pass. |
| 6 | The note editor shows an explicit Save button, enabled only when dirty | VERIFIED | `<Button label="Save" :disabled="!isDirty \|\| isSaving" :loading="isSaving" @click="onSave">` in `#actions` slot (ManageNote.vue:365-371). `isDirty` set to `true` on `@input` and `@update:model-value`, reset to `false` on successful save. |
| 7 | Editing no longer writes to PocketBase on debounce — `saveFn` runs only from the Save button | VERIFIED | `useAutoSave` is completely absent (grep: 0 matches in ManageNote.vue). `saveFn` appears only at line 228 (definition) and 284 (called from `onSave` only). Edit handlers call `scheduleDraftWrite()` not `saveFn`. |
| 8 | Reopening a note with a newer draft shows a Restore/Discard confirm before editor is populated | VERIFIED | `onMounted` calls `loadDraft`, checks `isDraftNewer` (or `isNew` path), then calls `confirm.require({ header: 'Unsaved changes found', acceptLabel: 'Restore', rejectLabel: 'Discard', onHide: ... })` and returns early (ManageNote.vue:183-212). `onHide` fallback present (CR-03 fix). |
| 9 | Deleting a note clears its local draft | VERIFIED | `NotesTab.vue` imports `clearDraft` (line 11) and calls `clearDraft(note.id)` inside the successful branch of the `requestDelete` accept handler (line 83), after `pb.delete` and list splice, before success toast. |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/wallecx/noteDraft.ts` | Pure draft key/serialize/deserialize/compare helpers | VERIFIED | 177 lines (min: 50). Exports: `draftKey`, `saveDraft`, `loadDraft`, `clearDraft`, `isDraftNewer`. Imports `encryptBody`/`decryptBody` from `./notesCrypto`. No Vue/PocketBase imports. |
| `src/lib/wallecx/noteDraft.test.ts` | Vitest unit tests (round-trip, corrupt, newer-than, key format) | VERIFIED | 256 lines (min: 40). 29 tests, all passing. Derives real `CryptoKey` via `deriveKey`. Explicit ciphertext-at-rest assertion. WR-01/WR-02 test suites added. |
| `src/components/wallecx/ManageNote.vue` | Manual Save + dirty indicator + draft write-on-edit + Restore/Discard | VERIFIED | Contains `saveDraft`, `loadDraft`, `clearDraft`, `isDraftNewer` (all four). `useAutoSave` absent. Save button in `#actions`. `isDirty` / `isSaving` wired to template. `onHide` fallback present. |
| `src/components/wallecx/NotesTab.vue` | `clearDraft` call in note-delete accept handler | VERIFIED | Imports `clearDraft` from `@/lib/wallecx/noteDraft`. Called at line 83 after successful delete. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ManageNote.vue` | `noteDraft.ts` | `saveDraft / loadDraft / clearDraft / isDraftNewer` | WIRED | Import at line 10, all four functions called in the component body. |
| `ManageNote.vue` | `primevue/useconfirm` | `useConfirm()` for Restore/Discard recovery prompt | WIRED | Imported line 3, instantiated line 40, called in `onMounted` draft-recovery path. |
| `noteDraft.ts` | `notesCrypto.ts` | `encryptBody / decryptBody` reuse for at-rest encryption | WIRED | Import line 1, `encryptBody` called in `saveDraft` (line 76), `decryptBody` called in `loadDraft` (line 123). |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `ManageNote.vue` draft writes | `editorContent` / `record.value.title` | User input → `scheduleDraftWrite()` → `executeDraftWrite()` → `saveDraft(noteId, {title, body}, key)` | Yes — real encrypted localStorage write | FLOWING |
| `ManageNote.vue` draft recovery | `draft` from `loadDraft()` | `localStorage.getItem(draftKey(noteId))` → AES-GCM decrypt → JSON.parse | Yes — real decrypted draft content | FLOWING |
| `ManageNote.vue` PocketBase save | `saveFn()` | `encryptBody(key, plainBody)` → `pb.collection('kaheeta_notes').create/update` | Yes — real PocketBase write | FLOWING |
| `NotesTab.vue` draft cleanup | `note.id` | Passed from confirmed delete handler after `pb.delete` | Yes — real note ID | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 143 tests pass | `npx vitest run` | 13 files, 143 tests, 0 failures | PASS |
| TypeScript type-check clean | `npm run type-check` | `vue-tsc --build` exit 0, no errors | PASS |
| noteDraft.ts exports all 5 functions | `grep ^export src/lib/wallecx/noteDraft.ts` | `draftKey`, `saveDraft`, `loadDraft`, `clearDraft`, `isDraftNewer` all present | PASS |
| useAutoSave absent from ManageNote.vue | `grep useAutoSave src/components/wallecx/ManageNote.vue` | No matches | PASS |
| saveFn called only from onSave | Code reading ManageNote.vue:284 | Single call site at line 284 inside `onSave` | PASS |
| clearDraft does not appear in onDiscard | Code reading ManageNote.vue:310-319 | `onDiscard` only cancels the timer, no `clearDraft` call | PASS |
| onBeforeUnmount calls flushDraftWrite | Code reading ManageNote.vue:325-327 | `void flushDraftWrite()` called in onBeforeUnmount | PASS |
| onHide fallback present in confirm.require | Code reading ManageNote.vue:201-209 | `onHide` sets `editorContent = decryptedContent; isDecrypting = false` when `isDecrypting` is still true | PASS |
| flushDraftWrite is async, awaited in onSave | Code reading ManageNote.vue:123,278 | `async function flushDraftWrite()`, `await flushDraftWrite()` in onSave before saveFn | PASS |
| WR-03: server-id draft cleared after create | Code reading ManageNote.vue:291-293 | Three `clearDraft` calls: `oldNoteId`, `null`, `record.value.id \|\| null` | PASS |
| WR-02: isDraftNewer returns true for unparseable recordUpdated | noteDraft.ts:175 + test | `if (Number.isNaN(savedTime)) return true` present; two test cases cover empty string and non-date string | PASS |
| WR-01: saveDraft guards localStorage.setItem | noteDraft.ts:79-86 + test | try/catch around `localStorage.setItem`; quota guard test mocks `setItem` to throw and asserts resolved promise | PASS |
| Draft key uses kaheeta: prefix | noteDraft.ts:57 | `kaheeta:note-draft:<id>` / `kaheeta:note-draft:new` | PASS |
| noteDraft.test.ts asserts no plaintext on disk | noteDraft.test.ts:63-70 | `expect(raw).not.toContain(SAMPLE_TITLE)` and `.not.toContain('secret')` | PASS |

---

### Probe Execution

Step 7c: No `probe-*.sh` scripts found in this project. Skipped.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EDIT-01 | 04-02-PLAN.md | Manual save replaces auto-save — explicit Save control + dirty indicator | SATISFIED | `useAutoSave` removed; Save button with `:disabled="!isDirty \|\| isSaving"`; dirty indicator `<span aria-live="polite">`; `saveFn` called only from `onSave`. |
| EDIT-02 | 04-01-PLAN.md, 04-02-PLAN.md | Unsaved edits persisted to localStorage as encrypted per-note draft; recovered after accidental refresh/close | SATISFIED (with human check) | `noteDraft.ts` provides encrypted persistence; `scheduleDraftWrite()` debounces writes on edit; `loadDraft` + `isDraftNewer` drives recovery prompt on reopen. Last-keystroke durability within 800ms window requires human verification. |
| NOTE-04 | — | ~~Auto-save, no save button~~ Superseded by EDIT-01 | SUPERSEDED | Correctly marked `[~]` in REQUIREMENTS.md with superseded note. No auto-save code present in ManageNote.vue. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| ManageNote.vue | 109, 155, 198, 271 | `console.warn` / `console.error` in production paths | Info | Intentional diagnostic logging for silent-failure paths (draft write fail, decrypt fail, save fail). Matches existing codebase pattern. Non-blocking. |
| NotesTab.vue | 55, 87 | `console.error` in production paths | Info | Same pattern as ManageNote.vue. Non-blocking. |

No TBD/FIXME/XXX debt markers found in any modified file. No stubs, placeholders, or hardcoded empty return values found in production paths.

---

### Human Verification Required

All automated checks pass. The following items require manual browser testing to confirm the end-to-end user experience.

#### 1. EDIT-02 Last-Keystroke Durability Under Fast Close

**Test:** Open an existing note, type some text, and immediately close the dialog within about 1 second of typing (before the 800ms debounce fires). Close the browser tab or navigate away. Reopen the note.

**Expected:** The Restore/Discard prompt should appear with the most recently typed content available for restore. If the debounce had not fired yet, the prior debounce tick's content should still be present.

**Why human:** The `onBeforeUnmount` flush is `void flushDraftWrite()` — it fires an async operation that cannot be awaited in a sync lifecycle hook. Whether the async AES-GCM encrypt + localStorage.setItem completes before the browser tears down the component context is a runtime behaviour question. The REVIEW-FIX.md accepted this as "best-effort only." If the fast-close window is unacceptable, a synchronous plaintext draft (with a note to users about privacy) or a synchronous key cache would be needed. This is a product decision, not a code bug.

#### 2. Restore/Discard Prompt — Visual and Interaction Smoke

**Test:** Open a note with an existing `kaheeta:note-draft:<id>` entry in localStorage that has a `savedAt` timestamp newer than the note's `updated` field. Observe the prompt. Test all three dismissal paths: Accept (Restore), Reject (Discard), Escape key / backdrop click (onHide).

**Expected:** Header "Unsaved changes found", buttons labelled "Restore" and "Discard". Restore: editor shows draft content, isDirty indicator shows "Unsaved changes". Discard: editor shows saved content, draft removed from localStorage. Escape/backdrop: editor shows saved content, draft retained in localStorage.

**Why human:** PrimeVue ConfirmDialog rendering and keyboard interaction cannot be tested programmatically without a browser DOM.

#### 3. Draft Kept on Dialog Close With Unsaved Edits

**Test:** Edit a note (do not save), close the dialog. Confirm the "Discard changes?" confirmation from BaseMobileDialog. After closing, inspect `localStorage` in DevTools — `kaheeta:note-draft:<id>` should still be present. Reopen the note — the Restore/Discard prompt should appear.

**Expected:** Draft survives dialog close. Recovery prompt appears on next open.

**Why human:** Full round-trip (close → draft persists → reopen → prompt) requires browser interaction.

#### 4. New-Note Draft Lifecycle

**Test:** Open "New Note", type a title and body (wait ~1s for draft to write to `kaheeta:note-draft:new`). Save. Inspect localStorage — neither `kaheeta:note-draft:new` nor `kaheeta:note-draft:<server-assigned-id>` should be present. Open the newly saved note — no recovery prompt should appear.

**Expected:** All draft keys for a newly saved note are cleaned up; no spurious prompt on first open after save.

**Why human:** Timing of the WR-03 fix (three `clearDraft` calls vs. potential debounce tick) requires runtime verification.

#### 5. Draft Value Is Ciphertext in DevTools

**Test:** Edit a note and wait 1 second. Open DevTools → Application → Local Storage. Find `kaheeta:note-draft:<id>`. The value should be a JSON object with `content` (Base64 ciphertext string) and `savedAt` (ISO timestamp). No readable note text should be visible.

**Expected:** `{"content":"<Base64>","savedAt":"2026-07-01T..."}` with no plaintext title or body text.

**Why human:** The ciphertext-at-rest property is unit-tested, but end-to-end visual confirmation in DevTools is a useful security sanity check.

---

### Gaps Summary

No gaps found. All 9 observable truths are verified in the codebase. The `human_needed` status reflects 5 items that require manual browser testing to confirm end-to-end UX behaviour — none of these are expected to reveal code defects, but the last-keystroke durability question (item 1) is the one with the most architectural uncertainty and should be prioritised.

The code review fixes (CR-01/CR-02 async flush, CR-03 onHide fallback, WR-01 quota guard, WR-02 unparseable timestamp, WR-03 server-id clear, WR-04 rawContent consistency) are all present and verified in the current codebase.

---

_Verified: 2026-07-01T14:35:00Z_
_Verifier: Claude (gsd-verifier)_
