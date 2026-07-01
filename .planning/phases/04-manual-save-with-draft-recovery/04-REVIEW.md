---
phase: 04-manual-save-with-draft-recovery
reviewed: 2026-07-01T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/components/wallecx/ManageNote.vue
  - src/components/wallecx/NotesTab.vue
  - src/lib/wallecx/noteDraft.ts
  - src/lib/wallecx/noteDraft.test.ts
findings:
  critical: 3
  warning: 4
  info: 3
  total: 10
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-07-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

This phase replaces transparent auto-save with explicit manual Save + encrypted
localStorage draft recovery. The pure `noteDraft.ts` helper is clean, well-guarded
against corrupt/tampered ciphertext, and thoroughly tested — the crypto-at-rest
control tests are genuinely exercised (no mocks).

However, the orchestration in `ManageNote.vue` has three correctness defects that
strike the exact concerns this phase is meant to solve: (1) the "flush on unmount"
that is supposed to persist the last keystroke is fire-and-forget async and races
the unmount, so the last edits can be lost — the opposite of the stated goal;
(2) the same async flush races `clearDraft` after a successful save, resurrecting a
draft that was just cleared; and (3) the draft-recovery confirm dialog can be
dismissed without either callback firing, leaving the editor permanently blank.
These are BLOCKERs. Several WARNINGs around unhandled localStorage quota errors and
timestamp-comparison edge cases follow.

## Critical Issues

### CR-01: `flushDraftWrite()` on unmount is fire-and-forget async — last keystroke can be lost

**File:** `src/components/wallecx/ManageNote.vue:113-120, 294-299`
**Issue:** `flushDraftWrite()` is documented as flushing "the pending debounced
draft write synchronously (for onBeforeUnmount)", but it calls
`void executeDraftWrite()`, and `executeDraftWrite()` is `async` — it `await`s
`getOrDeriveKey()` and `saveDraft()` (which itself `await`s `encryptBody`) before
ever touching `localStorage.setItem`. None of that has run by the time
`onBeforeUnmount` returns and the component (and its microtask context during a
route/dialog teardown) is gone. The whole point of EDIT-02/D-04 — persisting the
last keystroke on close so it can be recovered — is not actually achieved when the
dialog is closed. There is no synchronous write path.

**Fix:** Do a synchronous encrypt+write on unmount, or accept the pending in-memory
state must be flushed before teardown by awaiting it prior to unmount. Since Web
Crypto is inherently async, the robust option is to await the flush in the close
handlers (Save/Discard already run before unmount) and additionally guard the
unmount path. Minimum viable fix — make the intent explicit and stop pretending it
is synchronous:

```ts
// onBeforeUnmount cannot await; the only reliable persistence points are the
// explicit Save/Discard handlers. Flush there, and treat unmount as best-effort.
onBeforeUnmount(() => {
  if (draftTimer !== null) {
    clearTimeout(draftTimer)
    draftTimer = null
    // Best-effort only — see CR-01. Cannot guarantee completion before teardown.
    void executeDraftWrite()
  }
})
```
If last-keystroke durability is a hard requirement, cache the derived key
synchronously and use a synchronous serialize path, or write the plaintext-free
payload on each debounce tick (already the case) and rely on the *debounced* write
rather than the unmount flush.

### CR-02: Post-save `clearDraft` races the in-flight flushed draft write → draft resurrection

**File:** `src/components/wallecx/ManageNote.vue:253-276`
**Issue:** `onSave()` calls `flushDraftWrite()` (line 257), whose comment claims it
runs "before saving so the draft timer doesn't fire concurrently with the
PocketBase call." But `flushDraftWrite` only `clearTimeout`s and then fires
`void executeDraftWrite()` — an un-awaited async write. Execution then continues
synchronously into `await saveFn()` and, on success, `clearDraft(oldNoteId)` /
`clearDraft(null)` (lines 265-266). The flushed `executeDraftWrite()` promise
(key derivation → encrypt → `setItem`) can resolve *after* those `clearDraft`
calls, re-writing the draft that was just cleared. The user saves successfully,
yet an orphaned draft remains in localStorage and will trigger a spurious
"Unsaved changes found" recovery prompt on the next open.

