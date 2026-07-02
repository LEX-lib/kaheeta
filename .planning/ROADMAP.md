# Roadmap: Kaheeta Notes

**Total phases:** 5
**Estimated completion:** 3 weeks (at 1 phase/week)
**Granularity:** Standard
**Coverage:** 13/13 requirements mapped (v1 complete; Phases 4–5 = post-v1 enhancements)

---

## Phases

- [x] **Phase 1: Core Notes CRUD** — Users can create, read, update, and delete richly-formatted notes from the wallet nav
- [x] **Phase 2: Encryption Layer** — Note bodies are encrypted client-side before hitting PocketBase; decrypted transparently on read
- [x] **Phase 3: Title Search** — Users can instantly filter their notes list by title
- [x] **Phase 4: Manual Save with Draft Recovery** — Explicit save + local draft persistence so accidental refresh/close never loses edits (completed 2026-07-01)
- [x] **Phase 5: Fix Tiptap Editor Visuals** — Correct bullet/list rendering, consistent formatting, and always-visible text caret in the note editor (completed 2026-07-02)

---

## Phase Details

### Phase 1: Core Notes CRUD

**Goal:** Users can create, view, edit, and delete notes with a rich-text editor, see them in a list sorted by last-modified, and reach the Notes section from the main nav — all persisted to PocketBase without encryption.

**Depends on:** Nothing (first phase)

**Requirements:** NOTE-01, NOTE-02, NOTE-03, NOTE-04, LIST-01, LIST-02, NAV-01

**Success criteria:**

- [ ] User taps Notes in the main wallet nav and lands on a flat list of their notes sorted newest-first
- [ ] User creates a new note, types a title and rich-text body (bold, italic, headings, bullet list, link), and it appears in the list after saving
- [ ] User opens an existing note, edits it, and changes are auto-saved without a Save button
- [ ] User deletes a note via a confirmation dialog and the note is removed from the list
- [ ] Each list item displays the title, created date, and a plaintext preview snippet of the body

**Plans:** 4 plans

Plans:

- [x] 01-PLAN-01.md — PocketBase collection schema (user_setup) + Note type definition + notesMapper + Wave 0 tests
- [x] 01-PLAN-02.md — Tiptap v3 package install + useAutoSave composable + NoteEditor.vue + WallecxSkeleton note-row variant + CSS
- [x] 01-PLAN-03.md — NotesTab.vue (list, empty state, delete) + ManageNote.vue (create/edit, auto-save, dirty guard)
- [x] 01-PLAN-04.md — WallecxApp.vue tab registration + vite.config.ts PWA shortcut + human-verify checkpoint

**UI hint:** yes

---

### Phase 2: Encryption Layer

**Goal:** Every note body AND snippet is encrypted with AES-GCM (256-bit) in the browser before it is written to PocketBase, and decrypted transparently on read — the user experiences no change in workflow and the server never receives or stores plaintext.

**Depends on:** Phase 1

**Requirements:** ENC-01, ENC-02, ENC-03

**Success criteria:**

- [ ] Creating or editing a note stores an unreadable ciphertext string in the `body` AND `snippet` fields of `kaheeta_notes` (verifiable in PocketBase Admin UI)
- [ ] Opening an existing encrypted note decrypts the body in-browser and displays the original rich-text content without any user action
- [ ] The user is never prompted for a separate encryption password — key derivation is fully transparent
- [ ] Notes created before encryption (Phase 1 plaintext bodies) are handled gracefully — detected and rendered without crashing, then upgraded to ciphertext on next edit (lazy migration)

**Plans:** 2/3 plans executed

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Crypto primitives (Wave 1, TDD): `src/lib/wallecx/notesCrypto.ts` exposing `deriveKey(userId, salt)`, `encryptBody(key, plaintext)`, `decryptBody(key, b64)` via `window.crypto.subtle` (AES-GCM-256 + PBKDF2, per-call IV, loop-based Base64); full unit tests in `notesCrypto.test.ts`

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Per-user salt + key lifecycle (Wave 2, depends 01): `useNotesCrypto` composable derives the key from `user.id` + a 16-byte salt stored in a new `kaheeta_user_settings` collection (D-05), caches the CryptoKey module-scoped per session (D-03), clears on logout; NEVER uses the rotating token (D-01)
- [x] 02-03-PLAN.md — Encrypt-on-write / decrypt-on-read integration (Wave 2, depends 01+02): `ManageNote.vue` encrypts body+snippet before write and decrypts on load; `NotesTab.vue` decrypts list snippets; lazy plaintext fallback with `toast.error()` on failure, no crash (D-10, resolves WR-01)

