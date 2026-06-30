---
phase: 01-core-notes-crud
plan: "04"
subsystem: notes-nav
tags: [vue, pwa, tabs, navigation, tiptap]
dependency_graph:
  requires: [01-01, 01-02, 01-03]
  provides: [notes-tab, pwa-shortcut-open-notes]
  affects: [WallecxApp.vue, vite.config.ts]
tech_stack:
  added: []
  patterns: [defineAsyncComponent, Suspense, WallecxSkeleton, ACTION_TAB_MAP, pwa-manifest-shortcut]
key_files:
  created:
    - public/shortcuts/shortcut-open-notes.png
  modified:
    - src/components/wallecx/WallecxApp.vue
    - vite.config.ts
    - src/components/wallecx/NoteEditor.vue
    - src/assets/wallecx-overrides.css
decisions:
  - Notes tab registered after Groups; no :pending-action prop (Notes has no PWA create-on-open flow in Phase 1)
  - Suspense fallback uses WallecxSkeleton variant="note-row" (added in Plan 02)
  - PWA shortcut '/?action=open-notes' wired via ACTION_TAB_MAP 'open-notes' -> 'notes'
  - BubbleMenu chrome moved to an inner .note-bubble-menu wrapper (Tiptap v3 renders a bare positioned container; old tippy.js selectors never matched)
  - setContent switched from v2 boolean signature to v3 { emitUpdate: false } to preserve the phantom-save guard
metrics:
  completed_date: "2026-06-30"
  tasks_completed: 2
  files_created: 1
  files_modified: 4
---

# Phase 1 Plan 4: Navigation Wiring Summary

**One-liner:** The Notes feature is reachable from the wallet nav — a Notes tab (Suspense + note-row skeleton) and a `/?action=open-notes` PWA shortcut — and the editor's BubbleMenu was repaired during human verification.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | WallecxApp.vue tab + vite.config.ts shortcut + PNG | 35bd6cc | WallecxApp.vue, vite.config.ts, public/shortcuts/shortcut-open-notes.png |
| 2 | Human-verify checkpoint (10/10 approved) | — | Manual browser verification |

## Checkpoint-Driven Fixes

Human verification (Task 2) surfaced a broken BubbleMenu. Fixed in commit `9987f10`:

1. **BubbleMenu "ghostly" / mispositioned** — Tiptap v3 has no tippy.js, so the dark-only `.tiptap-bubble-menu` / `[data-tippy-content]` selectors from Plan 02 never matched. The menu rendered as bare unstyled buttons with no container box. Fix: wrapped the buttons in an inner `.note-bubble-menu` div with a full surface (light + dark), border, shadow, and `z-index`, giving it real dimensions so Floating UI positions it correctly.
2. **Tiptap v3 `setContent` signature** — `setContent(content, false)` used the v2 boolean `emitUpdate` arg; v3 expects a `SetContentOptions` object. Changed to `{ emitUpdate: false }`, preserving the phantom-save guard (Pitfall 2). Caught by `vue-tsc`; the plan's `npx tsc --noEmit` could not catch it because `tsc` does not type-check inside `.vue` files.

## Verification Evidence

- `npx vue-tsc --build` exits 0 (full Vue type-check, not just `tsc --noEmit`)
- `npx vitest run` exits 0 — 86 tests passed across 9 test files
- WallecxApp.vue contains `open-notes`, `NotesTab`, `value="notes"`, `variant="note-row"`
- vite.config.ts contains `Open Notes` and `shortcut-open-notes.png`
- public/shortcuts/shortcut-open-notes.png exists (valid PNG)
- Manual: 10/10 verification checks approved — Notes tab visible, create/edit/auto-save/delete flows work, dark mode renders correctly, BubbleMenu now shows as a solid floating toolbar anchored to the selection

## Deviations from Plan

- Plan 04 itself executed as written for Task 1. The two fixes above were not in the plan — they were discovered and resolved during the Task 2 human-verify gate (the gate working as intended).

## Known Stubs

None.

## Threat Flags

All T-04-* mitigations hold: ACTION_TAB_MAP lookup ignores unknown `?action` values (T-04-01); shortcut URL carries no user data (T-04-02); lazy chunk failure degrades to skeleton, no crash (T-04-03). No new packages installed.

## Self-Check: PASSED

- `src/components/wallecx/WallecxApp.vue` — Notes tab registered — FOUND
- `vite.config.ts` — Open Notes shortcut — FOUND
- `public/shortcuts/shortcut-open-notes.png` — FOUND
- Commit 35bd6cc — FOUND
- Commit 9987f10 (checkpoint fixes) — FOUND
