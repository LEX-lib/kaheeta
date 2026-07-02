---
phase: 05-fix-tiptap-editor-visuals
plan: "03"
subsystem: acceptance-uat
tags: [uat, human-verify, editor, lists, typography, caret]
dependency_graph:
  requires: [05-01, 05-02]
  provides: [phase-05-acceptance]
  affects: []
key_files:
  created: []
  modified: []
metrics:
  completed: "2026-07-02"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 0
---

# Phase 5 Plan 03: Human Visual UAT — Acceptance Gate

**One-liner:** Human visual UAT of the editor fixes across light and dark themes passed 7/7 after one gap fix; all four ROADMAP success criteria and decisions D-01/D-02/D-03 confirmed.

## What Was Verified

**Task 1 — Automated gate (green before human review):**
- `npx vitest run` → 149/149 tests pass (14 files, incl. new `noteSnippet.test.ts`)
- `npm run type-check` → exit 0
- Dev server served the Notes editor for manual exercise

**Task 2 — Human visual UAT (blocking checkpoint), user-approved 2026-07-02:**
All 7 checks passed in BOTH light and dark mode:
1. Bullet list — visible disc markers + indentation ✓
2. Numbered list — new toolbar button, visible `1.`/`2.` + indentation ✓
3. Nested list — indents a further level ✓
4. Caret — clearly visible (amber) on empty paragraphs, empty list items, and end of headings, in both themes ✓ (after gap fix — see below)
5. Typography — H1/H2/H3, bold, italic, link render with consistent spacing, no theme bleed ✓
6. Persistence — bullets/numbers/nesting render the same on save→close→reopen ✓
7. No regression — pre-existing notes load/decrypt/edit/save; list preview snippet still shows plaintext ✓

## Gap Found & Fixed During UAT

**UAT check #4 (first pass):** With the editor focused, the caret at column 0 sat flush against
the browser's default focus outline on the `.ProseMirror` contenteditable box and was hard to see.
Root cause: `.ProseMirror` had no inner padding. Fixed in commit (fix(05) — added
`padding: 0.5rem 0.75rem` to the base `.ProseMirror` rule so text/caret clear the box edge).
Re-tested: check #4 passes in both themes.

## Deviations from Plan

One in-scope gap fix during UAT (caret/border padding, above) — squarely within D-03 (caret
visibility). No scope expansion; blockquote/code/hr remained excluded.

## Known Stubs

None for this phase's scope. Pre-existing WR-01 (dead placeholder CSS rule; no
`@tiptap/extension-placeholder` installed) surfaced by code review — left as an out-of-scope,
non-blocking follow-up.

## Self-Check: PASSED

- All 7 UAT checks approved by user in both light and dark themes
- Automated gate green (149 tests, type-check 0) before human review
- Gap (check #4 caret padding) fixed and re-verified
