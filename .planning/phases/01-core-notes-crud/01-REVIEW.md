---
phase: 01-core-notes-crud
reviewed: 2026-06-30T12:24:03Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - src/types/wallecx/notes/types.d.ts
  - src/lib/pocketbase/notesMapper.ts
  - src/lib/pocketbase/__tests__/notesMapper.spec.ts
  - src/composables/useAutoSave.ts
  - src/composables/useAutoSave.test.ts
  - src/components/wallecx/NoteEditor.vue
  - src/components/wallecx/WallecxSkeleton.vue
  - src/components/wallecx/NotesTab.vue
  - src/components/wallecx/ManageNote.vue
  - src/components/wallecx/WallecxApp.vue
  - src/assets/wallecx-overrides.css
  - vite.config.ts
findings:
  critical: 2
  warning: 7
  info: 3
  total: 12
status: issues_found
resolved:
  - CR-01  # fixed in follow-up: discard signal + useAutoSave.cancel()
  - CR-02  # fixed in follow-up: in-flight serialization with coalesced re-run
deferred:
  - WR-01
  - WR-02
  - WR-03
  - WR-04
  - WR-05
  - WR-06
  - WR-07
  - IN-01
  - IN-02
  - IN-03
---

> **Resolution note (post-review):** Both CRITICAL findings were fixed immediately
> after this review. CR-01 — `BaseMobileDialog` now emits a `discard` event on the
> "Discard changes?" accept handler; `ManageNote` calls a new `useAutoSave.cancel()`
> and skips the `onBeforeUnmount` flush when discarded. CR-02 — `useAutoSave` now
> serializes execution with an in-flight guard and coalesces a single re-run after
> the active save settles, so the create path cannot double-fire. Two regression
> tests added (`useAutoSave.test.ts`): cancel-drops-pending and no-concurrent-save.
> All 7 WARNING and 3 INFO findings were triaged to the backlog (deferred), per the
> phase-close decision to ship Phase 1 with the core-correctness fixes only.

# Phase 1: Code Review Report

**Reviewed:** 2026-06-30T12:24:03Z
**Depth:** deep
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 1 wires a Notes CRUD feature into the Kaheeta wallet app: a `kaheeta_notes` data layer (typed `Note` + `mapToUpdateNote` write-guard), a Tiptap v3 editor (`NoteEditor.vue`), a debounced auto-save composable (`useAutoSave`), a list/CRUD shell (`NotesTab` + `ManageNote`), and nav/PWA wiring. The data-layer, mapper, skeleton, vite manifest, and `WallecxApp` tab registration are correct and follow established patterns. The Tiptap v3 migration concerns called out in RESEARCH.md (BubbleMenu `/menus` import, `setContent({ emitUpdate: false })`, Link protocol allowlist) are all handled correctly — I verified the installed `@tiptap/extension-link@3.27.1` does validate `setLink` hrefs through `isAllowedUri`, so the `javascript:` XSS vector is genuinely closed.

The defects concentrate in the **auto-save state machine and its interaction with the dialog dirty-guard**. Two of these are correctness/data-integrity BLOCKERs: (1) "Discard changes?" silently saves the discarded edit via flush-on-unmount, and (2) the auto-save path has no in-flight lock, so rapid edits on a brand-new note can fire two `create()` calls and produce a duplicate note. The remaining findings are robustness and convention gaps: an unguarded `JSON.parse`, a missing user-id guard on create, a non-functional "tap to retry" affordance, dead placeholder CSS for an extension that was never installed, and a raw-interpolated PocketBase filter that bypasses the project's `pb.filter()` binding convention.

## Critical Issues

### CR-01: "Discard changes?" still persists the edit via flush-on-unmount

