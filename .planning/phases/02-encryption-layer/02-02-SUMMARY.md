---
phase: 02-encryption-layer
plan: "02"
subsystem: security
tags: [pbkdf2, aes-gcm, key-lifecycle, composable, pocketbase, salt, encryption]

# Dependency graph
requires:
  - phase: 02-encryption-layer
    provides: notesCrypto.ts deriveKey (PBKDF2) + uint8ToBase64 + SALT_LENGTH — the primitive this composable calls
  - phase: 01-core-notes-crud
    provides: Note type file (extended here with UserSettings), pb singleton, useAuthStore
provides:
  - "useNotesCrypto composable: getOrDeriveKey (salt bootstrap + PBKDF2 + module cache), clearKey"
  - "module-scoped session key cache (derive once per login) with logout invalidation via pb.authStore.onChange"
  - "UserSettings type mapping the kaheeta_user_settings collection (note_encryption_salt)"
  - "salt bootstrap contract: getFirstListItem/create/update against kaheeta_user_settings, 16-byte random salt (D-06)"
affects: [02-03 encrypt-on-write-decrypt-on-read]

# Tech tracking
tech-stack:
  added: []  # zero new npm packages — window.crypto.subtle + pb singleton only (D-02)
  patterns:
    - "module-scoped CryptoKey cache so PBKDF2 runs once per session, not per useNotesCrypto() call (D-03)"
    - "module-level pb.authStore.onChange registration (once at load) for logout key invalidation"
    - "key material is auth.user.id (immutable PK), never pb.authStore.token (D-01)"
    - "salt persisted server-side in a dedicated kaheeta_user_settings collection (D-05)"
    - "404 ClientResponseError from getFirstListItem distinguishes first-write (create) from real errors"

key-files:
  created:
    - src/composables/useNotesCrypto.ts
  modified:
    - src/types/wallecx/notes/types.d.ts

key-decisions:
  - "getOrCreateSalt handles three states: existing+salt (decode & return), existing+empty-salt (update), no-record/404 (create) — no duplicate records created"
  - "onChange handler registered at module scope (not inside useNotesCrypto()) so it binds exactly once regardless of how many components call the composable"
  - "salt decoded/encoded via Base64 reusing Plan 01's uint8ToBase64 (loop-based, D-08-safe) and atob for decode"

requirements-completed: []  # ENC-02 delivered by this code but phase not yet verified — left In Progress

# Metrics
duration: 8min
completed: 2026-07-01
---

# Phase 2 Plan 02: Salt + Key Lifecycle Summary

**A `useNotesCrypto` composable that bootstraps a per-user PBKDF2 salt in the new `kaheeta_user_settings` collection, derives the AES-GCM key once per session from `user.id` (never the rotating token), caches it module-scoped, and clears it on logout — delivering the transparent, no-second-password key lifecycle for ENC-02.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-07-01
- **Tasks:** 2 code tasks (plus 1 human-action setup checkpoint handled by the orchestrator)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- `useNotesCrypto.ts` owns the stateful key concerns Plan 01's pure primitives left open: where the salt lives, when PBKDF2 runs, and how the derived key is cached and invalidated.
- `getOrDeriveKey()` derives the AES-GCM key exactly once per session (module-scoped cache, D-03) and returns the cache thereafter — PBKDF2 does not re-run on subsequent saves.
- Salt bootstrap via `kaheeta_user_settings` (D-05): reads the user's record, generates a 16-byte random salt (D-06) on first use, persists it (create for a new record, update for an existing empty one), and reuses it forever after.
- Key material is `auth.user.id` (immutable PK) — the module never reads `pb.authStore.token` (D-01). Only the D-01 warning comment mentions `.token`; no code path accesses it.
- Logout invalidation: a single module-level `pb.authStore.onChange` handler clears the cached key when the auth record becomes null, so a second user on a shared browser cannot inherit the first user's key (T-02-06 mitigated).
- `UserSettings` type added to the notes types file, mapping the new collection with `user` and `note_encryption_salt`; existing `Note` / `AddNote` exports untouched.

## Task Commits

Each code task was committed atomically:

1. **Task 1: add UserSettings type** — `aec4c59` (feat) — `npx vue-tsc --build` exit 0
2. **Task 2: implement useNotesCrypto composable** — `9ccf014` (feat) — `npx vue-tsc --build` exit 0

