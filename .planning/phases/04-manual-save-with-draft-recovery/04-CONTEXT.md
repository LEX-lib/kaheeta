# Phase 4: Manual Save with Draft Recovery - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the note editor's transparent auto-save with an explicit **Save** action, and persist unsaved edits to the browser so an accidental refresh or dialog/window close does not lose work. On reopening a note (or the new-note editor) that has a newer local draft than the saved version, offer the user draft recovery.

**In scope:** manual Save control + dirty/unsaved indicator in `ManageNote.vue`; local draft persistence keyed per note; draft recovery prompt on reopen; clearing the draft on successful save.

**Out of scope (new capabilities → own phase):** cross-device draft sync/conflict resolution; version history / multiple drafts per note; offline queue for failed saves; changing the encryption scheme itself (Phase 2 crypto is reused as-is).

**Revises Phase 1:** EDIT-01 (manual save) supersedes NOTE-04 (auto-save, no save button).
</domain>

<decisions>
## Implementation Decisions

### Draft storage lifetime
- **D-01:** Drafts persist to **`localStorage`** (not sessionStorage) so they survive a full browser restart and an accidental tab/window close — matching the phase goal ("accidentally refreshed or exited"). Keys use the `kaheeta:` prefix: `kaheeta:note-draft:<noteId>` for existing notes and `kaheeta:note-draft:new` for an unsaved new note.

### Draft encryption at rest
- **D-02:** The local draft is **encrypted at rest** using the same AES-GCM key path as saved notes (`useNotesCrypto().getOrDeriveKey()` + `encryptBody` from `notesCrypto.ts`). No plaintext note content ever touches disk — consistent with the product's ciphertext-only privacy model. On recovery the key re-derives from `user.id` + stored salt (user is authenticated), so encrypted drafts remain recoverable after a refresh. Decrypt via `decryptBody` on restore.

### Recovery UX on reopen
- **D-03:** When opening a note (or the new-note editor) that has a **draft newer than the saved version**, show an explicit **"Unsaved changes found — Restore / Discard"** prompt before populating the editor. No silent content swap. "Restore" loads the draft into the editor (marked dirty); "Discard" deletes the draft and loads the saved version. A note with no draft (or a draft not newer than saved) opens normally with no prompt.

### Save + close behavior
- **D-04:** Explicit **Save** button, enabled only when the editor is dirty. Save encrypts + writes to PocketBase (reusing the existing `saveFn` encrypt-on-write path) and **clears the local draft** on success, resetting the dirty indicator. Closing the dialog with unsaved edits **keeps the draft** for recovery (that is the whole point) and shows a light "you have unsaved changes" confirm on close. Saved notes with no pending edits leave no stale draft.

### Claude's Discretion (planner/researcher decide HOW)
- Fate of the existing `useAutoSave` composable — repurpose its debounce + in-flight serialization (`isRunning`/`rerunRequested`) logic for **debounced writes to localStorage** on each edit (continuous local protection without excessive writes), and drop its auto-write-to-PocketBase behavior; or extract a new `useNoteDraft` composable. Planner's call.
- Exact cadence of draft writes to storage (debounced-on-edit is expected for "accidental refresh" protection).
- How "newer than saved" is determined (draft stores its own timestamp; compare against `record.updated`).
- Wiring of the dirty state into `BaseMobileDialog`'s existing `:is-dirty` / `@discard` flow (reuse, don't rebuild).
- Draft cleanup edge cases (delete draft when the note is deleted; migrate the `new` draft key to `note-draft:<id>` after first save of a new note).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` § "Phase 4: Manual Save with Draft Recovery" — goal, success criteria, open questions
- `.planning/REQUIREMENTS.md` — EDIT-01 (manual save, supersedes NOTE-04), EDIT-02 (draft persistence + recovery)

### Editor to modify
- `src/components/wallecx/ManageNote.vue` — the note editor dialog; currently wires `useAutoSave(saveFn, 1000)`, `trigger()` on title/editor edits, `flush()`/`cancel()` on unmount/discard, and `saveFn` (encrypt-on-write to PocketBase). This is the primary file the phase changes.
- `src/components/wallecx/BaseMobileDialog.vue` — provides the `:is-dirty` state and `@discard` confirmation flow to reuse for the unsaved-changes UX.
- `src/components/wallecx/NoteEditor.vue` — Tiptap editor; emits `update:model-value` on content change (the dirty trigger).

### Composables & crypto (reuse, do not reinvent)
- `src/composables/useAutoSave.ts` — existing debounce + serialized-execution logic (candidate to repurpose for debounced draft writes).
- `src/composables/useNotesCrypto.ts` — `getOrDeriveKey()` (module-scoped cached AES key from `user.id` + salt).
- `src/lib/wallecx/notesCrypto.ts` — `encryptBody` / `decryptBody` (AES-GCM, per-call IV) used to encrypt the draft at rest.

### Prior decisions to honor
- `.planning/phases/02-encryption-layer/02-CONTEXT.md` — Phase 2 crypto decisions (D-01 key from `user.id` not the rotating token; D-03 module-scoped key cache cleared on logout; D-05 salt in `kaheeta_user_settings`; D-09 encrypt snippet; D-10 lazy plaintext fallback). Draft encryption must be consistent with these.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useAutoSave.ts`: debounce (`trigger`/`flush`/`cancel`) + in-flight coalescing — repurpose for debounced draft persistence to localStorage.
- `getOrDeriveKey()` + `encryptBody`/`decryptBody`: the exact crypto path saved notes use — reuse verbatim to encrypt/decrypt the draft blob so there's no second key or scheme.
- `BaseMobileDialog` `:is-dirty` + `@discard`: existing dirty-state plumbing and discard confirmation — extend rather than replace.

### Established Patterns
- `ManageNote.vue` already separates "editor content" (`editorContent` ref, Tiptap JSON) from the persisted record and encrypts on write — the draft should serialize the same `editorContent` (+ `record.title`) shape.
- localStorage keys must use the `kaheeta:` prefix (project convention); search state elsewhere is deliberately NOT persisted, but drafts explicitly ARE (per this phase).
- `noUncheckedIndexedAccess` is on — guard JSON.parse of stored drafts (a corrupt/absent draft must not crash; mirror the existing D-10 try/catch fallback pattern).

### Integration Points
- New draft read happens at editor open (in/around the existing `onMounted` decrypt-on-load block).
- Draft write happens on edit (title `@input` / editor `update:model-value`) — the same triggers that currently call `trigger()`.
- Draft clear happens in `saveFn` success and on confirmed discard.
</code_context>

<specifics>
## Specific Ideas

- User's framing: "unsaved changes can be dumped first to local/sessionStorage until the user decides to save… beneficial if the user accidentally refreshed or exited the notes modal so they will not rewrite their notes." → localStorage + continuous draft capture + recovery on reopen (D-01, D-03, D-04).
- Privacy is a first-class concern for this product, so the draft is encrypted at rest (D-02) rather than taking the simpler plaintext route.
</specifics>

<deferred>
## Deferred Ideas

- **Cross-device / multi-tab draft conflict resolution** — what happens if the same note has a draft on device A and is edited on device B. Out of scope; this app is personal/single-device focused. Future phase if needed.
- **Version history / multiple named drafts** — only a single latest draft per note is kept. Future enhancement.
- **Offline save queue** — retrying failed PocketBase writes while offline. Separate concern from local draft recovery.
</deferred>

---

*Phase: 4-manual-save-with-draft-recovery*
*Context gathered: 2026-07-01*
