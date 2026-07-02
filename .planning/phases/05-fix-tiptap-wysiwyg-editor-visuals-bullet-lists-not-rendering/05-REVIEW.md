---
phase: 05-fix-tiptap-wysiwyg-editor-visuals-bullet-lists-not-rendering
reviewed: 2026-07-02T08:32:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/components/wallecx/NoteEditor.vue
  - src/components/wallecx/ManageNote.vue
  - src/lib/wallecx/noteSnippet.ts
  - src/lib/wallecx/noteSnippet.test.ts
  - src/assets/wallecx-overrides.css
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-07-02T08:32:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 5 adds `@tiptap/extension-ordered-list` to the editor and extracts snippet
generation into a pure `noteSnippet.ts`, plus CSS to restore list markers/indent,
heading/paragraph rhythm, and an amber caret. The core changes are correct and
low-risk. I verified each of the four focus areas:

1. **Snippet extraction correctness — no regression, and a latent fix.** The old
   inline `generateText` array was `[Document, Paragraph, Text, Bold, Italic, Heading,
   BulletList, ListItem, Link, HardBreak]`. `generateNoteSnippet` reproduces that array
   verbatim and adds `OrderedList`. For any doc without ordered-list nodes the output
   is byte-identical (same node/mark set, same `{ blockSeparator: ' ' }`, same
   `.slice(0, 150)`), so existing-note snippets are unchanged. For docs that *do*
   contain `orderedList` nodes, the old array would have thrown
   `RangeError: Unknown node type` inside `generateText` — the extraction actually
   fixes a latent crash rather than introducing a regression. The extension array is
   consistent with `NoteEditor.vue`; `History` is correctly omitted (it contributes no
   node/mark to text extraction) and `Heading.configure({ levels })` is correctly
   flattened to bare `Heading` (level config does not affect text output).

2. **No removed-import breakage in `ManageNote.vue`.** All 11 Tiptap symbol imports
   (`generateText`, `Document`…`HardBreak`) were removed and replaced by the single
   `generateNoteSnippet` import; none of them are referenced anywhere else in the file.
   `JSONContent` type import is retained (still used). `npx vitest run` on the new suite
   passes (6/6).

3. **Ordered-list toolbar wiring is correct.** `toggleOrderedList()` and
   `isActive('orderedList')` are the correct Tiptap v3 command/node names, consistent
   with the existing bullet-list button (`toggleBulletList`/`isActive('bulletList')`).
   The dependency exists in `package.json` (`^3.27.1`, matching the rest of the Tiptap suite).

4. **CSS does not leak.** `wallecx-overrides.css` is imported only from `WallecxApp.vue`,
   so its rules ship in the Kaheeta lazy chunk. The new `.ProseMirror ul/ol/li/p/a/hN`
   rules key off `.ProseMirror`, a class that exists only where a Tiptap editor is
   mounted (grep confirms the notes editor is the only ProseMirror surface), so the
   "global" light-mode rules cannot bleed onto other content. The amber caret
   (`--color-brand-accent` = `#e89820`) and link tokens (`--color-brand-primary`) are
   both defined in `base.css` for light and dark. Specificity between `.ProseMirror p`
   and `.ProseMirror li > p` resolves correctly (the latter wins, collapsing list-item
   paragraph margins as intended).

One WARNING (pre-existing dead placeholder CSS confirmed unwired) and four INFO items
follow. No blockers.

## Warnings

### WR-01: Placeholder CSS rule is dead — extension is neither imported nor installed

