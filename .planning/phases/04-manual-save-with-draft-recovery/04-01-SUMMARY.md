---
phase: 04-manual-save-with-draft-recovery
plan: "01"
subsystem: notes-draft
tags: [tdd, crypto, localStorage, pure-module]
dependency_graph:
  requires: [src/lib/wallecx/notesCrypto.ts]
  provides: [src/lib/wallecx/noteDraft.ts]
  affects: []
tech_stack:
  added: []
  patterns: [encrypt-at-rest, guarded-deserialize, TDD-red-green]
key_files:
  created:
    - src/lib/wallecx/noteDraft.ts
    - src/lib/wallecx/noteDraft.test.ts
  modified: []
decisions:
  - "StoredDraft shape uses {content, savedAt} — content is AES-GCM ciphertext, never title/body directly"
  - "loadDraft catches ALL errors (outer JSON.parse AND inner decryptBody) independently, returning null on any failure (WR-03)"
  - "isDraftNewer uses Date.parse comparison; returns false for any falsy or unparseable savedAt"
metrics:
  duration_seconds: 190
  completed_date: "2026-07-01"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 4 Plan 1: noteDraft Module Summary

**One-liner:** Pure AES-GCM encrypted draft persistence helpers (draftKey / saveDraft / loadDraft / clearDraft / isDraftNewer) with full Vitest coverage under jsdom crypto.subtle.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Write failing tests for noteDraft module | fb0f867 | src/lib/wallecx/noteDraft.test.ts |
| 2 (GREEN) | Implement noteDraft.ts to pass the tests | 50286af | src/lib/wallecx/noteDraft.ts |

## What Was Built

`src/lib/wallecx/noteDraft.ts` — a pure, unit-tested draft-persistence module with five exports:

- **`draftKey(noteId)`** — derives the `kaheeta:note-draft:<id>` / `kaheeta:note-draft:new` localStorage key (D-01).
- **`saveDraft(noteId, payload, key)`** — JSON-serialises `{title, body}`, encrypts the blob via `encryptBody` (AES-GCM), writes `{content: ciphertext, savedAt: ISO}` to localStorage. Title and body are never on disk as plaintext (D-02 / T-04-01).
- **`loadDraft(noteId, key)`** — reads localStorage, guards both `JSON.parse` calls and `decryptBody` in independent try/catch blocks; returns null on any failure without ever throwing (WR-03 / T-04-02).
- **`clearDraft(noteId)`** — removes the localStorage entry; safe to call when no draft exists.
- **`isDraftNewer(savedAt, recordUpdated)`** — compares ISO timestamps via `Date.parse`; returns false for any falsy or unparseable savedAt (D-03).

`src/lib/wallecx/noteDraft.test.ts` — 26 Vitest tests covering:
- D-01 key format (4 tests — id, null, empty, undefined)
- D-02 ciphertext-at-rest controls (5 tests — including the explicit "raw value does not contain plaintext title" assertion)
- Round-trip encrypt/decrypt for title, body (JSONContent), null body, savedAt timestamp (3 tests)
- Absent/corrupt guard: missing key, garbage JSON, wrong key, non-ciphertext content, missing content field (5 tests)
- clearDraft: removes entry, no-throw on missing, clears new-note key (3 tests)
- isDraftNewer: newer/equal/older/null/undefined/empty (6 tests)

All 26 tests pass. `npm run type-check` exits 0.

## TDD Gate Compliance

- RED gate commit: `fb0f867` — `test(04-01): add failing tests for noteDraft module`
- GREEN gate commit: `50286af` — `feat(04-01): implement noteDraft.ts — pure encrypted draft persistence module`

Gate sequence respected: RED commit precedes GREEN commit in git history.

## Threat Model Coverage

| Threat | Disposition | Implementation |
|--------|-------------|----------------|
| T-04-01: Information Disclosure (draft → localStorage) | mitigated | `saveDraft` encrypts `{title,body}` blob via `encryptBody` (AES-GCM); ciphertext assertion in test confirms no plaintext on disk |
| T-04-02: Tampering (corrupt/forged draft) | mitigated | `loadDraft` guards JSON.parse + decryptBody; AES-GCM auth-tag causes decryptBody to reject tampered ciphertext → null returned |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — module is fully implemented. No placeholder values or hardcoded empty results flow to callers.

## Self-Check: PASSED

- [x] `src/lib/wallecx/noteDraft.ts` exists and exports `draftKey`, `saveDraft`, `loadDraft`, `clearDraft`, `isDraftNewer`
- [x] `src/lib/wallecx/noteDraft.test.ts` exists with 26 passing tests
- [x] RED commit `fb0f867` precedes GREEN commit `50286af` in git history
- [x] `noteDraft.ts` imports `encryptBody`/`decryptBody` from `./notesCrypto`
- [x] No `pocketbase` or `vue` import in `noteDraft.ts`
- [x] `npm run type-check` exits 0
