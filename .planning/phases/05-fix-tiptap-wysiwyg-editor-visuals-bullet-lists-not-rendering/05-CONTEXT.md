# Phase 5: Fix Tiptap Editor Visuals - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Visual/CSS-correctness pass over the existing Tiptap rich-text editor (`NoteEditor.vue` + `wallecx-overrides.css`). Fix three known defects — (1) bullet/numbered lists not rendering with markers/indent, (2) inconsistent formatting/spacing for headings and paragraphs, (3) the text caret not always visible — and add numbered-list support. No changes to the note data model, encryption, persistence, or the manual-save/draft flow (Phases 1–4 stay intact). The editor IS the note view; there is no separate read-only rich-text render, so this is editor styling only.

</domain>

<decisions>
## Implementation Decisions

### Root cause (confirmed during scouting)
- Tailwind v4 preflight (`@import "tailwindcss"` in `src/assets/base.css`) resets `list-style` and margins on `ul`/`ol`/`p`/headings. The editor CSS in `src/assets/wallecx-overrides.css` (lines ~252–307) styles heading sizes and links but has **no `ul`/`ol`/`li` rules and no block margins**, and sets **`caret-color` only under `.my-app-dark`**. All three bugs stem from this. The fix lives primarily in `wallecx-overrides.css`, plus one new Tiptap extension for numbered lists.

### List support (D-01)
- **Bullets + numbered + nesting.** Restore visible bullet markers and indentation for `ul`; add the **`@tiptap/extension-ordered-list`** extension plus a toolbar button (and BubbleMenu parity is optional) so numbered lists work; support nested/indented lists (`ul`/`ol` inside `li`).
- `BulletList` + `ListItem` are already registered in both `NoteEditor.vue` and `ManageNote.vue`'s `generateText` extension array — **`OrderedList` must be added to BOTH** (the `generateText` call in `ManageNote.vue` builds the plaintext snippet and must know the node type, or ordered-list content will be dropped from the snippet).

### Typography (D-02)
- **Minimal correctness.** Restore `ul`/`ol` markers + indent, heading (`h1`/`h2`/`h3`) sizes + margins, and paragraph vertical rhythm using the existing design tokens (`--color-*`). Keep it correct and consistent with the navy/amber design system. **Do NOT** add blockquote, code blocks, or horizontal rule — those are out of scope for this bugfix.

### Caret (D-03)
- **Amber accent in both themes.** Set `caret-color: var(--color-brand-accent)` on `.ProseMirror` globally (light + dark), not only under `.my-app-dark`, so the cursor is always high-contrast on both the light surface and the dark navy drawer.

### Claude's Discretion (planner/executor decide HOW)
- Exact spacing/margin values and whether list rules are global vs. `.my-app-dark`-scoped (mirror the existing heading-rules pattern: global base + dark-mode color remaps).
- Whether nested-list markers cycle (disc → circle → square) or stay uniform.
- Whether to add an ordered-list button to the BubbleMenu in addition to the main toolbar.
- How to verify visually (the earlier phases used a human-UAT checkpoint; a similar manual check in light + dark is expected since CSS rendering can't be unit-tested).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Editor + styling
- `src/components/wallecx/NoteEditor.vue` — Tiptap `useEditor` config (registered extensions, toolbar, BubbleMenu). No `<style>` block; relies on global CSS.
- `src/assets/wallecx-overrides.css` §"Notes — ProseMirror editor styles" (~lines 242–331) — the editor CSS to extend (headings, links, placeholder, dark-mode surface, caret, `.note-bubble-menu`).
- `src/assets/base.css` — `@import "tailwindcss"` (source of the preflight reset that strips list/margins).
- `src/components/wallecx/ManageNote.vue` — `generateText(...)` extension array (lines ~12–23) that must include `OrderedList` so numbered-list content survives snippet generation.

### Design tokens / theme
- `src/main.ts` — PrimeVue Aura preset customization (navy `#002244` / amber `#E89820`); `--color-brand-accent`, `--color-typo-*`, `--color-surface-*` token definitions used by the editor CSS.
- `CLAUDE.md` §"Conventions" — dark mode is `.my-app-dark` on `<html>`; `<iconify-icon>` custom element for toolbar icons; PrimeVue auto-import (no import for `<Button>`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Existing `.ProseMirror h1/h2/h3` rules and `.my-app-dark .ProseMirror` block — extend these in place rather than starting a new stylesheet.
- Toolbar button pattern in `NoteEditor.vue` (PrimeVue `<Button text rounded size="small">` + `<iconify-icon>` + `:severity` active state) — copy it for the new ordered-list button (`mdi:format-list-numbered`).
- `--color-brand-accent` token already used for the dark caret — reuse for the global caret.

### Established Patterns
- Global light-mode base rules + `.my-app-dark`-scoped color remaps is the file's convention — follow it for the new list rules.
- Extension arrays are duplicated in `NoteEditor.vue` (live editing) and `ManageNote.vue` (`generateText` for snippets) — keep them in sync when adding `OrderedList`.

### Integration Points
- `wallecx-overrides.css` is the single place editor visuals live; changes there apply everywhere the editor renders.
- `ManageNote.vue` snippet generation feeds the encrypted `snippet` field and the list preview — adding a node type there affects preview text, not stored note bodies.

</code_context>

<specifics>
## Specific Ideas

- User's three reported symptoms, verbatim: "1. Bullets not working, 2. formatting seems weird, 3. text cursor sometimes not visible" — these are the acceptance anchors.
- Numbered lists were explicitly requested as part of the fix (not just bullets).

</specifics>

<deferred>
## Deferred Ideas

- Richer block types (blockquote, code block/inline code, horizontal rule) — intentionally out of scope for this bugfix; candidate for a future editor-enhancement phase.
- Task/checkbox lists, tables, images — future phases; not part of the current editor.

</deferred>

---

*Phase: 5-fix-tiptap-editor-visuals*
*Context gathered: 2026-07-01*