**File:** `src/assets/wallecx-overrides.css:329-335`
**Issue:** The rule `.ProseMirror p.is-editor-empty:first-child::before` depends on
`@tiptap/extension-placeholder`, which sets the `is-editor-empty` class and the
`data-placeholder` attribute on the first empty paragraph. That extension is **not**
registered in `NoteEditor.vue`'s `useEditor` extensions array and is **not** present in
`package.json` (grep for `placeholder` returns nothing). As a result the selector never
matches and no placeholder text ever renders — the note body opens visually empty with
no prompt. This is pre-existing (not introduced by this phase's diff), but it sits in a
file this phase edits and directly contradicts the comment on line 327-328 ("relies on
Tiptap Placeholder extension"), so it is worth resolving now while the editor visuals
are the focus.
**Fix:** Either wire the extension (preferred, since the CSS already expects it):
```ts
// package.json: add "@tiptap/extension-placeholder": "^3.27.1"
// NoteEditor.vue:
import Placeholder from '@tiptap/extension-placeholder'
// ...
extensions: [
  // ...
  Placeholder.configure({ placeholder: 'Start writing…' }),
],
```
And add `Placeholder` to `noteSnippet.ts`'s array only if snippet parity requires it
(it does not — Placeholder adds no persisted nodes). Otherwise, delete the dead rule
and its comment to avoid implying a feature that does not exist.

## Info

### IN-01: `.slice(0, 150)` can split a surrogate pair, corrupting the last emoji

**File:** `src/lib/wallecx/noteSnippet.ts:42`
**Issue:** `String.prototype.slice` counts UTF-16 code units, not code points. A snippet
truncated at exactly 150 units mid-emoji (or other astral character) yields a lone
surrogate — a broken glyph in the snippet preview. Behaviour is unchanged from the old
inline code, so this is not a regression, but it now lives in a unit-tested pure function
that would be the natural place to harden.
**Fix:** Slice on code points, e.g. `[...text].slice(0, 150).join('')`, or trim back to a
code-point boundary. Add a test with an emoji at the boundary.

### IN-02: Extension array is duplicated across `noteSnippet.ts` and `NoteEditor.vue` with no drift guard

**File:** `src/lib/wallecx/noteSnippet.ts:28-40`
**Issue:** The node/mark list is hand-copied from `NoteEditor.vue`'s `useEditor`
extensions. If a future extension that contributes text (e.g. `Blockquote`, `CodeBlock`,
`TaskList`) is added to the editor but not to `noteSnippet.ts`, snippets will silently
drop that content — or `generateText` will throw on the unknown node, exactly the class
of bug this phase fixed for `OrderedList`. Nothing in the tests or types enforces parity.
**Fix:** Export a shared `noteContentExtensions` array (the node/mark subset, excluding
`History`/`Placeholder`) from one module and consume it in both `useEditor` and
`generateNoteSnippet`, so the two can never diverge.

### IN-03: Snippet tests do not assert parity with the previous inline output or mark handling

**File:** `src/lib/wallecx/noteSnippet.test.ts`
**Issue:** The suite covers ordered/bullet lists, block separator, truncation length, and
empty docs — good coverage of the phase intent. It does not cover: (a) marks
(bold/italic/link) leaving text intact, (b) headings contributing text, or (c) that
adding `OrderedList` did not alter bullet-list output. These are the exact seams that
would catch a future regression in the extracted function.
**Fix:** Add a mixed-marks case (`bold`+`link`+`heading` in one doc) asserting the plain
text, and a nested-list case, to lock the extraction's behaviour.

### IN-04: `.ProseMirror` list/heading/caret rules are effectively global within the Kaheeta chunk

**File:** `src/assets/wallecx-overrides.css:253-320`
**Issue:** Unlike the surrounding `.wallecx-root`-scoped rules (LT-01 etc., lines 97-100),
the new `.ProseMirror` rules are unscoped. They are safe today because the notes editor is
the only ProseMirror surface and the stylesheet is chunk-local. But if a second Tiptap
editor is ever added elsewhere in the Kaheeta app (e.g. a comment box), it would silently
inherit note-editor typography (200px min-height, heading margins, disc/decimal markers).
This is a latent coupling, not a current defect.
**Fix:** No change required now. If a second editor is anticipated, scope these under a
dedicated class (e.g. `.note-editor .ProseMirror`) applied by `NoteEditor.vue`'s wrapper.

---

_Reviewed: 2026-07-02T08:32:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
