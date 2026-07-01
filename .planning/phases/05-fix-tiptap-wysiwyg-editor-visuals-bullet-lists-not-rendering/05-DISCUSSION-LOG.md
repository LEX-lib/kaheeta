# Phase 5: Fix Tiptap Editor Visuals - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 05-fix-tiptap-editor-visuals
**Areas discussed:** List scope, Typography, Caret color

---

## List scope

| Option | Description | Selected |
|--------|-------------|----------|
| Bullets + numbered + nesting | Fix bullets, add OrderedList extension + toolbar button, support nested indent | ✓ |
| Bullets + nesting only | Fix bullets + nesting, no numbered lists (pure CSS) | |
| Bullets only | Just restore bullet markers + indentation | |

**User's choice:** Bullets + numbered + nesting
**Notes:** Only `BulletList` is registered today; numbered lists require adding `@tiptap/extension-ordered-list` to both `NoteEditor.vue` and `ManageNote.vue`'s `generateText` array.

---

## Typography

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal correctness | Restore list markers/indent, heading sizes+margins, paragraph rhythm with existing tokens; no new block types | ✓ |
| Designed prose | Above plus blockquote, code, hr, tighter rhythm | |

**User's choice:** Minimal correctness
**Notes:** Keep it a focused bugfix consistent with the navy/amber design system; blockquote/code/hr deferred.

---

## Caret color

| Option | Description | Selected |
|--------|-------------|----------|
| Amber accent, both themes | `caret-color: var(--color-brand-accent)` in light + dark | ✓ |
| Neutral, both themes | Caret follows body text color | |

**User's choice:** Amber accent, both themes
**Notes:** Currently amber is set only under `.my-app-dark`; move it to a global `.ProseMirror` rule.

## Claude's Discretion

- Exact spacing/margin values and global-vs-dark-scoped structure of the new list rules.
- Nested marker style (cycling disc/circle/square vs uniform).
- Whether to add an ordered-list button to the BubbleMenu as well as the toolbar.
- Visual verification approach (manual light+dark UAT expected — CSS can't be unit-tested).

## Deferred Ideas

- Richer block types (blockquote, code block, horizontal rule) — future editor-enhancement phase.
- Task/checkbox lists, tables, images — future phases.
