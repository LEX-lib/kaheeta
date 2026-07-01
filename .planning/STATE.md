---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: phase-pending
last_updated: "2026-07-01T04:20:00.000Z"
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 4
  completed_plans: 4
  percent: 75
current_phase: 4
current_phase_name: Manual Save with Draft Recovery
---

# Project State

**Last updated:** 2026-07-01
**Current milestone:** v1 — Notes Feature

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-06-30)

**Core value:** Users can capture private, richly-formatted notes knowing the server stores only ciphertext — their content is readable only on their own device.
**Current focus:** v1 (Phases 1–3) complete. Phase 4 (Manual Save with Draft Recovery) — CONTEXT.md captured (4 decisions locked); ready to plan. Next: `/gsd:plan-phase 4`.

## Workflow State

| Stage | Status |
|-------|--------|
| Codebase map | ✓ Complete — `.planning/codebase/` |
| PROJECT.md | ✓ Complete |
| Config | ✓ Complete — YOLO / Standard / Parallel / All agents on |
| REQUIREMENTS.md | ✓ Complete — 11 v1 requirements |
| ROADMAP.md | ✓ Complete — 3 phases, 11/11 requirements mapped |
| Phase 1 | ✓ Complete — 4/4 plans, verified 5/5, code review criticals fixed |
| Phase 2 | ✓ Complete — 3/3 plans, verified 9/9, code-review WR-01/WR-03 fixed |
| Phase 3 | ✓ Complete — 1/1 plans, verified 5/5 + human UAT 3/3, LIST-03 done |
| Phase 4 | ○ Pending — added 2026-07-01, not yet planned (EDIT-01/02, supersedes NOTE-04) |

## Active Phase

**Phase 4: Manual Save with Draft Recovery** — ◆ Context gathered (added 2026-07-01; `04-CONTEXT.md` written, ready to plan)
Goal: Replace transparent auto-save with explicit manual Save; stash unsaved edits locally so an accidental refresh or dialog close doesn't lose work, with draft recovery on reopen. Requirements: EDIT-01 (manual save, supersedes NOTE-04), EDIT-02 (draft persistence + recovery).
Locked decisions (04-CONTEXT.md): D-01 localStorage (`kaheeta:note-draft:<id>` / `:new`); D-02 draft encrypted at rest with the same AES key; D-03 Restore/Discard prompt on reopen when a newer draft exists; D-04 explicit Save (dirty-only) commits + clears draft, close keeps draft.
Next: `/gsd:plan-phase 4`.

**Phase 3: Title Search** — ✓ Complete (1/1 plans, verified 5/5 + human UAT 3/3 approved, 2026-07-01)
Goal: Users can instantly filter the notes list by typing in a search box — results narrow in real time as they type, with no server round-trip.

Plans:

- [x] Plan 1 (03-01) — Client-side title search (LIST-03) [Wave 1]: pure `filterNotesByTitle` helper (`src/lib/wallecx/noteSearch.ts` + Vitest tests), then `searchQuery` ref + `filteredNotes` computed + PrimeVue search `<InputText>` with clear button + search-specific empty state wired into `NotesTab.vue`. No new PocketBase request.

**Planning notes:** Planned directly from ROADMAP (no discuss/research/UI-SPEC — small self-contained client-side phase, user's choice). Nyquist Dimension 8 N/A (no RESEARCH.md). Two ROADMAP plan hints consolidated into one plan (both touch `NotesTab.vue`). Titles are plaintext — filter needs no decryption.

**Phase 2: Encryption Layer** — ✓ Complete (3/3 plans, verified 9/9)
Goal: Every note body AND snippet is encrypted with AES-GCM (256-bit) in the browser before it is written to PocketBase, decrypted transparently on read; no second password; legacy plaintext handled lazily.

- [x] Plan 1 (02-01) — Crypto primitives (notesCrypto.ts + tests) [Wave 1, TDD] ✓ 8 tests green
- [x] Plan 2 (02-02) — Salt + key lifecycle (useNotesCrypto, kaheeta_user_settings) [Wave 2] ✓ composable + UserSettings type
- [x] Plan 3 (02-03) — Encrypt-on-write / decrypt-on-read integration [Wave 2] ✓ 96 tests green, human-verify 4/4

**Operator setup done (Phase 2):** `kaheeta_user_settings` collection created; `kaheeta_notes.snippet` max raised 150→0 (encrypted snippet overflowed the Phase 1 cap).

**Phase 1: Core Notes CRUD** — ✓ Complete (4/4 plans, verified 5/5, code-review criticals fixed)

## Key Decisions Locked

- **Tiptap** as WYSIWYG editor (headless, JSON output, Vue 3-native)
- **AES-GCM** client-side encryption via Web Crypto API
- **PBKDF2** key derivation from user session — no second password
- **`kaheeta_notes`** PocketBase collection name
- **Flat list v1** — no folders, tags, or sharing
- **Encryption in Phase 2** — Phase 1 ships plaintext CRUD so the editor is testable before layering crypto
- **Key from `user.id`, not the auth token** (D-01) — JWTs rotate; a token-derived key would orphan all notes
- **Salt in new `kaheeta_user_settings` collection** (D-05) — not the shared `users` table
- **Encrypt snippet too** (D-09) + **lazy migration** for legacy plaintext (D-10)

## Key Decisions Added (Phase 3)

- **filteredNotes composes over sortedNotes** — sort order preserved through the filter layer
- **hasActiveQuery derived from trimmed searchQuery** — clear button visibility based on input, not result count
- **Simple flex wrapper for search bar** — clear button adjacent to InputText without nested PrimeVue compound components

## Next Step

v1 (Phases 1–3) delivered — 11/11 requirements. Phase 4 ADDED as a post-v1 enhancement:
Manual Save with Draft Recovery (EDIT-01 supersedes NOTE-04 auto-save; EDIT-02 = local/sessionStorage
draft persistence + recovery). Not yet planned. Next: `/gsd:plan-phase 4` (consider `/gsd:discuss-phase 4`
first to settle localStorage-vs-session, encrypt-draft-at-rest, and useAutoSave reuse). Chose to extend
the current milestone rather than close it + open v2.

## Accumulated Context

### Roadmap Evolution
- Phase 4 added 2026-07-01: Manual Save with Draft Recovery (EDIT-01/EDIT-02, supersedes NOTE-04). Extends v1 rather than opening a v2 milestone.

**Session:** 2026-07-01 — Planned + executed + verified Phase 3 (03-01). Commits: test RED (bb6ed8e),
feat GREEN (5fe8c3e), feat Task 2 UI (252622d), docs (ea60fff), IconField refactor (2f33283).
Human UAT 3/3 approved. LIST-03 done.
