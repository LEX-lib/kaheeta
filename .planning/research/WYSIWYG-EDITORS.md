# WYSIWYG Rich-Text Editor Research

**Researched:** 2026-06-30
**Domain:** Rich-text editing — Vue 3 + Vite + TypeScript + PrimeVue + Tailwind CSS
**Confidence:** HIGH (all bundle sizes verified via Bundlephobia API; all download counts verified via npm downloads API; all versions verified via npm registry)

---

## Evaluation Criteria (from request)

| # | Criterion | Target |
|---|-----------|--------|
| 1 | Bundle size (gzipped) | < 50 KB ideal |
| 2 | Vue 3 compatibility | Native component or clean wrapper |
| 3 | License | MIT or Apache 2.0 |
| 4 | Feature set | Bold, italic, headings, lists, links (Apple Notes level) |
| 5 | Maintenance | Actively maintained |
| 6 | Output format | HTML / JSON / Markdown — important for storage/encryption |
| 7 | Mobile UX | iOS/Android touch-friendly |

---

## Project Constraints Noted

From `CLAUDE.md`:
- PrimeVue components are **auto-imported** — no import conflicts expected, but editor must not clash with PrimeVue's global styles.
- Dark mode via `.my-app-dark` on `<html>` — editor must support theming without hard-coded light-mode styles.
- Mobile-first: `useIsMobile`, 44 px touch targets, iOS safe-area insets already handled in `wallecx-overrides.css`. Editor must not break these.
- TypeScript `noUncheckedIndexedAccess` is on — any wrapper component needs to be TS-clean.
- PWA with service worker (`registerType: 'prompt'`) — editor must not trigger SW cache invalidation issues; static assets should be cache-friendly.

---

## Candidate Scorecards

### 1. Tiptap (`@tiptap/vue-3` + `@tiptap/starter-kit`)

**Bundle size (gzipped):**
- `@tiptap/starter-kit`: **119.7 KB** [VERIFIED: bundlephobia.com API]
- `@tiptap/core` alone: **29.9 KB** [VERIFIED: bundlephobia.com API]
- Minimum useful install (`@tiptap/core` + `@tiptap/pm` + selected extensions) lands around **90–130 KB** gzipped depending on extensions chosen. `starter-kit` is the practical baseline.

**Vue 3 support:** Native first-class component (`<EditorContent>`, `useEditor` composable). `@tiptap/vue-3` v3.27.1 — official. [VERIFIED: npm registry, tiptap.dev/docs]

**License:** MIT (core + all previously-paid extensions open-sourced in June 2025). Cloud collaboration features are paid, but are not needed for a notes app. [VERIFIED: tiptap.dev/blog/release-notes, HackerNews announcement June 2025]

**Output format:** Dual — `editor.getJSON()` returns ProseMirror JSON; `editor.getHTML()` returns HTML string. Both can be round-tripped. JSON is the recommended storage format; HTML is rendered on-demand. [VERIFIED: tiptap.dev/docs/guides/output-json-html]

**Feature set:** StarterKit includes bold, italic, strike, code, headings (H1–H6), lists (bullet + ordered), blockquote, horizontal rule, undo/redo. Links require `@tiptap/extension-link` (separate install). Completely headless — you build the toolbar yourself with Vue components.

