---
status: partial
phase: 04-manual-save-with-draft-recovery
source: [04-VERIFICATION.md]
started: "2026-07-01T14:40:00Z"
updated: "2026-07-01T14:40:00Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. EDIT-02 last-keystroke durability under fast close
expected: Editing a note and immediately closing the dialog (within ~800ms of the last keystroke, before the debounce fires) should still persist the draft so it is recoverable on next open. This is the one item with a known theoretical gap: the onBeforeUnmount flush is best-effort (Web Crypto AES-GCM cannot encrypt synchronously). Confirm whether the best-effort flush completes in practice, or whether the ~800ms window is a real durability gap.
result: [pending]

### 2. Restore/Discard prompt — visual and interaction smoke test
expected: Opening a note that has a newer encrypted localStorage draft shows a PrimeVue ConfirmDialog (header "Unsaved changes found", Accept "Restore", Reject "Discard"). Restore populates the editor with draft content and marks it dirty; Discard loads the saved version; Escape/backdrop dismissal falls back to saved content and keeps the draft.
result: [pending]

### 3. Draft is kept (not cleared) when closing dialog with unsaved edits
expected: Edit a note, do NOT save, close the dialog. After closing, localStorage still contains the draft under `kaheeta:note-draft:<id>`. Reopening the note triggers the Restore/Discard prompt.
result: [pending]

### 4. New-note draft lifecycle: save clears :new key, no spurious prompt on reopen
expected: Create a new note, type content (draft goes to `kaheeta:note-draft:new`), Save. After save, localStorage has no `kaheeta:note-draft:new` and no `kaheeta:note-draft:<new-id>` entry. Opening the newly created note shows no recovery prompt.
result: [pending]

### 5. Draft value in localStorage is ciphertext, not readable plaintext
expected: After editing a note, inspect localStorage in DevTools. The value under `kaheeta:note-draft:<id>` is a JSON object with a `content` field containing Base64 ciphertext and a `savedAt` field, with NO `title`/`body` fields. The content is not readable note text.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