---

### Phase 3: Title Search

**Goal:** Users can instantly filter the notes list by typing in a search box — results narrow in real time as they type, with no server round-trip.

**Depends on:** Phase 2

**Requirements:** LIST-03

**Success criteria:**

- [ ] A search input is visible on the Notes list view
- [ ] Typing in the search box instantly filters notes to those whose title contains the query (case-insensitive, client-side)
- [ ] Clearing the search box restores the full list
- [ ] Search operates on the already-loaded notes array — no additional PocketBase request is made

**Plans:** 1 plan

Plans:

- [x] 03-01-PLAN.md — Title search: pure `filterNotesByTitle` helper + Vitest (`src/lib/wallecx/noteSearch.ts`), then wire `searchQuery` ref, `filteredNotes` computed, PrimeVue `<InputText>` + clear `<Button>`, and a distinct no-results empty state into `NotesTab.vue`. Merged from the two ROADMAP hints — both edit the single `NotesTab.vue` file so they cannot parallelise; kept as one plan with two tightly-scoped tasks.

**UI hint:** yes

---

### Phase 4: Manual Save with Draft Recovery

**Goal:** Replace the transparent auto-save in the note editor with an explicit manual **Save** action. While a note is open, unsaved edits are continuously stashed to local/sessionStorage as a draft, so an accidental page refresh or closing the notes dialog does not lose work. On reopening a note (or the editor) with a newer local draft than the saved version, the user is offered draft recovery. Saving commits the draft to PocketBase (encrypted per Phase 2) and clears the local draft; discarding drops it.

**Depends on:** Phase 3 (and revises Phase 1 auto-save behavior)

**Requirements:** EDIT-01, EDIT-02 (EDIT-01 supersedes NOTE-04)

**Success criteria:**

- [ ] The note editor has an explicit Save control and a visible dirty/unsaved indicator; edits are NOT written to PocketBase automatically on every keystroke
- [ ] While editing, unsaved changes are persisted to local/sessionStorage (draft), keyed per note (and a "new note" draft for unsaved new notes)
- [ ] After an accidental refresh or closing the dialog without saving, reopening the note detects the local draft and offers to restore it instead of showing the last-saved content
- [ ] Clicking Save writes the current content to PocketBase (encrypted, per Phase 2) and clears the local draft; the dirty indicator resets
- [ ] Discarding/closing after a save leaves no stale draft; a note with no unsaved changes shows no recovery prompt on reopen
- [ ] Draft storage never holds plaintext beyond the device — it stays in local/sessionStorage only (consistent with the client-side-only privacy model); decide encrypted-at-rest vs. plaintext-draft during planning

**Notes / open questions for discuss-phase:**
- localStorage vs sessionStorage (survive full browser restart, or just tab refresh?) — key with `kaheeta:` prefix → **RESOLVED (D-01): localStorage**
- Whether the local draft should itself be encrypted at rest, or plaintext is acceptable for an ephemeral same-device draft → **RESOLVED (D-02): encrypted at rest, same AES key**
- Interaction with the existing `useAutoSave` composable (Phase 1) — replace or repurpose → **RESOLVED: extract focused `noteDraft.ts` module; drop `useAutoSave` from ManageNote**
- Interaction with the dirty-guard already in `ManageNote.vue` → **RESOLVED (D-04): reuse BaseMobileDialog :is-dirty/@discard; discard keeps the draft**

**UI hint:** yes

**Plans:** 2 plans

Plans:
**Wave 1**

- [ ] 04-01-PLAN.md — Pure draft module (TDD): `src/lib/wallecx/noteDraft.ts` (`draftKey`, `saveDraft`, `loadDraft`, `clearDraft`, `isDraftNewer`) encrypting drafts at rest with the shared AES key (D-01, D-02) + full Vitest coverage of the encrypt/decrypt round-trip, guarded corrupt-input read, and newer-than-saved comparison (EDIT-02)

**Wave 2** *(depends on 04-01)*

- [ ] 04-02-PLAN.md — Component wiring: rewire `ManageNote.vue` from auto-save to explicit dirty-only Save + debounced encrypted draft writes + Restore/Discard recovery prompt on reopen (D-03, D-04), and add `clearDraft` to `NotesTab.vue`'s delete path (EDIT-01 + EDIT-02). Depends on 04-01 (consumes `noteDraft.ts`); shares `ManageNote.vue` so cannot parallelise with Wave 1.

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Notes CRUD | 4/4 | Complete | 2026-06-30 |
| 2. Encryption Layer | 3/3 | Complete | 2026-07-01 |
| 3. Title Search | 1/1 | Complete | 2026-07-01 |
| 4. Manual Save with Draft Recovery | 0/2 | Planned | - |