**Fix:** Await the flush before saving, and only clear after both the save and the
flush have settled:

```ts
async function flushDraftWrite(): Promise<void> {
  if (draftTimer !== null) {
    clearTimeout(draftTimer)
    draftTimer = null
    await executeDraftWrite()
  }
}

async function onSave(): Promise<void> {
  if (!isDirty.value || isSaving.value) return
  await flushDraftWrite()      // ensure no write is still in flight
  isSaving.value = true
  const oldNoteId = record.value.id || null
  try {
    await saveFn()
    clearDraft(oldNoteId)
    clearDraft(null)
    isDirty.value = false
  } // ...
}
```
Note `onBeforeUnmount` cannot `await`; see CR-01 for that path.

### CR-03: Dismissing the draft-recovery confirm leaves the editor permanently blank

**File:** `src/components/wallecx/ManageNote.vue:159-204, 331`
**Issue:** When a newer draft exists, `onMounted` calls `confirm.require({...})`
and `return`s early, deliberately leaving `isDecrypting.value = true` so that the
`accept`/`reject` callbacks own the transition to `false`. PrimeVue's ConfirmDialog
can be dismissed *without* invoking either `accept` or `reject` — e.g. Escape key,
backdrop click, or an `onHide`/`reject`-not-wired dismissal depending on
configuration. If the dialog is dismissed that way, neither callback runs,
`isDecrypting` stays `true` forever, and the template guard
`v-if="visible && !isDecrypting"` (line 331) never renders `NoteEditor`. The user is
left staring at a blank, non-functional editor with no recovery path except closing
and reopening. Data (the decrypted note and the draft) is stranded in refs.

**Fix:** Wire a dismissal fallback so `isDecrypting` always resolves. Either pass
`onHide`/set `reject` on all dismissal routes, or resolve to the safe default
(saved content, keep draft) when the dialog closes without an explicit choice:

```ts
confirm.require({
  header: 'Unsaved changes found',
  // ...
  accept: () => { /* restore */ isDecrypting.value = false },
  reject: () => { /* discard */ isDecrypting.value = false },
  onHide: () => {
    // Escape/backdrop dismissal — fall back to saved content, keep the draft.
    if (isDecrypting.value) {
      editorContent.value = decryptedContent
      isDecrypting.value = false
    }
  },
})
```

## Warnings

### WR-01: `saveDraft` localStorage write is unguarded for quota / private-mode errors

**File:** `src/lib/wallecx/noteDraft.ts:69-79`
**Issue:** `saveDraft` calls `localStorage.setItem(...)` with no try/catch. In
Safari private mode `setItem` throws `QuotaExceededError` even for tiny writes, and
encrypted note bodies can be large. The only caller that guards this is
`executeDraftWrite` (ManageNote.vue:106-110), but `saveDraft` is exported as a
general-purpose helper and its own tests never cover the throwing case. A throw here
escapes as an unhandled rejection for any caller that forgets the wrapper.
**Fix:** Guard the write inside `saveDraft` (or document loudly that callers must),
so the helper degrades gracefully:

```ts
try {
  localStorage.setItem(draftKey(noteId), JSON.stringify(stored))
} catch (e) {
  // Quota exceeded / private mode — draft persistence is best-effort.
  console.warn('saveDraft: localStorage write failed', e)
}
```

### WR-02: `isDraftNewer` returns `false` when the saved record's `updated` is unparseable, discarding a valid draft

**File:** `src/lib/wallecx/noteDraft.ts:158-168`
**Issue:** The guard checks `Number.isNaN(draftTime)` but not `savedTime`. If
`recordUpdated` is empty or malformed, `Date.parse` returns `NaN`, and
`draftTime > NaN` evaluates to `false` — so a legitimately newer draft is treated
as *not* newer and silently skipped (the user's recoverable work is not offered for
restore). For existing notes `updated` is normally populated, but the function is
pure/general and the failure mode (silent draft loss) is exactly what this phase
guards against. **Fix:** treat an unparseable `recordUpdated` as "older than any
valid draft":