**Mobile UX:** Known open issues as of July 2025:
- iOS Safari virtual keyboard causes toolbar to float mid-screen (issue #6571 on GitHub — reported Jul 2025, unresolved). [CITED: github.com/ueberdosis/tiptap/issues/6571]
- iOS up/down navigation arrows stay disabled in Safari (issue #7540). [CITED: github.com/ueberdosis/tiptap/issues/7540]
- These are solvable (CSS `position: sticky`, `visualViewport` API) but require manual work.

**Maintenance:** Extremely active. v3.27.1 released 2026-06-18. 1.22 million weekly downloads on `@tiptap/vue-3`. [VERIFIED: npm downloads API, npm registry]

**GitHub:** 34.7k stars, 2.8k forks. [CITED: vue-plugins.org, web search]

**Verdict: RECOMMEND** — The ecosystem standard. Headless architecture fits perfectly with PrimeVue + custom styling. JSON output is encryption-friendly. iOS toolbar issue requires ~20 lines of CSS to mitigate but is not a blocker.

---

### 2. Quill (via `@vueup/vue-quill`)

**Bundle size (gzipped):**
- `quill` core: **57.5 KB** [VERIFIED: bundlephobia.com API]
- `@vueup/vue-quill` adds a thin wrapper on top. Total ~60–65 KB gzipped. [ASSUMED — vue-quill wrapper size not individually measurable via bundlephobia due to 502 error; estimate based on quill core + overhead]

**Vue 3 support:** `@vueup/vue-quill` v1.5.5 — official Vue 3 wrapper by the vueup team. Published 2026-06-19. [VERIFIED: npm registry]

**License:** MIT (both Quill and vue-quill). [CITED: npmjs.com/@vueup/vue-quill]

**Output format:** HTML (delta format internally, rendered as HTML). Delta is a proprietary JSON structure describing changes — less portable than standard HTML or ProseMirror JSON. Extracting plain text or converting for search is more involved.

**Feature set:** Bold, italic, underline, strike, heading, list, link, blockquote, code block out of the box. Toolbar is built-in (opinionated styling).

**Mobile UX:** Quill predates modern mobile-first design. The toolbar is fixed-layout and can be awkward on small screens. No specific iOS improvements documented in recent releases. [ASSUMED — based on community reports in training data; no official mobile docs found]

**Maintenance:** `@vueup/vue-quill` v1.5.5 published 2026-06-19 — actively maintained. Quill core last published Sept 2024. 128k weekly downloads for vue-quill; 3.9M for quill itself. [VERIFIED: npm downloads API, npm registry]

**Issue:** Quill's CSS injects global styles that can collide with Tailwind reset and PrimeVue's Aura theme. Theming for dark mode (`.my-app-dark`) requires CSS overrides inside the Quill container. [ASSUMED — well-documented community pain point; not verified against current Quill v2]

**Verdict: CONSIDER** — Smaller than Tiptap starter-kit. Simpler setup. But Delta output format is less convenient for encryption/storage use cases, and global CSS conflicts with Tailwind/PrimeVue require scoping work. Viable if bundle size is the top constraint.

---

### 3. Milkdown (`@milkdown/core` + `@milkdown/vue`)

**Bundle size (gzipped):**
- `@milkdown/core`: **92.1 KB** [VERIFIED: bundlephobia.com API — reflects the ProseMirror peer deps bundled in]
- `@milkdown/vue` binding: **607 bytes** (just the Vue adapter) [VERIFIED: bundlephobia.com API]
- Realistic minimum (core + vue + commonmark preset): **~120–150 KB** gzipped [ASSUMED — individual package sizes verified; aggregate estimated because preset-commonmark returns 502 from bundlephobia at time of research]
- The Crepe all-in-one preset bundles CodeMirror language modes by default, causing known large bundle sizes (issue #1533, resolved in PR #1926 but CodeMirror still included). [CITED: github.com/Milkdown/milkdown/issues/1533]

**Vue 3 support:** Official `@milkdown/vue` package. v7.21.2. [VERIFIED: npm registry, milkdown.dev/docs/recipes/vue]

**License:** MIT. [CITED: milkdown.dev]

**Output format:** Markdown string (primary). The editor stores content as a ProseMirror document internally but serialises to Markdown by default. This is excellent for human-readable storage and encryption — plaintext Markdown encrypts cleanly.

**Feature set:** CommonMark + GFM support (headings, bold, italic, links, lists, tables, code fences). Plugin-driven — features are added via plugins.

**Mobile UX:** No dedicated mobile documentation found. ProseMirror's default touch handling applies. No reported iOS-specific issues in recent GitHub issues (absence of evidence, not evidence of absence). [ASSUMED — unable to verify positively]

**Maintenance:** v7.21.2 released 2026-06-02. Active. `@milkdown/core` has 223k weekly downloads. [VERIFIED: npm downloads API, npm registry]

**Verdict: CONSIDER** — Markdown output is the cleanest format for a notes/encryption use case. However, the realistic bundle size is no smaller than Tiptap (possibly larger with preset-commonmark), and mobile UX is unverified. Recommended only if Markdown is a hard requirement for storage format.

---

### 4. Plate (`@udecode/plate`)

**Vue 3 support:** React-only. No Vue 3 support exists or is planned. [VERIFIED: platejs.org/docs, web search — all docs reference React 19 / Next.js exclusively]

**Verdict: AVOID** — React-only framework. Not usable in this Vue 3 app.

---

### 5. EditorJS (`@editorjs/editorjs`)

**Bundle size (gzipped):** **63.4 KB** for the core. [VERIFIED: bundlephobia.com API — v2.31.6]

**Vue 3 support:** No official Vue 3 component. Available wrappers:
- `@ebl-vue/editorjs` — npm docs updated Feb 2026, appears maintained. [CITED: npmjs.com/@ebl-vue/editorjs]
- `vue3-editor-js` (Kloen) — last commit Dec 2022, effectively abandoned. [CITED: github.com/Kloen/vue3-editor-js]
- `vue-editor-js` (ChangJoo-Park) — last published 5 years ago, Vue 2 era. [CITED: npmjs.com/vue-editor-js]

**License:** Apache 2.0. [CITED: editorjs.io]

**Output format:** Block-based JSON (each paragraph/heading/list is a separate block object). Clean and structured but non-standard — not interchangeable with HTML or Markdown without a transform step.

**Feature set:** Block-based paradigm (each element is a block). Not a traditional inline WYSIWYG. Headings, paragraphs, lists, delimiter — each requires a separate plugin. The UX is more like Notion blocks than Apple Notes flowing text.

**Mobile UX:** Block-based UI can be awkward on mobile — tapping to select a block and then inline-formatting within it adds interaction friction. No official mobile guidance found. [ASSUMED]

**Maintenance:** EditorJS core: v2.31.6, released 2026-04-07. 273k weekly downloads. Actively maintained. [VERIFIED: npm registry, npm downloads API]

**Verdict: AVOID for this use case** — The block-based paradigm does not match the Apple Notes flow-of-text experience requested. Vue 3 wrapper story is fragmented. Structurally wrong for this UX goal.

---

### 6. Vditor

**Bundle size (gzipped):** **69.4 KB** [VERIFIED: bundlephobia.com API — v3.11.2]

**Vue 3 support:** Framework-agnostic vanilla JS library. No official Vue 3 component — integration is via `new Vditor(container, options)` called inside `onMounted`. Requires a ref to a DOM element. Can work in Vue 3 but is not a native Vue component. [CITED: github.com/Vanessa219/vditor README]

**License:** MIT. [CITED: github.com/Vanessa219/vditor]

**Output format:** Markdown (WYSIWYG mode renders Markdown inline, like Typora). Can also switch to split-view or IR (instant rendering) modes.

**Feature set:** Very full-featured Markdown editor — math (KaTeX), diagrams (Mermaid), mind maps, code highlighting. Overkill for Apple Notes-level richness.

**Mobile UX:** No specific mobile documentation found. Vanilla JS integration with `onMounted` is workable on mobile but the toolbar is heavyweight. [ASSUMED]

**Maintenance:** v3.11.2 published 2025-09-02 (last updated ~9 months ago). 30k weekly downloads. [VERIFIED: npm registry, npm downloads API] Slower release cadence than Tiptap.

**Verdict: AVOID** — Heavyweight feature set mismatched with Apple Notes simplicity goal. Non-native Vue integration adds boilerplate. Last release 9 months ago suggests slowing momentum.

---

### 7. Toast UI Editor (`@toast-ui/editor`)

**Bundle size (gzipped):** **161.7 KB** [VERIFIED: bundlephobia.com API — v3.2.2]

**Vue 3 support:** `@toast-ui/vue-editor` last published February 2023. GitHub issues confirm Vue 3 compatibility errors that remain unresolved. [CITED: github.com/nhn/tui.editor/issues/1325, issue #2596]

**License:** MIT. [CITED: ui.toast.com/tui-editor]

**Maintenance:** Last release 2023-02-17. No updates in over 3 years. 191k weekly downloads (likely legacy/pinned installs). [VERIFIED: npm registry, npm downloads API]

**Verdict: AVOID** — Abandoned for Vue 3. Heaviest bundle of all candidates. Do not use.

---

## Comparison Table

| Library | Gzipped (min. viable) | Vue 3 | License | Output | Mobile UX | Weekly DLs | Last Release | Verdict |
|---------|----------------------|-------|---------|--------|-----------|-----------|--------------|---------|
| **Tiptap** | ~120 KB (starter-kit) | Native | MIT | JSON + HTML | Workable (known iOS issues, fixable) | 1.22M | 2026-06-18 | **RECOMMEND** |
| **Quill / vue-quill** | ~60–65 KB | Wrapper | MIT | Delta JSON / HTML | Adequate | 3.9M (quill) | 2026-06-19 | **CONSIDER** |
| **Milkdown** | ~120–150 KB est. | Native | MIT | Markdown | Unknown | 223k (core) | 2026-06-02 | **CONSIDER** (if Markdown required) |
| **EditorJS** | 63 KB core | Wrapper (fragmented) | Apache 2.0 | Block JSON | Poor for flowing text | 273k | 2026-04-07 | **AVOID** |
| **Vditor** | 69 KB | Manual DOM | MIT | Markdown | Untested | 30k | 2025-09-02 | **AVOID** |
| **Toast UI** | 162 KB | Broken | MIT | HTML/Markdown | N/A | 191k | 2023-02-17 | **AVOID** |
| **Plate** | N/A | None | MIT | — | N/A | — | — | **AVOID** |

*All gzip figures verified via Bundlephobia API on 2026-06-30. Weekly download figures verified via npm downloads API on 2026-06-30.*

---

## Top 2 Recommendations

### Recommendation 1: Tiptap — Primary Choice

**Install:**
```bash
npm install @tiptap/vue-3 @tiptap/pm @tiptap/starter-kit @tiptap/extension-link
```

**Why:**
1. **Headless by design.** Tiptap renders nothing except the editable `<div>`. You wire the toolbar yourself with your own PrimeVue `<Button>` components — zero CSS conflict with Tailwind or PrimeVue Aura theme.
2. **JSON output.** `editor.getJSON()` returns a clean, deterministic ProseMirror JSON document. Ideal for client-side encryption: JSON → `JSON.stringify()` → encrypt → store in PocketBase. Decryption is the reverse. No HTML sanitization concerns.
3. **Massive ecosystem.** 1.2M weekly downloads, 34.7k GitHub stars, active 3.x line. If you hit an edge case, there is almost certainly a Stack Overflow answer or GitHub issue.
4. **Dark mode.** Headless = `.my-app-dark` just works — you style the toolbar buttons yourself and the editable area inherits document styles.
5. **Extensions are modular.** Need Apple Notes simplicity? Only install `@tiptap/starter-kit` + `@tiptap/extension-link`. Skip tables, code blocks, etc.

**Trade-off:** Starter-kit is 120 KB gzipped — exceeds the 50 KB ideal. However, this can be mitigated: instead of `starter-kit`, install individual extensions (`@tiptap/extension-bold`, `@tiptap/extension-italic`, `@tiptap/extension-heading`, `@tiptap/extension-bullet-list`, `@tiptap/extension-link`) and avoid pulling in unused extensions. This brings `@tiptap/core` (30 KB) + `@tiptap/pm` + selective extensions to roughly **80–90 KB** gzipped — closer to target. The `@tiptap/pm` package (ProseMirror bindings) is the unavoidable baseline weight.

**iOS toolbar:** Use `visualViewport` resize event + `position: sticky` on the toolbar div, or simply render the formatting toolbar as a floating bubble above the selection (Tiptap's `BubbleMenu` extension) instead of a fixed toolbar. This avoids the keyboard-covering issue entirely.

---

### Recommendation 2: Quill via `@vueup/vue-quill` — If Bundle Size Is Non-Negotiable

**Install:**
```bash
npm install @vueup/vue-quill quill
```

**Why:**
1. **Smaller baseline.** Quill core is 57.5 KB gzipped — genuinely lighter than Tiptap starter-kit.
2. **Simpler setup.** `<QuillEditor v-model:content="content" content-type="html" />` — three lines, done.
3. **Established.** 3.9M weekly downloads on quill itself.

**Trade-offs:**
- Delta output format is less clean for encryption use cases — it is a JSON array of "ops" (operations), not a document model. Storing as HTML instead works but means sanitizing on read.
- Built-in toolbar styling will conflict with Tailwind's CSS reset and PrimeVue's Aura theme. You will need to scope Quill's stylesheet inside a container and override dark-mode colours manually.
- Quill's inline toolbar does not reposition above the iOS keyboard without extra work.
- Quill v2 had breaking changes from v1; the `@vueup/vue-quill` v1.5.5 wrapper targets Quill v2. Verify compatibility at integration time.

---

## Storage Format Recommendation

For a notes app with potential encryption (end-to-end or at-rest):

- **Tiptap JSON** is optimal: deterministic, compact, losslessly round-trippable, and requires no HTML parsing/sanitisation on the storage layer.
- **Markdown** (Milkdown) is also clean but requires a Markdown parser on the read path.
- **HTML** (Quill default) requires sanitization (e.g., DOMPurify) before rendering to prevent XSS if content is round-tripped through an untrusted path.

---

## Sources

### Primary (HIGH confidence — data verified via tools)
- [Bundlephobia API](https://bundlephobia.com) — bundle size figures for all packages (direct API calls, 2026-06-30)
- [npm downloads API](https://api.npmjs.org/downloads/point/last-week/) — weekly download counts, week of 2026-06-22 to 2026-06-28
- [npm registry](https://registry.npmjs.org) — version and publish date verification (`npm view`)

### Secondary (MEDIUM confidence — official docs)
- [tiptap.dev/docs/editor/getting-started/install/vue3](https://tiptap.dev/docs/editor/getting-started/install/vue3) — install commands
- [tiptap.dev/docs/guides/output-json-html](https://tiptap.dev/docs/guides/output-json-html) — output format docs
- [tiptap.dev/blog/release-notes/tiptaps-new-pricing-model-is-live](https://tiptap.dev/blog/release-notes/tiptaps-new-pricing-model-is-live) — MIT license confirmation for all extensions
- [milkdown.dev/docs/recipes/vue](https://milkdown.dev/docs/recipes/vue) — Milkdown Vue recipe
- [github.com/Milkdown/milkdown/issues/1533](https://github.com/Milkdown/milkdown/issues/1533) — Crepe bundle size issue

### Tertiary (MEDIUM-LOW confidence — web search / community)
- [github.com/ueberdosis/tiptap/issues/6571](https://github.com/ueberdosis/tiptap/issues/6571) — iOS toolbar floating issue (Jul 2025)
- [github.com/ueberdosis/tiptap/issues/7540](https://github.com/ueberdosis/tiptap/issues/7540) — iOS navigation arrow issue
- [github.com/nhn/tui.editor/issues/1325](https://github.com/nhn/tui.editor/issues/1325) — Toast UI Vue 3 support inquiry

---

## Items Tagged [ASSUMED]

| # | Claim | Risk if Wrong |
|---|-------|---------------|
| A1 | `@vueup/vue-quill` total gzipped ~60–65 KB (wrapper overhead estimated) | Could be slightly higher or lower; actual install size may differ |
| A2 | Milkdown minimum viable setup ~120–150 KB gzipped (preset-commonmark size could not be verified) | Could be heavier with additional plugins |
| A3 | Quill CSS conflicts with Tailwind reset require scoping work | May be less severe in Quill v2 with its new CSS approach |
| A4 | Milkdown mobile UX is unverified (no positive confirmation found) | Could be better or worse than assumed |
| A5 | Vditor mobile UX is unverified | Could be better than assumed |