**File:** `src/components/wallecx/ManageNote.vue:94-96` (with `src/components/wallecx/BaseMobileDialog.vue:49-58`)
**Issue:** `ManageNote` registers an **unconditional** `flush()` in `onBeforeUnmount`. When the user closes a dirty dialog, `BaseMobileDialog.onBeforeHide` shows a "Discard changes?" confirm; choosing **Discard** sets `visible.value = false`, which unmounts `ManageNote` and runs `onBeforeUnmount → flush()`. `flush()` executes the still-pending `saveFn`, writing the exact edit the user just chose to discard. The discard confirmation is therefore a lie — there is no code path that distinguishes "discard" from "close-and-save", because `ManageNote` has no access to the bypass decision made inside `BaseMobileDialog`. This is silent data integrity loss against an explicit user intent.

Trace: user types (`status='pending'`, debounce timer armed) → taps backdrop/Esc → `onBeforeHide` (dirty) → "Discard" → `visible=false` → `ManageNote` unmounts → `flush()` clears the timer and runs the queued `executeSave()` → record is created/updated anyway.

**Fix:** Only flush when the close was *not* a discard. Track a discard/abort flag that `flush()` respects. One option: expose a `cancel()` from `useAutoSave` that clears `pendingExecution` without running it, and have `ManageNote` listen for a discard signal from `BaseMobileDialog` (e.g. an `@discard` event emitted from the confirm `accept` handler) to call `cancel()` before unmount:
```ts
// useAutoSave.ts — add an abort that drops the pending save
function cancel() {
  if (timer !== null) { clearTimeout(timer); timer = null }
  pendingExecution = null
  status.value = 'idle'
}
return { status, trigger, flush, cancel }
```
```ts
// ManageNote.vue
let _discarded = false
function onDiscard() { _discarded = true; cancel() }
onBeforeUnmount(() => { if (!_discarded) flush() })
```
and emit `discard` from `BaseMobileDialog`'s confirm `accept` callback so the parent can react before the unmount.

### CR-02: Auto-save has no in-flight guard — rapid edits on a new note create duplicate records

**File:** `src/composables/useAutoSave.ts:23-31` and `src/components/wallecx/ManageNote.vue:75-81`
**Issue:** `useAutoSave` debounces *scheduling* but never locks *execution*. `debouncedSave()` only clears the pending timer; it does not check whether a previous `executeSave()` is still awaiting `saveFn()`. On the create path, the local `id` is only populated by `Object.assign(record.value, created)` **after** `pb.collection('kaheeta_notes').create()` resolves. If a second `trigger()` fires and its debounce elapses while the first `create()` is still in flight, `isNew.value` is still `true`, so a **second `create()`** runs — producing two notes for one logical record. `handleNoteSaved` then `unshift`s both (two `findIndex` misses), leaving two list rows.

This is specific to the new auto-save flow. The reference pattern in `ManageMembership.vue` is a manual Save button gated by `isSaving` (`:disabled="isSaving"`), which structurally cannot double-fire; auto-save reintroduced the race the manual flow avoided.

**Fix:** Serialize execution with an in-flight flag so a save cannot start while one is running, and re-check identity at execution time:
```ts
// useAutoSave.ts
let isRunning = false
const executeSave = async () => {
  if (isRunning) return            // coalesce — a later trigger will re-arm
  timer = null; pendingExecution = null; isRunning = true
  status.value = 'saving'
  try { await saveFn(); status.value = 'saved' }
  catch { status.value = 'error' }
  finally { isRunning = false }
}
```
Additionally guard the create path in `ManageNote.saveFn` so concurrent calls cannot both take the create branch (e.g. set a local `isCreating` flag the moment the create branch is entered, and treat subsequent calls as updates once an `id` is assigned).

## Warnings

### WR-01: `JSON.parse(props.note.body)` is unguarded — a malformed body crashes the dialog

**File:** `src/components/wallecx/ManageNote.vue:56-58`
**Issue:** `editorContent` is initialised with `JSON.parse(props.note.body)` directly in `<script setup>`. If `body` is ever non-JSON (truncated write, a Phase-2 encryption migration leaving ciphertext, or a manually edited PocketBase record), `JSON.parse` throws synchronously during setup, the component fails to mount, and opening that note throws inside the `<Suspense>`/dialog instead of degrading. There is no `try/catch`.
**Fix:**
```ts
const editorContent = ref<JSONContent | null>(parseBody(props.note?.body))
function parseBody(body?: string): JSONContent | null {
  if (!body) return null
  try { return JSON.parse(body) as JSONContent }
  catch (e) { console.error('ManageNote: corrupt note body', e); return null }
}
```

