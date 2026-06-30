---
phase: 01-core-notes-crud
plan: "01"
subsystem: data-layer
tags: [typescript, pocketbase, mapper, tdd]
dependency_graph:
  requires: []
  provides:
    - Note TypeScript interface (src/types/wallecx/notes/types.d.ts)
    - mapToUpdateNote mapper (src/lib/pocketbase/notesMapper.ts)
    - notesMapper unit tests (src/lib/pocketbase/__tests__/notesMapper.spec.ts)
  affects:
    - All subsequent Phase 1 plans that write to kaheeta_notes
tech_stack:
  added: []
  patterns:
    - RecordModel extension pattern (mirrors memberships/types.d.ts)
    - mapToUpdateX write-guard pattern (mirrors membershipMapper.ts)
    - makeX() factory + three-describe TDD spec pattern
key_files:
  created:
    - src/types/wallecx/notes/types.d.ts
    - src/lib/pocketbase/notesMapper.ts
    - src/lib/pocketbase/__tests__/notesMapper.spec.ts
  modified: []
decisions:
  - Note.body typed as string (ProseMirror JSONContent serialized via JSON.stringify, nullable for empty notes)
  - snippet field is optional plaintext preview max 150 chars, generated at save time (not derived by mapper)
  - mapToUpdateNote returns exactly {title, body, snippet} — user field explicitly excluded to prevent ownership spoofing (T-01-02 mitigation)
metrics:
  duration: "2m 29s"
  completed_date: "2026-06-30"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 1 Plan 01: PocketBase Collection + Data Layer Summary

**One-liner:** Note TypeScript interface extending RecordModel + mapToUpdateNote write-guard that strips server-managed fields, with TDD spec proving strip/preserve/id-refresh contracts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Note type definition | a0474f0 | src/types/wallecx/notes/types.d.ts |
| 2 (RED) | notesMapper spec (failing) | 2494e86 | src/lib/pocketbase/__tests__/notesMapper.spec.ts |
| 2 (GREEN) | notesMapper implementation | 9b43bfe | src/lib/pocketbase/notesMapper.ts |

## What Was Built

**`src/types/wallecx/notes/types.d.ts`** — Note interface extending RecordModel with fields: id, created, updated, user (relation), title (max 500), body (ProseMirror JSON), snippet (plaintext preview, max 150). AddNote type omits id, created, updated.

**`src/lib/pocketbase/notesMapper.ts`** — mapToUpdateNote() accepts a full Note record and returns only `{ title, body, snippet }`. This strips id, created, updated, user, collectionId, collectionName, and expand before every PocketBase write — preventing client-side ownership spoofing (threat T-01-02).

**`src/lib/pocketbase/__tests__/notesMapper.spec.ts`** — 11 tests across three describe blocks:
1. strips server-managed fields (7 assertions: id, created, updated, user, collectionId, collectionName, expand)
2. preserves writable fields (3 assertions: title, body, snippet)
3. id-refresh contract (1 assertion: Object.assign propagates server id for subsequent PATCH)

## Verification Results

- `npx vitest run src/lib/pocketbase/__tests__/notesMapper.spec.ts` — 11/11 passed
- `npx tsc --noEmit` — exit 0, no TypeScript errors
- `Note extends RecordModel` present in types.d.ts
- `export function mapToUpdateNote(` present in notesMapper.ts
- `describe("mapToUpdateNote` present in spec (2 describe blocks)
- `id` not present in mapToUpdateNote return object

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test) | 2494e86 | Confirmed failing — mapper module not found |
| GREEN (feat) | 9b43bfe | All 11 tests pass |
| REFACTOR | N/A | No refactoring needed — mapper is minimal and clean |

## Deviations from Plan

None — plan executed exactly as written.

## User Setup Required

The `kaheeta_notes` PocketBase collection must be created manually in the PocketBase Admin UI before the app can write notes:

**Collection name:** `kaheeta_notes`

**Fields:**
- `user` — Relation to users collection, Required
- `title` — Text, Required, Max: 500
- `body` — Text (Long), Optional
- `snippet` — Text, Optional, Max: 150

**Rules (all five operations):**
- List: `user = @request.auth.id`
- View: `user = @request.auth.id`
- Create: `user = @request.auth.id`
- Update: `user = @request.auth.id`
- Delete: `user = @request.auth.id`

## Known Stubs

None — this plan creates only a type definition, a mapper, and tests. No UI components or data-fetching code.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced by this plan beyond what is documented in the plan's threat model. The mapToUpdateNote function mitigates T-01-02 (tampering via server-managed field spoofing) as required.

## Self-Check: PASSED

- src/types/wallecx/notes/types.d.ts — FOUND
- src/lib/pocketbase/notesMapper.ts — FOUND
- src/lib/pocketbase/__tests__/notesMapper.spec.ts — FOUND
- Commit a0474f0 — FOUND
- Commit 2494e86 — FOUND
- Commit 9b43bfe — FOUND
