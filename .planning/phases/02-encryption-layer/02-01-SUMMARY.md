---
phase: 02-encryption-layer
plan: "01"
subsystem: security
tags: [aes-gcm, pbkdf2, web-crypto, subtlecrypto, encryption, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-core-notes-crud
    provides: Note type (body/snippet fields) + notesMapper — the fields this crypto layer will encrypt
provides:
  - "notesCrypto.ts pure primitives: deriveKey (PBKDF2-SHA256), encryptBody/decryptBody (AES-GCM-256)"
  - "IV-prepended Base64 wire format ([12-byte IV][ciphertext+tag])"
  - "loop-based uint8ToBase64 / base64ToUint8 helpers (>65KB safe)"
  - "D-10 fallback contract: decryptBody propagates OperationError so callers own legacy-plaintext handling"
affects: [02-02 salt-and-key-lifecycle, 02-03 encrypt-on-write-decrypt-on-read]

# Tech tracking
tech-stack:
  added: []  # zero new npm packages — window.crypto.subtle is built-in (D-02)
  patterns:
    - "AES-GCM-256 with fresh per-call 12-byte IV (D-07)"
    - "PBKDF2-SHA256 200k iterations over userId+salt into a non-extractable CryptoKey"
    - "loop-based Base64 encode to avoid spread RangeError on large bodies (D-08)"
    - "crypto primitive layer with zero Vue/PocketBase coupling — unit-testable in jsdom"

key-files:
  created:
    - src/lib/wallecx/notesCrypto.ts
    - src/lib/wallecx/notesCrypto.test.ts
  modified: []

key-decisions:
  - "PBKDF2 iterations fixed at 200_000 (RESEARCH A2 balance between OWASP 2023 guidance and imperceptible first-write UX)"
  - "decryptBody deliberately does NOT try/catch — OperationError propagates so callers implement the D-10 legacy-plaintext fallback"
  - "salt passed to subtle.deriveKey cast as BufferSource to satisfy strict lib.dom typings under noUncheckedIndexedAccess"

patterns-established:
  - "Pattern: pure crypto module (no Vue/PB imports) so it tests directly against globalThis.crypto.subtle in jsdom with no mocks/polyfill"
  - "Pattern: co-located .test.ts with explicit vitest imports and a local makeKey() factory for deterministic salts"

requirements-completed: [ENC-01, ENC-02, ENC-03]

# Metrics
duration: 9min
completed: 2026-07-01
---

# Phase 2 Plan 01: Crypto Primitives Summary

**Pure AES-GCM-256 + PBKDF2-SHA256 note-encryption primitives (deriveKey/encryptBody/decryptBody) with an IV-prepended Base64 wire format, delivered test-first with zero new packages.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-07-01T08:53:00Z
- **Completed:** 2026-07-01T08:57:00Z
- **Tasks:** 3
- **Files modified:** 2 (both created)

## Accomplishments
- `notesCrypto.ts` exports `deriveKey`, `encryptBody`, `decryptBody` (plus `uint8ToBase64`/`base64ToUint8` helpers) — pure functions with no Vue or PocketBase coupling.
- Full TDD cycle: 8 failing tests written first (RED), then a minimal implementation that turns them all green (GREEN), then a clean strict type-check.
- Cryptographic contract for downstream plans locked: fresh 12-byte IV per encrypt (D-07), loop-based Base64 (D-08), AES-GCM-256 via `window.crypto.subtle` (D-02), and OperationError propagation for the D-10 lazy-migration fallback.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing crypto primitive tests** - `eb11708` (test) — verified RED for the right reason ("Failed to resolve import @/lib/wallecx/notesCrypto")
2. **Task 2 (GREEN): implement notesCrypto primitives** - `beb0b68` (feat) — all 8 tests pass
3. **Task 3: type-check** - no commit (`npx vue-tsc --build` exited 0 with no fixes required, per plan)

**Plan metadata:** committed with SUMMARY.md + STATE.md + ROADMAP.md.

## Files Created/Modified
- `src/lib/wallecx/notesCrypto.ts` - deriveKey (PBKDF2), encryptBody/decryptBody (AES-GCM), and loop-based Base64 helpers. 101 lines.
- `src/lib/wallecx/notesCrypto.test.ts` - 8 unit tests across 6 behavior groups: round-trip, ciphertext-opacity, fresh-IV, wrong-key-rejects, legacy-plaintext-rejects, >65KB round-trip, key-stability.

## Decisions Made
- **PBKDF2 iterations = 200_000** — documented inline citing OWASP 2023 (600k) vs UX-balance rationale from RESEARCH A2. The key material is a stable 15-char user.id, so iteration cost is the sole brute-force barrier.
- **`salt as BufferSource` cast** in `deriveKey` — the strict lib.dom `Pbkdf2Params.salt` typing rejected a bare `Uint8Array` in this TS config; the cast is type-only and does not use `@ts-ignore`. This is the one small adaptation beyond the RESEARCH reference snippet.
- **`decryptBody` has no try/catch** — deliberate per D-10; a test asserts a raw Phase 1 plaintext body rejects, proving callers must catch to trigger the plaintext fallback.

## Deviations from Plan

None - plan executed exactly as written. The RESEARCH Pattern 1 reference used `btoa(String.fromCharCode(...result))`; the plan explicitly mandated the loop-based `uint8ToBase64` (D-08), which is what was implemented — this is compliance with the plan, not a deviation.

## Issues Encountered
None. The `Pbkdf2Params.salt` strict typing required a `BufferSource` cast (foreseen by the plan's Task 3 note about `CryptoKey`/`Uint8Array` typing under `noUncheckedIndexedAccess`); resolved in-place with a type cast, no suppression.

## Known Stubs
None. All exports are fully implemented and exercised by passing tests.

## Threat Flags
None. The module produces the exact wire format described in the plan's threat register (T-02-01..T-02-SC); no new security surface beyond the sanctioned encrypt/decrypt path. No packages installed (T-02-SC satisfied).

## User Setup Required
None - no external service configuration required for this plan. (The `kaheeta_user_settings` collection setup belongs to Plan 02-02.)

## Next Phase Readiness
- Primitive contract (`deriveKey`, `encryptBody`, `decryptBody`) is stable and importable from `@/lib/wallecx/notesCrypto` — Plan 02-02 (salt + key lifecycle / `useNotesCrypto`) and Plan 02-03 (ManageNote/NotesTab hooks) can build against these signatures immediately.
- No blockers.

## Self-Check: PASSED

- FOUND: src/lib/wallecx/notesCrypto.ts
- FOUND: src/lib/wallecx/notesCrypto.test.ts
- FOUND: .planning/phases/02-encryption-layer/02-01-SUMMARY.md
- FOUND commit eb11708 (RED test)
- FOUND commit beb0b68 (GREEN feat)

## TDD Gate Compliance

- RED gate: `test(02-01)` commit `eb11708` present, verified failing for the right reason (missing module).
- GREEN gate: `feat(02-01)` commit `beb0b68` present after RED, all 8 tests pass.
- REFACTOR gate: none needed (implementation was already clean; type-check exited 0 with no fixes).

---
*Phase: 02-encryption-layer*
*Completed: 2026-07-01*
