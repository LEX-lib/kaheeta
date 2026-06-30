---
phase: 01-core-notes-crud
plan: "03"
subsystem: notes-ui
tags: [vue, pocketbase, tiptap, auto-save, crud]
dependency_graph:
  requires: [01-01, 01-02]
  provides: [NotesTab, ManageNote]
  affects: [WallecxApp.vue]
tech_stack:
  added: []
  patterns: [defineAsyncComponent, top-level-await, useAutoSave, BaseMobileDialog, instrumentedGetFullList]
key_files:
  created:
    - src/components/wallecx/NotesTab.vue
    - src/components/wallecx/ManageNote.vue
  modified: []
decisions:
  - NoteEditor wrapped in v-if="visible" guard so useEditor cleanup fires on true unmount (RESEARCH Q3)
  - flush() called in onBeforeUnmount to prevent last-keystroke data loss (Pitfall 7)
  - Object.assign(record.value, created) after first create to capture server id for subsequent saves
  - handleNoteSaved uses findIndex+splice for updates and unshift for new notes to keep list reactive
metrics:
  duration_seconds: 134
  completed_date: "2026-06-30"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 1 Plan 3: Notes List + CRUD Shell Summary

**One-liner:** NotesTab.vue renders an async-loaded sorted note list with delete confirmation; ManageNote.vue is a BaseMobileDialog create/edit wrapper with 1-second debounced auto-save, id-refresh on first create, and flush-on-unmount data-loss prevention.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | NotesTab.vue — list view | 8455db7 | src/components/wallecx/NotesTab.vue |
| 2 | ManageNote.vue — create/edit dialog | 9a83e02 | src/components/wallecx/ManageNote.vue |

## Verification Evidence

- `npx tsc --noEmit` exits 0 (both tasks)
- `npx vitest run` exits 0 — 86 tests passed across 9 test files
- NotesTab.vue contains `instrumentedGetFullList`, `kaheeta_notes`, `notes-getFullList`, `Delete note?`, `No notes yet.`, `Write your first note`
- ManageNote.vue contains `mapToUpdateNote`, `Object.assign(record.value`, `flush()`, `isNew ? 'New Note' : 'Edit Note'`, `:is-dirty`, `:is-saving`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both components wire to real PocketBase endpoints and real composables.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model. All T-03-* mitigations implemented:
- T-03-01: `user: auth.user?.id` in create payload
- T-03-02: filter `user = '${auth.user?.id ?? ''}'` in instrumentedGetFullList
- T-03-03: useConfirm two-step gate on delete
- T-03-04: 1000ms debounce accepted

## Self-Check: PASSED

- `src/components/wallecx/NotesTab.vue` — FOUND
- `src/components/wallecx/ManageNote.vue` — FOUND
- Commit 8455db7 — FOUND
- Commit 9a83e02 — FOUND