### WR-02: `saveFn` create path has no user-id guard (allows ownerless / failed write)

**File:** `src/components/wallecx/ManageNote.vue:76-79`
**Issue:** The create payload passes `user: auth.user?.id`, which is `string | undefined`. The established pattern in `ManageMembership.vue:287-292` explicitly guards this (`const userId = pb.authStore.record?.id; if (!userId) { toast.sessionExpired(); return }`). Here, if the session expired between dialog open and auto-save flush, `user` is sent as `undefined`; the create either fails the PocketBase `user = @request.auth.id` rule (surfacing only as a silent `status='error'` with no toast/log) or, on a mis-rule'd collection, writes an ownerless record. The mapper deliberately strips `user` to prevent spoofing, so the create branch is the only place ownership is set — it must be validated.
**Fix:** Mirror ManageMembership: read `pb.authStore.record?.id`, and if absent call `toast.sessionExpired()` and abort the save (do not POST a payload with `user: undefined`).

### WR-03: "Save failed — tap to retry" is a non-interactive `<span>` — dead affordance

**File:** `src/components/wallecx/ManageNote.vue:106` (rendered at `:135-140`)
**Issue:** On error the status text reads "Save failed — tap to retry", but it renders inside a plain `<span>` with no click handler and no retry path. The user is instructed to tap something that does nothing; the only recovery is to edit again (which re-triggers auto-save). The copy promises an affordance that does not exist.
**Fix:** Either make the indicator a real retry control (`<Button text @click="trigger()">Save failed — retry</Button>`) or change the copy to "Save failed — keep editing to retry".

### WR-04: Auto-save error swallowed without logging — inconsistent with codebase

**File:** `src/composables/useAutoSave.ts:18-20` (catch sets `status='error'`)
**Issue:** Every other failure path in this feature and the surrounding codebase logs the error (`console.error('NotesTab: delete failed', e)`, `MembershipsTab: getFullList failed`, etc.). The auto-save catch in `useAutoSave` discards the error entirely (`catch { status.value = 'error' }`), so a failing write leaves no diagnostic trace — the user sees only "Save failed" with no way to know whether it was a 403 (session), validation, or network error.
**Fix:** Surface the error to the caller for logging, e.g. accept an `onError?: (e: unknown) => void` callback, or log in the composable: `catch (e) { console.error('useAutoSave: save failed', e); status.value = 'error' }`.

### WR-05: PocketBase filter uses raw string interpolation instead of `pb.filter()` binding

**File:** `src/components/wallecx/NotesTab.vue:25`
**Issue:** `filter: \`user = '${auth.user?.id ?? ''}'\`` interpolates a value straight into a PocketBase filter string. The project's established convention for parameterised filters is `pb.filter('field = {:x}', { x })` (see `src/components/wallecx/GroupDetail.vue:192,197`), which escapes the binding. The injected value here is a server-issued auth id (alphanumeric, not user-controlled), so practical exploitability is low — but this is the only hand-built filter in the feature and it bypasses the safe-binding convention, making it a fragile precedent if the filter is ever extended with genuinely user-controlled input. Note also that the other tabs pass **no** filter at all and rely on the collection's `user = @request.auth.id` List rule for scoping; the client filter here is redundant with that rule.
**Fix:**
```ts
filter: pb.filter('user = {:uid}', { uid: auth.user?.id ?? '' }),
```

### WR-06: Placeholder CSS targets a Tiptap extension that was never installed/registered (dead style + missing feature)