```ts
if (Number.isNaN(draftTime)) return false
if (Number.isNaN(savedTime)) return true // no valid saved baseline → draft wins
return draftTime > savedTime
```

### WR-03: New-note draft key not cleared under the freshly assigned server id after create

**File:** `src/components/wallecx/ManageNote.vue:233-247, 261-266`
**Issue:** When creating a new note, drafts are written under the `:new` key while
`record.value.id === ''`. After `saveFn()` creates the record, `record.value.id`
becomes the server id. `onSave` clears `oldNoteId` (which was `null` → `:new`) and
`null` (`:new`) — both correct. But the debounced `executeDraftWrite` fires with
`saveDraft(record.value.id || null, ...)`; if a debounce tick lands in the window
*after* `Object.assign(record.value, created)` sets the real id but the user keeps
typing, a new draft is written under the real-id key that `onSave` did not
anticipate clearing. Combined with CR-02's un-awaited flush, this widens the
draft-resurrection surface. **Fix:** After a successful create, also
`clearDraft(record.value.id)`, or cancel the debounce timer inside `saveFn` before
`Object.assign`.

### WR-04: `snippet` is computed from `editorContent` but `plainBody` re-stringifies separately — divergence risk / double work

**File:** `src/components/wallecx/ManageNote.vue:210-225`
**Issue:** `saveFn` builds `rawContent = editorContent.value ?? { type:'doc', content:[] }`
for snippet generation, then separately does `plainBody = JSON.stringify(editorContent.value)`.
When `editorContent.value` is `null`, `plainBody` becomes the string `"null"` (not
the empty-doc fallback used for the snippet), so the persisted body and the snippet
are derived from different representations. On reload, `JSON.parse("null")` yields
`null` → empty editor, which is acceptable, but the two code paths using different
fallbacks is a latent inconsistency. **Fix:** derive both from the same `rawContent`:

```ts
const rawContent = editorContent.value ?? { type: 'doc', content: [] }
const plainBody = JSON.stringify(rawContent)
```

## Info

### IN-01: PocketBase filter interpolates `auth.user?.id` directly into the filter string

**File:** `src/components/wallecx/NotesTab.vue:49`
**Issue:** `filter: \`user = '${auth.user?.id ?? ''}'\`` interpolates the user id
into the filter string. The value is server-controlled (auth store), so practical
injection risk is low, and this matches the existing codebase convention — but
PocketBase supports parameterized filters, which are safer and self-documenting.
**Fix:** `pb.collection('kaheeta_notes').getFullList({ filter: pb.filter('user = {:uid}', { uid: auth.user?.id ?? '' }) })` (via the instrumented wrapper's options).

### IN-02: `console.warn` / `console.error` debug artifacts left in production paths

**File:** `src/components/wallecx/ManageNote.vue:109, 155, 198, 271`; `src/components/wallecx/NotesTab.vue:55, 87`
**Issue:** Several `console.warn`/`console.error` calls remain. These are
intentional diagnostic logging for silent-failure paths (draft write, decrypt,
save) and are reasonable, but they will ship to production consoles. Confirm this
matches the project's logging policy; consider gating behind a debug flag if
console noise is a concern. Non-blocking.

### IN-03: Restore path does not schedule a draft re-write, so the restored state is not re-persisted until the next edit

**File:** `src/components/wallecx/ManageNote.vue:179-185`
**Issue:** On Restore, the code sets `record.value.title`, `editorContent.value`,
and `isDirty = true`, but does not call `scheduleDraftWrite()`. The draft already
exists in localStorage so this is fine functionally; noting for completeness that
the restored content relies on the pre-existing draft entry until the user makes a
further edit (which re-arms the debounce). No action required unless the restore
flow is expected to refresh `savedAt`.

---

_Reviewed: 2026-07-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
