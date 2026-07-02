---
phase: 05-fix-tiptap-editor-visuals
plan: "01"
subsystem: notes-editor
tags: [tiptap, ordered-list, snippet, tdd]
dependency_graph:
  requires: []
  provides: [noteSnippet.ts, OrderedList extension in NoteEditor.vue]
  affects: [ManageNote.vue snippet generation]
tech_stack:
  added: ["@tiptap/extension-ordered-list@^3.27.1"]
  patterns: [pure-module extraction, TDD RED/GREEN]
key_files:
  created:
    - src/lib/wallecx/noteSnippet.ts
    - src/lib/wallecx/noteSnippet.test.ts
  modified:
    - package.json
    - package-lock.json
    - src/components/wallecx/NoteEditor.vue
    - src/components/wallecx/ManageNote.vue
decisions:
  - "OrderedList added after BulletList in both live editor and snippet generator to keep extension arrays in sync (D-01)"
  - "Numbered-list BubbleMenu button omitted — skipped per plan discretion to keep BubbleMenu compact"
  - "All 10 now-unused tiptap extension imports removed from ManageNote.vue after extracting to noteSnippet.ts"
metrics:
  duration: "~6 minutes"
  completed: "2026-07-02"
  tasks_completed: 2
  tests_added: 6
  tests_total: 149
---

# Phase 5 Plan 01: Add OrderedList Extension + Extract Snippet Module Summary

**One-liner:** OrderedList extension wired into NoteEditor.vue live editor + toolbar, snippet generation extracted to pure `noteSnippet.ts` module (with OrderedList) and ManageNote.vue rewired to consume it.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Install @tiptap/extension-ordered-list, add to NoteEditor.vue + numbered-list toolbar button | 62966ee | package.json, NoteEditor.vue |
| 2 (RED) | Write failing Vitest tests for generateNoteSnippet | 6b68f3d | noteSnippet.test.ts |
| 2 (GREEN) | Implement noteSnippet.ts; rewire ManageNote.vue | 9367fed | noteSnippet.ts, ManageNote.vue |

## Verification Results

- `npm run type-check`: exits 0 (clean)
- `npx vitest run`: 149/149 tests pass (143 pre-existing + 6 new noteSnippet tests)
- `grep extension-ordered-list NoteEditor.vue`: present
- `grep toggleOrderedList NoteEditor.vue`: present
- `grep format-list-numbered NoteEditor.vue`: present
- `grep extension-ordered-list noteSnippet.ts`: present
- `grep generateNoteSnippet ManageNote.vue`: present

## TDD Gate Compliance

- RED gate commit: `6b68f3d` — `test(05-01): add failing tests for generateNoteSnippet (RED)`
- GREEN gate commit: `9367fed` — `feat(05-01): extract snippet generation to noteSnippet.ts with OrderedList (GREEN)`
- Both gates present in correct order. REFACTOR not required (code is clean as written).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. First-party `@tiptap/extension-ordered-list` package (same suite, same minor as existing `@tiptap/extension-bullet-list ^3.27.1`). No new network endpoints, auth paths, or persistence changes.

## Self-Check: PASSED

Files exist:
- src/lib/wallecx/noteSnippet.ts: FOUND
- src/lib/wallecx/noteSnippet.test.ts: FOUND
- src/components/wallecx/NoteEditor.vue: FOUND (modified)
- src/components/wallecx/ManageNote.vue: FOUND (modified)

Commits exist:
- 62966ee: FOUND (feat: add OrderedList extension and numbered-list toolbar button)
- 6b68f3d: FOUND (test: add failing tests — RED)
- 9367fed: FOUND (feat: extract snippet generation to noteSnippet.ts — GREEN)
