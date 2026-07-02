---
phase: 05-fix-tiptap-editor-visuals
plan: "02"
subsystem: editor-css
tags: [css, prosemirror, tiptap, typography, lists, caret]
dependency_graph:
  requires: [05-01]
  provides: [editor-list-visuals, editor-heading-rhythm, editor-caret-global]
  affects: [src/assets/wallecx-overrides.css]
tech_stack:
  added: []
  patterns: [global-base + .my-app-dark-remap CSS convention, --color-* design tokens]
key_files:
  created: []
  modified:
    - src/assets/wallecx-overrides.css
decisions:
  - "List marker rules are global (light+dark) because Tailwind preflight strips them in both themes; no dark remap needed since markers inherit text color"
  - "caret-color added globally to .ProseMirror (not only .my-app-dark) per D-03; pre-existing dark rule left as harmless redundancy"
  - "Heading margins scaled h1(1.25rem/0.5rem) > h2(1rem/0.375rem) > h3(0.75rem/0.25rem) — modest values for a note editor"
  - "Nested lists indent automatically via same padding-left on inner ul/ol; no extra nesting selectors needed"
  - ".ProseMirror li > p { margin: 0 } collapses stray spacing from Tiptap ListItem paragraph node wrapper"
metrics:
  duration: "~8 minutes"
  completed: "2026-07-02"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
---

# Phase 5 Plan 02: ProseMirror Editor CSS — Lists, Spacing, and Caret

**One-liner:** Restored bullet/numbered list markers with indentation, heading/paragraph vertical rhythm, and a globally-visible amber text caret by extending wallecx-overrides.css over Tailwind v4 preflight.

## What Was Built

Two CSS tasks extending the existing ProseMirror block in `src/assets/wallecx-overrides.css`:

**Task 1 — List marker + indentation rules (commit 9f8e448):**
- `.ProseMirror ul { list-style-type: disc; padding-left: 1.5rem; }` — restores bullet markers stripped by Tailwind preflight
- `.ProseMirror ol { list-style-type: decimal; padding-left: 1.5rem; }` — restores numbered list markers
- `.ProseMirror li` small vertical margin for item legibility
- `.ProseMirror li > p { margin: 0 }` collapses stray margin from Tiptap's ListItem paragraph wrapper node
- Nested lists automatically indent a further level via the same `padding-left` applied to inner `ul`/`ol`

**Task 2 — Heading/paragraph spacing + global amber caret (commit b57aa2d):**
- `caret-color: var(--color-brand-accent)` added to the global `.ProseMirror` rule (D-03) — caret now visible in light AND dark mode
- Top/bottom margins added to `.ProseMirror h1/h2/h3` in h1 > h2 > h3 scale
- `.ProseMirror p { margin-bottom: 0.5rem }` restores paragraph rhythm
- Pre-existing `.my-app-dark .ProseMirror { caret-color: var(--color-brand-accent) }` left intact (harmless redundancy)

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed in a single file edit each.

## Known Stubs

None. These are pure CSS corrections; no data wiring or placeholder content involved.

## Threat Flags

None. This plan is pure CSS with no new attack surface (no network endpoints, no auth paths, no data flow, no new dependencies).

## Self-Check: PASSED

- `src/assets/wallecx-overrides.css` exists and contains `.ProseMirror ul`, `.ProseMirror ol`, `list-style`, `caret-color: var(--color-brand-accent)` (global), and `.ProseMirror p`
- Commits exist: 9f8e448 (Task 1), b57aa2d (Task 2)
- No blockquote/code/hr rules added (D-02 scope guard respected)
- No hardcoded hex; only `--color-*` tokens used
