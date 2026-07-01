---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planned
last_updated: "2026-07-01T01:06:16.000Z"
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 3
  completed_plans: 2
  percent: 50
current_phase: 2
current_phase_name: Encryption Layer
---

# Project State

**Last updated:** 2026-07-01
**Current milestone:** v1 — Notes Feature

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-06-30)

**Core value:** Users can capture private, richly-formatted notes knowing the server stores only ciphertext — their content is readable only on their own device.
**Current focus:** Phase 2 — Encryption Layer (planned, ready to execute)

## Workflow State

| Stage | Status |
|-------|--------|
| Codebase map | ✓ Complete — `.planning/codebase/` |
| PROJECT.md | ✓ Complete |
| Config | ✓ Complete — YOLO / Standard / Parallel / All agents on |
| REQUIREMENTS.md | ✓ Complete — 11 v1 requirements |
| ROADMAP.md | ✓ Complete — 3 phases, 11/11 requirements mapped |
| Phase 1 | ✓ Complete — 4/4 plans, verified 5/5, code review criticals fixed |
| Phase 2 | ◐ In progress — 2/3 plans complete (02-01 crypto primitives, 02-02 key lifecycle) |
| Phase 3 | ○ Pending |

## Active Phase

**Phase 2: Encryption Layer** (in progress — 2/3 plans complete)
Goal: Every note body AND snippet is encrypted with AES-GCM (256-bit) in the browser before it is written to PocketBase, decrypted transparently on read; no second password; legacy plaintext handled lazily.

Plans:

- [x] Plan 1 (02-01) — Crypto primitives (notesCrypto.ts + tests) [Wave 1, TDD] ✓ 8 tests green, ENC-01/02/03 complete
- [x] Plan 2 (02-02) — Salt + key lifecycle (useNotesCrypto, kaheeta_user_settings) [Wave 2] ✓ composable + UserSettings type, vue-tsc clean; collection setup is an operator action tracked by the orchestrator
- [ ] Plan 3 (02-03) — Encrypt-on-write / decrypt-on-read integration [Wave 2]

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

## Next Step

Phase 2 in progress — Plans 02-01 (crypto primitives) and 02-02 (salt + key lifecycle) complete.
02-02 delivered `useNotesCrypto` (`getOrDeriveKey`/`clearKey`, module-scoped session key cache,
logout invalidation) + the `UserSettings` type; `vue-tsc` clean. Key material is `user.id`, never
the token (D-01); salt bootstraps into `kaheeta_user_settings` (D-05/D-06).
Next (Wave 2): Plan 02-03 (encrypt-on-write / decrypt-on-read integration in ManageNote/NotesTab,
lazy plaintext fallback D-10). Operator must create the `kaheeta_user_settings` collection before
any live note write/read succeeds — tracked as an operator action by the orchestrator.
ENC-01/02/03 remain In Progress until the phase verification gate passes.
Deferred Phase 1 code-review findings (7 warnings + 3 info) in `01-REVIEW.md`.