---

## Traceability

| Requirement | Description | Phase | Status |
|-------------|-------------|-------|--------|
| NOTE-01 | Create note with title and rich-text body (Tiptap) | Phase 1 | Done |
| NOTE-02 | Open and edit an existing note | Phase 1 | Done |
| NOTE-03 | Delete a note with confirmation dialog | Phase 1 | Done |
| NOTE-04 | Note changes auto-save — no explicit save button | Phase 1 | Superseded by EDIT-01 (Phase 4) |
| LIST-01 | Flat list sorted by last-modified (newest first) | Phase 1 | Done |
| LIST-02 | List item shows title, created date, plaintext preview | Phase 1 | Done |
| NAV-01 | Notes section accessible from main wallet nav | Phase 1 | Done |
| ENC-01 | Body encrypted client-side (AES-GCM 256-bit) before PocketBase write | Phase 2 | Done |
| ENC-02 | Key derived from user session via PBKDF2 + per-user salt | Phase 2 | Done |
| ENC-03 | Decryption in-browser on read — no plaintext over the wire | Phase 2 | Done |
| LIST-03 | Title search — client-side filter, instant | Phase 3 | Done |
| EDIT-01 | Manual save replaces auto-save (explicit Save + dirty indicator) | Phase 4 | Done |
| EDIT-02 | Unsaved edits persisted to local/sessionStorage + recovered after refresh/close | Phase 4 | Done |

**Coverage: 13/13 requirements mapped. No orphans.** (NOTE-04 auto-save superseded by EDIT-01 in Phase 4.)

### Phase 5: Fix Tiptap Editor Visuals

**Goal:** The Tiptap rich-text editor renders correctly and predictably in `NoteEditor.vue` across light and dark themes. Three known defects are fixed: (1) bullet (and ordered) lists render with visible markers and correct indentation instead of appearing as plain lines; (2) inline/block formatting (headings, bold, italic, links, spacing) renders consistently rather than inheriting stray or missing styles; (3) the text caret is always visible while editing. This is a visual/CSS-correctness pass over the existing editor — no data-model or persistence changes.

**Depends on:** Phase 1 (NoteEditor.vue / Tiptap setup); does not depend on Phases 2–4.

**Requirements:** Hardens NOTE-01/NOTE-02 (rich-text body editing quality). No new functional requirement — editor-polish/bugfix phase.

**Success criteria:**

- [ ] Creating a bullet list in the editor shows visible bullet markers with correct indentation; nested lists indent; ordered lists show numbers. Renders the same on reopen.
- [ ] Headings, bold, italic, and links render with consistent, intentional styling (no unexpected margins, font inheritance, or theme bleed) in both light and dark mode.
- [ ] The text caret is visible at all times while editing, in both light and dark themes (correct `caret-color`/contrast), including on empty lines and inside list items.
- [ ] No regression: existing notes still load, edit, save, and decrypt correctly (Phases 1–4 behavior intact).

**UI hint:** yes

**Plans:** 3 plans

Plans:
**Wave 1** *(parallel — no shared files)*
- [x] 05-01-PLAN.md — OrderedList extension + numbered-list toolbar button in NoteEditor.vue; extracted snippet generation into a pure tested `noteSnippet.ts` (includes OrderedList) + Vitest round-trip; rewired ManageNote.vue [D-01]
- [x] 05-02-PLAN.md — Editor CSS in wallecx-overrides.css: list markers/indent (bullets + numbers + nesting), heading/paragraph vertical rhythm, and a global amber caret visible in both themes [D-02, D-03]

**Wave 2** *(depends on 05-01 + 05-02)*
- [x] 05-03-PLAN.md — Automated gate (vitest + type-check) then blocking human visual UAT of lists, typography, caret, and no-regression in both light and dark themes; one gap fixed (caret padding, check #4) [D-01, D-02, D-03]

**Completion:** 2026-07-02 — verified 10/10 must-haves (status passed) + human UAT 7/7 in both themes. Code review 0 blockers, 1 pre-existing warning (WR-01 dead placeholder CSS, deferred).

---

*Roadmap created: 2026-06-30*
*Last updated: 2026-07-02 — Phase 5 COMPLETE (3 plans): OrderedList + editor-visuals CSS + human UAT. All 5 phases done; v1 milestone + editor-polish shipped. NOTE: ROADMAP was restored from 6ae07a2 after the plan-phase commit (aca9b24) truncated it to 16 lines.*
