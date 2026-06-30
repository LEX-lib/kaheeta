# Roadmap: Kaheeta Notes

**Total phases:** 3
**Estimated completion:** 3 weeks (at 1 phase/week)
**Granularity:** Standard
**Coverage:** 11/11 v1 requirements mapped

---

## Phases

- [ ] **Phase 1: Core Notes CRUD** — Users can create, read, update, and delete richly-formatted notes from the wallet nav
- [ ] **Phase 2: Encryption Layer** — Note bodies are encrypted client-side before hitting PocketBase; decrypted transparently on read
- [ ] **Phase 3: Title Search** — Users can instantly filter their notes list by title

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
- [ ] 01-PLAN-04.md — WallecxApp.vue tab registration + vite.config.ts PWA shortcut + human-verify checkpoint

**UI hint:** yes

---

### Phase 2: Encryption Layer

**Goal:** Every note body is encrypted with AES-GCM in the browser before it is written to PocketBase, and decrypted transparently on read — the user experiences no change in workflow and the server never receives or stores plaintext.

**Depends on:** Phase 1

**Requirements:** ENC-01, ENC-02, ENC-03

**Success criteria:**
- [ ] Creating or editing a note stores an unreadable ciphertext string in the `body` field of `kaheeta_notes` (verifiable in PocketBase Admin UI)
- [ ] Opening an existing encrypted note decrypts the body in-browser and displays the original rich-text content without any user action
- [ ] The user is never prompted for a separate encryption password — key derivation is fully transparent
- [ ] Notes created before encryption (Phase 1 plaintext bodies) are handled gracefully — either migrated on first edit or detected and rendered as plaintext without crashing

**Plans:**
- [ ] Plan 1 — Crypto primitives: build `src/lib/wallecx/notesCrypto.ts` exposing `deriveKey(authToken, salt): Promise<CryptoKey>`, `encryptBody(key, json): Promise<string>` (Base64 AES-GCM ciphertext + IV), and `decryptBody(key, ciphertext): Promise<string>` — all using `window.crypto.subtle`; unit-test each primitive in `notesCrypto.test.ts`
- [ ] Plan 2 — Per-user salt + key lifecycle: add a `note_salt` field to the PocketBase `users` collection (or a separate `kaheeta_user_settings` record); on first note write, generate a random 16-byte salt, persist it, and derive the AES-GCM key via PBKDF2 from `pb.authStore.token + salt`; cache the derived `CryptoKey` in a module-scoped ref for the session so PBKDF2 runs once per login
- [ ] Plan 3 — Encrypt-on-write / decrypt-on-read integration: update `ManageNote.vue` auto-save to call `encryptBody()` before the PocketBase write; update the note load path to call `decryptBody()` after fetch; add plaintext-fallback detection (try decrypt, catch → treat as legacy plaintext); surface a `toast.error()` if decryption fails without crashing the component

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

**Plans:**
- [ ] Plan 1 — Search state + filter logic: add a `searchQuery` ref to `NotesTab.vue`, derive `filteredNotes` as a `computed()` that filters the loaded notes array by `note.title.toLowerCase().includes(query)`, and ensure the list renders `filteredNotes` rather than the raw array
- [ ] Plan 2 — Search UI: add a PrimeVue `<InputText>` with a clear button (`<Button icon="pi pi-times">`) above the notes list; debounce is not needed (client-side filter is instant); wire `v-model` to `searchQuery`; show an empty-state message when `filteredNotes.length === 0` and a query is active

**UI hint:** yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Notes CRUD | 3/4 | In progress | - |
| 2. Encryption Layer | 0/3 | Not started | - |
| 3. Title Search | 0/2 | Not started | - |

---

## Traceability

| Requirement | Description | Phase | Status |
|-------------|-------------|-------|--------|
| NOTE-01 | Create note with title and rich-text body (Tiptap) | Phase 1 | Pending |
| NOTE-02 | Open and edit an existing note | Phase 1 | Pending |
| NOTE-03 | Delete a note with confirmation dialog | Phase 1 | Pending |
| NOTE-04 | Note changes auto-save — no explicit save button | Phase 1 | Pending |
| LIST-01 | Flat list sorted by last-modified (newest first) | Phase 1 | Pending |
| LIST-02 | List item shows title, created date, plaintext preview | Phase 1 | Pending |
| NAV-01 | Notes section accessible from main wallet nav | Phase 1 | Pending |
| ENC-01 | Body encrypted client-side (AES-GCM 256-bit) before PocketBase write | Phase 2 | Pending |
| ENC-02 | Key derived from user session via PBKDF2 + per-user salt | Phase 2 | Pending |
| ENC-03 | Decryption in-browser on read — no plaintext over the wire | Phase 2 | Pending |
| LIST-03 | Title search — client-side filter, instant | Phase 3 | Pending |

**Coverage: 11/11 v1 requirements mapped. No orphans.**

---

*Roadmap created: 2026-06-30*
*Last updated: 2026-06-30 — Phase 1 planning complete (4 plans, 2 waves)*
