---
phase: 02-encryption-layer
plan: "03"
subsystem: notes-encryption
tags: [vue, pocketbase, crypto, aes-gcm, integration]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [encrypted-notes-e2e]
  affects: [ManageNote.vue, NotesTab.vue, kaheeta_notes-schema]
tech_stack:
  added: []
  patterns: [encrypt-on-write, decrypt-on-read, lazy-migration-fallback, getOrDeriveKey]
key_files:
  created: []
  modified:
    - src/components/wallecx/ManageNote.vue
    - src/components/wallecx/NotesTab.vue
decisions:
  - Encrypt body AND snippet before mapToUpdateNote (D-09); key via useNotesCrypto.getOrDeriveKey (cached)
  - Decrypt-on-load in onMounted with OperationError → plaintext-JSON fallback → toast.error, never crash (D-10; removes the old synchronous unguarded JSON.parse, resolving Phase 1 WR-01)
  - NotesTab decrypts each snippet after fetch (key derived once before the map) with legacy plaintext fallback
  - "SCHEMA CHANGE (operator): kaheeta_notes.snippet max raised from 150 → 0 (unlimited). The Phase 1 field capped plaintext at 150; encrypted snippet ciphertext (AES-GCM + 12-byte IV, Base64) exceeds 150, so writes failed validation_max_text_constraint until the cap was removed. body was already editor/maxSize:0 (unaffected)."
metrics:
  completed_date: "2026-07-01"
  tasks_completed: 3
  files_created: 0
  files_modified: 2
---

# Phase 2 Plan 3: Encrypt-on-Write / Decrypt-on-Read Integration

**One-liner:** `ManageNote.vue` encrypts body+snippet before every PocketBase write and decrypts on load; `NotesTab.vue` decrypts list snippets — both with a lazy plaintext fallback for legacy Phase 1 notes. Encryption is now transparent end-to-end.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Encrypt-on-write + decrypt-on-load in ManageNote.vue | 6756806 | src/components/wallecx/ManageNote.vue |
| 2 | Decrypt snippets in NotesTab.vue list | 0069cd7 | src/components/wallecx/NotesTab.vue |
| 3 | Human-verify checkpoint (4/4 approved) | — | Manual browser + Admin UI verification |

## Verification Evidence

- `npx vue-tsc --build` exits 0; `npx vitest run` — 96/96 tests across 10 files
- ManageNote `saveFn` calls `encryptBody` for BOTH body and snippet before `mapToUpdateNote` (ENC-01, D-09)
- `onMounted` decrypts via `decryptBody` with `OperationError → plaintext-JSON fallback → toast.error`, never crashes (ENC-03, D-10; old unguarded `JSON.parse` initializer removed — WR-01 resolved)
- Key via `useNotesCrypto().getOrDeriveKey`; no `pb.authStore.token` reference in either file (D-01)
- **Human verify (4/4 approved):** no password prompt (ENC-02); `body` AND `snippet` stored as Base64 ciphertext in Admin UI (ENC-01/D-09); `kaheeta_user_settings` salt record created; transparent decrypt on reopen + readable list snippets (ENC-03); legacy plaintext note opens without crashing and re-saves as ciphertext (D-10)

## Deviations from Plan

- **Schema change discovered during verification (now required user_setup):** `kaheeta_notes.snippet` had `max: 150` from Phase 1 (sized for a plaintext preview). Encrypting the snippet (D-09) produces ciphertext longer than 150 chars → PocketBase rejected writes with `validation_max_text_constraint`. **Fix (operator, Admin UI):** raised `kaheeta_notes.snippet` max from 150 → 0 (unlimited), matching `body` (editor, maxSize 0). No code change — the plaintext is still capped at 150 via `.slice(0,150)`; only the field constraint was stale. The Phase 2 plan should have included this schema change as user_setup; captured here for verification/traceability.

## User Setup Required (cumulative for Phase 2)

1. `kaheeta_user_settings` collection created (Plan 02): fields `user` (relation→users, required, unique) + `note_encryption_salt` (text); rules `user = @request.auth.id`.
2. `kaheeta_notes.snippet` field max changed 150 → 0 (this plan) so encrypted snippets fit.

## Known Stubs

None.

## Threat Flags

Encryption now covers body + snippet at rest (server sees only ciphertext for note content). **Residual (by design):** `title` remains plaintext (max 500) — needed by LIST-02 display and Phase 3 client-side title search; a server operator can still read titles. Key derivation from `user.id` + server-stored salt is not zero-knowledge against a privileged operator (D-04, accepted tradeoff of the no-second-password constraint).

## Self-Check: PASSED

- `src/components/wallecx/ManageNote.vue` — encrypt/decrypt wired — FOUND
- `src/components/wallecx/NotesTab.vue` — snippet decrypt — FOUND
- Commits 6756806, 0069cd7 — FOUND
- 96/96 tests green; human verify 4/4 approved