**Plan metadata:** committed with SUMMARY.md + STATE.md + ROADMAP.md.

## Files Created/Modified
- `src/composables/useNotesCrypto.ts` — session key lifecycle: `getOrDeriveKey`, `clearKey`, private `getOrCreateSalt`, module-scoped `cachedKey`, and a module-level `onChange` logout handler. 113 lines.
- `src/types/wallecx/notes/types.d.ts` — added the `UserSettings` interface (`user`, `note_encryption_salt`) mapping `kaheeta_user_settings`.

## Decisions Made
- **Three-state salt bootstrap** — `getOrCreateSalt` distinguishes (a) existing record with a salt → decode & return, (b) existing record with empty salt → `update`, (c) no record / 404 → `create`. This avoids creating a duplicate settings record and tolerates a partially-initialised record.
- **404 discrimination** — `getFirstListItem` throws a `ClientResponseError` with `status === 404` when no record matches; that is caught as the expected first-write path, and any non-404 error is rethrown rather than silently treated as "create".
- **onChange registered at module scope** — bound exactly once at module load rather than per `useNotesCrypto()` call, so N components calling the composable don't stack N handlers.
- **Base64 helpers reused from Plan 01** — encode via `uint8ToBase64` (loop-based, D-08-safe); decode via `atob` + `charCodeAt`. `SALT_LENGTH` (16) is imported from `notesCrypto` rather than re-declared.

## Deviations from Plan

None - both code tasks executed exactly as written. The composable references `kaheeta_user_settings`, `deriveKey`, `onChange`, and `auth.user`, and contains no code that reads `.token` (the two `.token` string occurrences are in the D-01 warning comment).

## Issues Encountered
None. `npx vue-tsc --build` exited 0 after each task with no fixes required under `noUncheckedIndexedAccess`.

## Known Stubs
None. `getOrDeriveKey`, `clearKey`, and `getOrCreateSalt` are fully implemented. Runtime behavior against the live collection is exercised in Plan 02-03 integration and the phase gate.

## Threat Flags
None new. The composable's surface matches the plan's threat register:
- **T-02-06** (cached key on shared device) mitigated — `onChange` clears `cachedKey` on logout.
- **T-02-07** (key-material choice) mitigated — key derives from `auth.user.id`, never `.token`.
- **T-02-05 / T-02-08** (write scoping / salt race) depend on the collection's `user = @request.auth.id` rules and the `user` unique constraint, created via the operator setup task (see below).

## User Setup Required — OPERATOR ACTION (tracked by orchestrator)

This plan's **first task is a `checkpoint:human-action`**: the `kaheeta_user_settings` PocketBase
collection must be created by an operator in the Admin UI. **The orchestrator is handling that
setup with the user separately** — this executor did not (and cannot) create it.

The code (type + composable) and its `vue-tsc` type-check do **not** require the live collection
to exist, so both code tasks were completed and committed independently of the collection setup.

Required collection (for reference / verification):
- Name: `kaheeta_user_settings` (Base collection, kaheeta_ prefix, D-05)
- Fields: `user` — Relation to `users`, Required, Max select 1, **Unique**; `note_encryption_salt` — Text, Optional
- API rules: List / View / Create / Update all `user = @request.auth.id`; Delete rule empty
- Do NOT modify the shared `users` collection

Until the collection exists, `getOrDeriveKey()` will throw at runtime on the `kaheeta_user_settings`
read — this surfaces at Plan 02-03 integration / the phase verification gate, not at type-check.

## Next Phase Readiness
- `useNotesCrypto` is importable from `@/composables/useNotesCrypto` — Plan 02-03 (ManageNote encrypt-on-write / NotesTab decrypt-on-read) can call `getOrDeriveKey()` to obtain the session key.
- Blocker for runtime (not for the next plan's coding): the `kaheeta_user_settings` collection must exist before any live note write/read succeeds — tracked as an operator action by the orchestrator.

## Self-Check: PASSED

- FOUND: src/composables/useNotesCrypto.ts
- FOUND: src/types/wallecx/notes/types.d.ts (UserSettings added)
- FOUND: .planning/phases/02-encryption-layer/02-02-SUMMARY.md
- FOUND commit aec4c59 (feat: UserSettings type)
- FOUND commit 9ccf014 (feat: useNotesCrypto composable)
- vue-tsc --build exit 0

---
*Phase: 02-encryption-layer*
*Completed: 2026-07-01*