**File:** `src/assets/wallecx-overrides.css:280-288` and `src/components/wallecx/NoteEditor.vue:32-50`
**Issue:** The CSS block `.ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); ... }` depends on the Tiptap **Placeholder** extension to emit the `is-editor-empty` class and `data-placeholder` attribute. `NoteEditor.vue` registers no Placeholder extension, and `@tiptap/extension-placeholder` is not in `package.json`. The rule therefore never matches: the editor shows no placeholder, and the CSS is dead. (The CSS comment even asserts "relies on Tiptap Placeholder extension" — the dependency was documented but the extension was dropped.)
**Fix:** Either install + register `@tiptap/extension-placeholder` (`Placeholder.configure({ placeholder: 'Write your note…' })`) so the styling and the intended empty-state hint work, or remove the dead placeholder CSS block to avoid implying a feature that does not exist.

### WR-07: `useAutoSave` test never exercises debounce coalescing or the actual delay

**File:** `src/composables/useAutoSave.test.ts:18-35`
**Issue:** The "after flush()" tests call `flush()` immediately, which clears the timer and runs the save synchronously — so the timer/debounce path (the composable's core behaviour) is never tested. There is no test that rapid `trigger()` calls collapse into a single `saveFn` invocation, and no test using `vi.useFakeTimers()` to assert the `delayMs` debounce actually fires once after the delay. CR-02 (no in-flight lock) and the coalescing contract are exactly the behaviours an untested timer path hides.
**Fix:** Add fake-timer tests:
```ts
vi.useFakeTimers()
const saveFn = vi.fn().mockResolvedValue(undefined)
const { trigger } = useAutoSave(saveFn, 1000)
trigger(); trigger(); trigger()
vi.advanceTimersByTime(1000)
expect(saveFn).toHaveBeenCalledTimes(1)   // coalesced
```
plus a concurrency test asserting a second trigger during an in-flight save does not double-invoke.

## Info

### IN-01: `Link.configure({ protocols: ['http','https'] })` is additive, not restrictive

**File:** `src/components/wallecx/NoteEditor.vue:43`
**Issue:** RESEARCH.md frames `protocols: ['http','https']` as a "whitelist". In `@tiptap/extension-link@3.27.1`, `isAllowedUri` always includes a built-in list (`http, https, ftp, ftps, mailto, tel, callto, sms, cid, xmpp`) and *appends* the configured protocols. So this config does not narrow the allowed set — it is effectively a no-op (those two are already allowed). The XSS protection is real (the built-in regex rejects `javascript:`/`data:` and `setLink` validates the href), but the config is not doing what the comment "XSS mitigation" implies.
**Fix:** No code change required for security. Optionally drop the redundant `protocols` arg or document that the protection comes from the extension's built-in `isAllowedUri`, not from this config.

### IN-02: `generateText` extension array omits no-op extensions but is hand-maintained and drift-prone

**File:** `src/components/wallecx/ManageNote.vue:63-67`
**Issue:** `generateText` is passed a literal array of 10 extensions that must stay in sync with the editor's schema in `NoteEditor.vue`. If a future node/mark is added to the editor but not here, snippet generation can throw "Unknown node type" or silently drop content. The list is duplicated across two files with no shared source of truth.
**Fix:** Export the shared extension array from a single module (e.g. `src/lib/wallecx/notesEditorExtensions.ts`) and import it in both `NoteEditor.vue` and `ManageNote.vue`.

### IN-03: Notes list relies on `note.id` as `:key` for optimistic new notes

**File:** `src/components/wallecx/NotesTab.vue:90` and `handleNoteSaved:63-69`
**Issue:** New notes are only added to `notes.value` via `handleNoteSaved` after the server returns an `id`, so the `:key="note.id"` is non-empty in practice. However, this is load-bearing on CR-02 being fixed: if a duplicate create occurs (CR-02), two rows with **different** server ids appear and both render — the key won't collide, so Vue won't warn, masking the duplicate. Worth a note that the list integrity depends on the create path being single-shot.
**Fix:** Resolved transitively by CR-02. No standalone change needed.

---

_Reviewed: 2026-06-30T12:24:03Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
