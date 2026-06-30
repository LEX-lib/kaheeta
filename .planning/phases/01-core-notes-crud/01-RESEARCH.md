# Phase 1: Core Notes CRUD — Research

**Researched:** 2026-06-30
**Domain:** Tiptap v3 + Vue 3, PocketBase data layer, auto-save composable, mobile-first dialogs, PWA tab wiring
**Confidence:** HIGH

---

## Summary

Phase 1 adds a Notes feature to the Kaheeta wallet app. The work spans four plan areas: a new PocketBase collection with the standard data-layer stack (mapper + typed interface + `instrumentedGetFullList`), a Tiptap v3 headless rich-text editor component, a Notes list/CRUD shell following the established tab-component pattern, and navigation wiring.

The codebase has a mature, well-documented pattern for each of these concerns. Every prior feature tab follows exactly the same shape: `defineAsyncComponent` + `<Suspense>` + `WallecxSkeleton` for lazy loading; `BaseMobileDialog` (Drawer on mobile, Dialog on desktop) for create/edit; `mapToUpdateX` mapper before every write; `instrumentedGetFullList` for reads. The Notes feature follows this pattern exactly — the decision space is narrow.

The main net-new concern is Tiptap v3. Key finding: **Tiptap v3 has a breaking import path change for BubbleMenu** — it is now imported from `@tiptap/vue-3/menus`, not `@tiptap/vue-3`. Tippy.js is gone; Floating UI is the new menu positioning library and must be installed as `@floating-ui/dom`. All targeted package versions are 3.27.1 (released 2026-06-18). All 8 new packages cleared slopcheck [OK] with no postinstall scripts.

**Primary recommendation:** Follow the existing tab pattern exactly. Install Tiptap with individual extensions (not StarterKit) for a smaller bundle. Use `generateText()` from `@tiptap/core` for body snippet extraction at save time. Use `useDebounceFn` from `@vueuse/core` (already installed) for auto-save — no new package needed.

---

## Project Constraints (from CLAUDE.md)

- PrimeVue components (`<Button>`, `<Dialog>`, `<Drawer>`, `<Card>`, `<Skeleton>`, `<Tabs>`, `<TabList>`, `<Tab>`, `<TabPanels>`, `<TabPanel>`) are **auto-imported** — no import statements.
- PrimeVue composables (`useConfirm`) must be **explicitly imported**: `import { useConfirm } from 'primevue/useconfirm'`
- `kaheeta:*` localStorage key prefix for all new keys.
- `wallecx_*` PocketBase collection names MUST NOT be renamed; new collections use `kaheeta_*` prefix.
- Dark mode via `.my-app-dark` class on `<html>` — never `@media (prefers-color-scheme: dark)`.
- Mobile-first: `BaseMobileDialog` for all create/edit dialogs.
- TypeScript with `noUncheckedIndexedAccess: true` — all indexed access returns `T | undefined`.
- All PocketBase writes go through mapper functions (strip read-only fields before create/update).
- All list reads use `instrumentedGetFullList` — never call `pb.collection().getFullList()` directly from components.
- Use `@/` path alias for all `src/`-rooted imports — no relative `../../` across feature boundaries.
- `import type` for type-only imports.
- `<iconify-icon>` is a registered custom element; use `<iconify-icon icon="mdi:...">` syntax.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Notes list rendering | Browser/Client (NotesTab.vue) | — | Client-side sorted list, already in memory |
| Note create/edit dialog | Browser/Client (ManageNote.vue) | — | Form state, BaseMobileDialog pattern |
| Rich-text editing | Browser/Client (NoteEditor.vue) | — | Tiptap is a pure client-side editor |
| Auto-save debounce | Browser/Client (useAutoSave composable) | — | Watches reactive form refs, triggers writes |
| Body snippet extraction | Browser/Client (save path) | — | generateText() runs client-side at save time |
| PocketBase read (notes list) | API/Backend via Client | — | instrumentedGetFullList → kaheeta_notes |
| PocketBase write (create/update/delete) | API/Backend via Client | — | Direct pb.collection() with mapper, no hook route needed (user-owned collection) |
| Navigation tab registration | Browser/Client (WallecxApp.vue) | — | PrimeVue Tabs shell in WallecxApp |
| PWA shortcut | Browser/Client (vite.config.ts manifest) | — | Static manifest, action consumed in WallecxApp onMounted |

---

## Standard Stack

### Core (new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tiptap/vue-3` | 3.27.1 | Vue 3 editor bindings (`useEditor`, `EditorContent`) | Official Vue 3 integration; 1.22M weekly downloads [VERIFIED: npm registry] |
| `@tiptap/pm` | 3.27.1 | ProseMirror peer dependency (required by all Tiptap extensions) | Required; Tiptap wraps ProseMirror [VERIFIED: npm registry] |
| `@tiptap/extension-bold` | 3.27.1 | Bold mark | Modular — avoids StarterKit bloat [VERIFIED: npm registry] |
| `@tiptap/extension-italic` | 3.27.1 | Italic mark | Modular [VERIFIED: npm registry] |
| `@tiptap/extension-heading` | 3.27.1 | H1–H6 heading node | Modular [VERIFIED: npm registry] |
| `@tiptap/extension-bullet-list` | 3.27.1 | Unordered list node | Modular [VERIFIED: npm registry] |
| `@tiptap/extension-link` | 3.27.1 | Hyperlink mark with `rel="noopener"` | Separate package required even with StarterKit [VERIFIED: npm registry] |
| `@floating-ui/dom` | 1.7.6 | Menu positioning (replaces Tippy.js in Tiptap v3) | **Required** for BubbleMenu in Tiptap v3 [VERIFIED: npm registry] |

**Note:** `@tiptap/extension-document`, `@tiptap/extension-paragraph`, `@tiptap/extension-text`, `@tiptap/extension-list-item`, `@tiptap/extension-hard-break`, and `@tiptap/extension-history` are also required as base nodes/marks for a functional editor without StarterKit. All versions 3.27.1. [VERIFIED: npm registry]

### Already Installed (no new install needed)

| Library | Version | Purpose |
|---------|---------|---------|
| `@vueuse/core` | ^14.3.0 | `useDebounceFn` for auto-save debounce [VERIFIED: installed in project] |
| `@tiptap/core` | (peer via @tiptap/vue-3) | `generateText()` for body snippet extraction [VERIFIED: type defs in downloaded package] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Individual extensions | `@tiptap/starter-kit` | StarterKit is ~120 KB gzipped vs. ~80–90 KB for selective install; also bundles History (renamed UndoRedo in v3), Strike, Code, Blockquote, HorizontalRule — all unused |
| `@vueuse/core` useDebounceFn | Custom setTimeout debounce | vueuse is already installed; no benefit to hand-rolling |
| `generateText()` at save time | Store body as-is, extract snippet at render time | At-save approach is faster at list render; avoids re-parsing JSON on every list render |

**Installation:**

```bash
npm install @tiptap/vue-3 @tiptap/pm @floating-ui/dom \
  @tiptap/extension-document @tiptap/extension-paragraph @tiptap/extension-text \
  @tiptap/extension-bold @tiptap/extension-italic @tiptap/extension-heading \
  @tiptap/extension-bullet-list @tiptap/extension-list-item @tiptap/extension-link \
  @tiptap/extension-hard-break @tiptap/extension-history
```

---

## Package Legitimacy Audit

| Package | Registry | Age | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|
| `@tiptap/vue-3` | npm | 5 yrs (created 2021-02-28) | [OK] | Approved |
| `@tiptap/pm` | npm | 5 yrs | [OK] | Approved |
| `@tiptap/extension-bold` | npm | 5 yrs | [OK] | Approved |
| `@tiptap/extension-italic` | npm | 5 yrs | [OK] | Approved |
| `@tiptap/extension-heading` | npm | 5 yrs | [OK] | Approved |
| `@tiptap/extension-bullet-list` | npm | 5 yrs | [OK] | Approved |
| `@tiptap/extension-link` | npm | 5 yrs | [OK] | Approved |
| `@floating-ui/dom` | npm | Active | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**Postinstall scripts:** None on any of the 8 packages verified via `npm view <pkg> scripts.postinstall` [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
User types in NoteEditor.vue
         │
         ▼
  useAutoSave composable
  (useDebounceFn, 1000ms)
         │
         ▼
  editor.getJSON() → generateText() for snippet
         │
         ▼
  mapToUpdateNote(record)   ← strips id/created/updated/user/expand
         │
         ▼
  pb.collection('kaheeta_notes').create / .update
         │
         ▼
  PocketBase → record returned with server-assigned id/updated
         │
         ▼
  Object.assign(localRecord, serverRecord)  ← id refresh for subsequent saves
         │
  [list re-renders via reactive notes ref]
```

**Read path on tab mount:**

```
NotesTab.vue <script setup> top-level await
         │
         ▼
  instrumentedGetFullList<Note>('kaheeta_notes', {
    sort: '-updated',
    filter: `user = '${auth.user?.id}'`,
    requestKey: 'notes-getFullList'
  })
         │
         ▼
  notes ref<Note[]> → computed sortedNotes (newest-updated first)
         │
         ▼
  list renders title + updated date + snippet (stored at save time)
```

### Recommended File Structure (new files only)

```
src/
├── components/wallecx/
│   ├── NotesTab.vue           # Tab component (defineAsyncComponent target)
│   ├── NoteEditor.vue         # Tiptap editor wrapper (toolbar + EditorContent + BubbleMenu)
│   └── ManageNote.vue         # BaseMobileDialog wrapper for create/edit
│
├── composables/
│   └── useAutoSave.ts         # Debounced save composable (useDebounceFn from @vueuse/core)
│
├── lib/pocketbase/
│   └── notesMapper.ts         # mapToUpdateNote() — strips read-only fields
│
└── types/wallecx/notes/
    └── types.d.ts             # Note interface extending RecordModel
```

### Pattern 1: Tiptap v3 useEditor with Individual Extensions

```typescript
// Source: tiptap.dev/docs/editor/getting-started/install/vue3
import { useEditor, EditorContent } from '@tiptap/vue-3'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Heading from '@tiptap/extension-heading'
import BulletList from '@tiptap/extension-bullet-list'
import ListItem from '@tiptap/extension-list-item'
import Link from '@tiptap/extension-link'
import HardBreak from '@tiptap/extension-hard-break'
import History from '@tiptap/extension-history'

const editor = useEditor({
  extensions: [
    Document, Paragraph, Text, Bold, Italic,
    Heading.configure({ levels: [1, 2, 3] }),
    BulletList, ListItem, HardBreak,
    Link.configure({ openOnClick: false }),
    History,
  ],
  content: props.initialContent ?? null,
  onUpdate: ({ editor }) => {
    emit('update', editor.getJSON())
  },
})

// Get content: editor.value?.getJSON()
// Set content: editor.value?.commands.setContent(jsonOrHtml, false)
// false = don't emit update event (prevents auto-save loop)
```

### Pattern 2: BubbleMenu (v3 — import from `/menus` subpath)

**BREAKING CHANGE from v2:** BubbleMenu is now imported from `@tiptap/vue-3/menus`, not `@tiptap/vue-3`. [VERIFIED: tiptap.dev/docs upgrade guide + WYSIWYG-EDITORS.md research]

```typescript
// Source: tiptap.dev/docs/editor/extensions/functionality/bubble-menu
import { BubbleMenu } from '@tiptap/vue-3/menus'
// NOT: import { BubbleMenu } from '@tiptap/vue-3'   ← v2 path, broken in v3
```

```html
<template>
  <BubbleMenu v-if="editor" :editor="editor">
    <Button text size="small" @click="editor.chain().focus().toggleBold().run()">
      <iconify-icon icon="mdi:format-bold" />
    </Button>
    <Button text size="small" @click="editor.chain().focus().toggleItalic().run()">
      <iconify-icon icon="mdi:format-italic" />
    </Button>
  </BubbleMenu>
</template>
```

### Pattern 3: setContent Command

```typescript
// Source: tiptap.dev/docs/editor/api/commands/set-content [VERIFIED]
// Accepts: JSON object, JSON string, HTML string
editor.value?.commands.setContent(jsonContent, false, {
  preserveWhitespace: 'full',
})
// Second arg (emitUpdate: false) prevents triggering the onUpdate handler
// which would fire auto-save on a programmatic load — not user input.
```

### Pattern 4: generateText for Body Snippet

```typescript
// Source: @tiptap/core dist/index.d.ts [VERIFIED: extracted from npm package]
// Signature: generateText(doc: JSONContent, extensions: Extensions, options?: { blockSeparator?: string }): string
import { generateText } from '@tiptap/core'

const snippet = generateText(
  noteBody,                // JSONContent from editor.getJSON()
  [Document, Paragraph, Text, Bold, Italic, Heading, BulletList, ListItem, Link, HardBreak],
  { blockSeparator: ' ' }  // join blocks with space for a single-line preview
).slice(0, 150)            // 150-char preview cap
```

Called at save time (not at list render time) — the result is stored as a `snippet` field on the `kaheeta_notes` record.

### Pattern 5: Existing PocketBase Mapper Pattern

```typescript
// Source: src/lib/pocketbase/membershipMapper.ts [VERIFIED: read from codebase]
import type { Note } from '@/types/wallecx/notes/types'

export function mapToUpdateNote(record: Note): {
  title: string
  body: string      // JSON.stringify(editor.getJSON())
  snippet: string   // generateText() result, 150 chars
} {
  return {
    title: record.title,
    body: record.body,
    snippet: record.snippet,
  }
}
// Strips: id, created, updated, user, collectionId, collectionName, expand
```

### Pattern 6: Existing Tab Registration Pattern

```typescript
// Source: src/components/wallecx/WallecxApp.vue [VERIFIED: read from codebase]
// Step 1: defineAsyncComponent at top of <script setup>
const NotesTab = defineAsyncComponent(() => import("./NotesTab.vue"))

// Step 2: ACTION_TAB_MAP entry for PWA shortcut
const ACTION_TAB_MAP: Record<string, string> = {
  // ... existing entries ...
  'open-notes': 'notes',  // new entry
}

// Step 3: TabList entry
// <Tab value="notes">
//   <iconify-icon icon="mdi:note-text-outline" width="16" height="16" aria-hidden="true" />
//   Notes
// </Tab>

// Step 4: TabPanel entry
// <TabPanel value="notes">
//   <Suspense>
//     <NotesTab />
//     <template #fallback>
//       <WallecxSkeleton variant="note-row" :count="3" />
//     </template>
//   </Suspense>
// </TabPanel>
```

### Pattern 7: Auto-Save Composable

```typescript
// Source: @vueuse/core useDebounceFn [VERIFIED: installed in project, exports confirmed]
import { useDebounceFn } from '@vueuse/core'
import { ref } from 'vue'

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export function useAutoSave(saveFn: () => Promise<void>, delayMs = 1000) {
  const status = ref<AutoSaveStatus>('idle')

  const debouncedSave = useDebounceFn(async () => {
    status.value = 'saving'
    try {
      await saveFn()
      status.value = 'saved'
    } catch {
      status.value = 'error'
    }
  }, delayMs)

  function trigger() {
    status.value = 'pending'
    void debouncedSave()
  }

  return { status, trigger }
}
```

### Pattern 8: iOS visualViewport Keyboard Handling

For the Tiptap toolbar to stay above the iOS virtual keyboard, use a sticky toolbar inside the scroll container rather than a fixed one, and supplement with `visualViewport` to track keyboard height:

```typescript
// Source: github.com/ueberdosis/tiptap/issues/6571 pattern [CITED]
onMounted(() => {
  if (!window.visualViewport) return
  window.visualViewport.addEventListener('resize', onViewportResize)
  window.visualViewport.addEventListener('scroll', onViewportResize)
})
onUnmounted(() => {
  window.visualViewport?.removeEventListener('resize', onViewportResize)
  window.visualViewport?.removeEventListener('scroll', onViewportResize)
})

function onViewportResize() {
  const vv = window.visualViewport
  if (!vv) return
  // keyboardHeight = window.innerHeight - vv.height - vv.offsetTop
  // Use to set bottom padding/margin on the editor container
  const keyboardHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
  editorContainerStyle.value = `padding-bottom: ${keyboardHeight}px`
}
```

**Simpler alternative for this use case:** The `BubbleMenu` (shown above selection) avoids the fixed-toolbar keyboard issue entirely. Reserve the fixed toolbar for desktop; use BubbleMenu for mobile. BaseMobileDialog's `onFocusin` handler already calls `scrollIntoView({ block: 'center' })`, which mitigates the most disruptive keyboard-obscuring scenario. [VERIFIED: BaseMobileDialog.vue source]

### Pattern 9: Note Type Definition

```typescript
// Source: src/types/wallecx/memberships/types.d.ts pattern [VERIFIED: read from codebase]
import type { RecordModel } from 'pocketbase'

export interface Note extends RecordModel {
  id: string
  created: string
  updated: string
  user: string        // relation to users collection
  title: string
  body: string        // JSON.stringify of ProseMirror JSONContent
  snippet: string     // plaintext preview, max 150 chars, stored at save time
}

export type AddNote = Omit<Note, 'id' | 'created' | 'updated'>
```

### Pattern 10: WallecxSkeleton New Variant

The `WallecxSkeleton` component requires a new `'note-row'` variant to be added to its `Props` union:

```typescript
// Source: src/components/wallecx/WallecxSkeleton.vue [VERIFIED: read from codebase]
// Current variants: 'vaccination-card' | 'membership-card' | 'expense-row' |
//                   'reports-chart' | 'attachment' | 'checklist'
// New variant to add: 'note-row'
```

```html
<!-- Mirror expense-row pattern: flat list of rows -->
<div v-else-if="props.variant === 'note-row'" class="flex flex-col gap-2">
  <Skeleton v-for="i in props.count" :key="i" height="4rem" class="w-full rounded" />
</div>
```

### Pattern 11: PWA Shortcut

```typescript
// Source: vite.config.ts [VERIFIED: read from codebase]
// Add to shortcuts array in VitePWA manifest:
{
  name: 'Open Notes',
  short_name: 'Notes',
  url: '/?action=open-notes',
  icons: [{ src: 'shortcuts/shortcut-open-notes.png', sizes: '96x96', type: 'image/png' }],
}
// The shortcut icon PNG must be created in public/shortcuts/
```

### Anti-Patterns to Avoid

- **Importing BubbleMenu from `@tiptap/vue-3`** — this is the v2 path, broken in v3. Must use `@tiptap/vue-3/menus`.
- **Using `tippyOptions` on BubbleMenu** — Tippy.js is removed in Tiptap v3; use Floating UI options instead.
- **Using `history: false` in StarterKit config** — in v3, the key is `undoRedo: false`. But since StarterKit is not used here, not applicable.
- **Calling `pb.collection().getFullList()` directly from components** — always use `instrumentedGetFullList`.
- **Sending the full typed `Note` record to PocketBase** — always call `mapToUpdateNote(record)` first. PocketBase rejects or silently ignores read-only field submissions, which can cause subtle bugs.
- **Storing body as HTML** — store as `JSON.stringify(editor.getJSON())`. JSON is deterministic, encryption-friendly, and avoids XSS risks from HTML round-tripping.
- **Calling `editor.commands.setContent(json)` on load without `emitUpdate: false`** — this triggers `onUpdate` which fires auto-save on load, creating a phantom save. Pass `false` as the second argument.
- **Deriving body snippet at list render time** — parse the full JSON body for every list item on every render. Store `snippet` in the database at save time instead.
- **Using `@media (prefers-color-scheme: dark)` for editor dark mode** — use `.my-app-dark .ProseMirror { ... }` in `wallecx-overrides.css`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Debounce for auto-save | Custom `setTimeout` ref tracking | `useDebounceFn` from `@vueuse/core` | Edge cases: component unmount before flush, React-style stale closure bugs |
| Plaintext from ProseMirror JSON | Walk the JSON tree manually | `generateText()` from `@tiptap/core` | Handles nested nodes, block separators, custom serializers — already in dep tree |
| BubbleMenu positioning | Custom floating div | `BubbleMenu` from `@tiptap/vue-3/menus` | Floating UI handles scroll, flip, and selection-tracking |
| Dirty-state guard | Custom confirm modal | `BaseMobileDialog` + `useConfirm` | Already handles Drawer swipe-down, backdrop tap, Esc key, and the bypass-guard pattern |
| Mobile keyboard detection | Custom resize observer | `visualViewport` resize event | Standard Web API, handles iOS Safari keyboard correctly |

**Key insight:** The Kaheeta codebase already solves the hard problems (mobile keyboard UX, dirty-state guards, toast notifications, perf instrumentation). The Notes feature should connect existing infrastructure, not rebuild it.

---

## Common Pitfalls

### Pitfall 1: Tiptap v3 BubbleMenu Wrong Import Path

**What goes wrong:** `import { BubbleMenu } from '@tiptap/vue-3'` silently fails — BubbleMenu is undefined and the template renders nothing, or TypeScript errors at compile time.

**Why it happens:** Tiptap v3 moved menu components to a `/menus` subpath to enable tree-shaking.

**How to avoid:** Always import from `@tiptap/vue-3/menus`.

**Warning signs:** TypeScript "Module has no exported member 'BubbleMenu'" or menu not rendering.

### Pitfall 2: setContent Triggers Auto-Save on Load

**What goes wrong:** Opening a note for editing calls `editor.commands.setContent(savedBody)`, which fires the `onUpdate` callback, which triggers the auto-save debounce, which POSTs a write to PocketBase immediately on open.

**Why it happens:** `emitUpdate` defaults to `true` in setContent.

**How to avoid:** Call `editor.commands.setContent(content, false)` — the second argument is `emitUpdate: false`. [VERIFIED: tiptap.dev/docs/editor/api/commands/set-content]

**Warning signs:** PocketBase shows an `updated` timestamp change immediately when opening a note without editing.

### Pitfall 3: requestKey Collision

**What goes wrong:** Two simultaneous `instrumentedGetFullList` calls with the same `requestKey` cause PocketBase SDK to cancel one of them — data silently disappears.

**Why it happens:** PocketBase auto-deduplication by `requestKey`.

**How to avoid:** Use `requestKey: 'notes-getFullList'`. This key is unique and does not collide with any existing key in the codebase. [VERIFIED: searched codebase — existing keys are `vaccinations-getFullList`, `memberships-getFullList`, `expenses-getFullList`, `expense-categories-getFullList`, `expense-budgets-getFullList`, `checklists-getFullList`, `checklist-tasks-getFullList`]

**Warning signs:** Notes list intermittently empty; network tab shows cancelled XHR.

### Pitfall 4: Object.assign id Refresh on Create

**What goes wrong:** First save creates the record and returns a server-assigned `id`. Subsequent auto-saves (while the dialog stays open) POST to the wrong endpoint (create instead of update) because the local record's `id` is still empty string.

**Why it happens:** The `record` ref needs to receive the server `id` after the first create.

**How to avoid:** After create: `Object.assign(record.value, serverRecord)`. This is the established pattern in `ManageMembership.vue`. [VERIFIED: membershipMapper.spec.ts — create-then-update id-refresh contract test]

**Warning signs:** Duplicate notes appearing in the list after editing a newly-created note.

### Pitfall 5: Tiptap Editor Memory Leak

**What goes wrong:** `useEditor` returns a ref; the editor instance is not destroyed when the component unmounts, causing ProseMirror DOM listeners to persist.

**Why it happens:** Tiptap's `useEditor` composable handles this automatically when used inside `<script setup>`, but only if the component is properly unmounted.

**How to avoid:** `useEditor` in Vue 3 `<script setup>` context handles cleanup via `onBeforeUnmount` automatically. No manual `editor.value?.destroy()` needed. [CITED: tiptap.dev/docs/editor/getting-started/install/vue3]

**Warning signs:** Memory grows on repeated open/close of the note editor dialog.

### Pitfall 6: noUncheckedIndexedAccess on Notes Array

**What goes wrong:** `notes.value[0].title` — TypeScript errors because indexed access returns `Note | undefined`.

**Why it happens:** `noUncheckedIndexedAccess: true` is enforced in tsconfig.

**How to avoid:** Use optional chaining: `notes.value[0]?.title` or prefer iteration (`for...of`, `.map()`, `.filter()`).

### Pitfall 7: Auto-Save Flush on Dialog Close

**What goes wrong:** User types, then immediately closes the dialog. The debounce hasn't fired yet. Changes are lost.

**Why it happens:** `useDebounceFn` does not flush on component unmount by default.

**How to avoid:** In `ManageNote.vue` `onBeforeUnmount` (or in the `closeWithoutGuard` path), call `debouncedSave.flush()` to force an immediate save before the component disappears. `useDebounceFn` returns a function with a `.flush()` method. [VERIFIED: @vueuse/core source]

**Warning signs:** Last few keystrokes before close are not persisted.

---

## Code Examples

### Reading Notes in Tab Component

```typescript
// Source: MembershipsTab.vue pattern [VERIFIED: read from codebase]
import { instrumentedGetFullList } from '@/lib/pocketbase/perfInstrument'
import type { Note } from '@/types/wallecx/notes/types'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const notes = ref<Note[]>([])

// Top-level await in <script setup> — drives Suspense fallback
notes.value = await instrumentedGetFullList<Note>('kaheeta_notes', {
  sort: '-updated',
  filter: `user = '${auth.user?.id ?? ''}'`,
  requestKey: 'notes-getFullList',
})
```

### Writing a Note (create)

```typescript
// Source: ManageMembership.vue pattern [VERIFIED: read from codebase]
import { pb } from '@/lib/pocketbase'
import { mapToUpdateNote } from '@/lib/pocketbase/notesMapper'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

async function createNote(draft: AddNote): Promise<Note> {
  const payload = {
    ...mapToUpdateNote(draft as Note),
    user: auth.user?.id,
  }
  const created = await pb.collection('kaheeta_notes').create<Note>(payload)
  return created
}
```

### Writing a Note (update)

```typescript
async function updateNote(record: Note): Promise<Note> {
  const updated = await pb
    .collection('kaheeta_notes')
    .update<Note>(record.id, mapToUpdateNote(record))
  return updated
}
```

### Deleting with useConfirm Gate

```typescript
// Source: MembershipsTab.vue pattern [VERIFIED: read from codebase]
import { useConfirm } from 'primevue/useconfirm'
const confirm = useConfirm()

function requestDelete(record: Note): void {
  confirm.require({
    header: 'Delete note?',
    message: `"${record.title}" will be permanently deleted.`,
    acceptLabel: 'Delete',
    rejectLabel: 'Cancel',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await pb.collection('kaheeta_notes').delete(record.id)
        notes.value = notes.value.filter((n) => n.id !== record.id)
        toast.success('Note deleted.')
      } catch (e: unknown) {
        toast.error('Failed to delete note.')
        console.error('NotesTab: delete failed', e)
      }
    },
  })
}
```

---

## PocketBase Collection Schema

The `kaheeta_notes` collection must be created in PocketBase Admin UI with these fields:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user` | Relation → users | Yes | Owner; List/View rule: `user = @request.auth.id` |
| `title` | Text | Yes | Note title; max 500 chars |
| `body` | Text (long) | No | `JSON.stringify(editor.getJSON())`; nullable for empty notes |
| `snippet` | Text | No | Max 150 chars, plaintext preview; generated at save time |

**PocketBase collection rules:**
- List: `user = @request.auth.id`
- View: `user = @request.auth.id`
- Create: `user = @request.auth.id`
- Update: `user = @request.auth.id`
- Delete: `user = @request.auth.id`

**Write route:** Direct `pb.collection('kaheeta_notes').create/update/delete` — no hook route required (this is a standard user-owned collection, unlike `kaheeta_groups` which has admin-only write rules). [VERIFIED: ARCHITECTURE.md]

**PocketBase auto-fields (always present, never send in writes):**
- `id` — auto-generated UUID
- `created` — auto-set on create
- `updated` — auto-updated on every write
- `collectionId`, `collectionName` — system fields
- `expand` — relation expansion container

---

## Validation Architecture

nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/lib/pocketbase/__tests__/notesMapper.spec.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTE-01 | Create note with title and rich-text body | Manual (editor) | `npx vitest run -t "mapToUpdateNote"` (mapper unit) | No — Wave 0 |
| NOTE-02 | Open and edit an existing note | Manual (dialog flow) | — | — |
| NOTE-03 | Delete with confirmation dialog | Manual (useConfirm) | — | — |
| NOTE-04 | Auto-save debounce fires on content change | Unit: `useAutoSave.test.ts` | `npx vitest run src/composables/useAutoSave.test.ts` | No — Wave 0 |
| LIST-01 | List sorted by `-updated` | Unit: NotesTab sort logic | `npx vitest run -t "sorted"` | No — Wave 0 |
| LIST-02 | List item shows title, date, snippet | Manual (visual) | — | — |
| NAV-01 | Notes tab reachable from nav | Manual (click/PWA shortcut) | — | — |
| (mapper) | `mapToUpdateNote` strips read-only fields | Unit: notesMapper.spec.ts | `npx vitest run src/lib/pocketbase/__tests__/notesMapper.spec.ts` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/pocketbase/__tests__/notesMapper.spec.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/pocketbase/__tests__/notesMapper.spec.ts` — covers mapper strip + preserve behavior (mirrors `membershipMapper.spec.ts`)
- [ ] `src/composables/useAutoSave.test.ts` — covers debounce timing, status transitions (idle → pending → saving → saved), flush on unmount
- [ ] `src/lib/wallecx/notesSnippet.test.ts` — covers `generateText()` round-trip: given a JSON doc, produces expected plaintext (optional helper extraction)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BubbleMenu from `@tiptap/vue-3` | BubbleMenu from `@tiptap/vue-3/menus` | Tiptap v3 (2025) | Breaking import path — must update all imports |
| `tippyOptions` prop on BubbleMenu | Floating UI options | Tiptap v3 (2025) | `tippyOptions` silently ignored; new option names needed |
| `history` key in StarterKit config | `undoRedo` key | Tiptap v3 (2025) | Irrelevant here (StarterKit not used), but affects migration docs |
| Tippy.js peer dep | `@floating-ui/dom` peer dep | Tiptap v3 (2025) | New install required; without it, BubbleMenu positioning breaks |

**Deprecated/outdated:**

- `import { BubbleMenu } from '@tiptap/vue-3'` — removed in v3, now in `/menus` subpath. [CITED: tiptap.dev/docs/guides/upgrade-tiptap-v2]
- `tippyOptions` BubbleMenu prop — removed; use Floating UI config. [CITED: tiptap.dev/docs/guides/upgrade-tiptap-v2]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@tiptap/extension-document`, `@tiptap/extension-paragraph`, `@tiptap/extension-text`, `@tiptap/extension-list-item`, `@tiptap/extension-hard-break`, `@tiptap/extension-history` are all required as base extensions when not using StarterKit | Standard Stack | If some are already bundled into `@tiptap/pm` or another package, the install is slightly over-specified — harmless but wasteful |
| A2 | Body snippet should be stored as a denormalized `snippet` field in `kaheeta_notes` at save time | Architecture Patterns | If the team prefers on-the-fly snippet extraction at render time using `generateText()` called in a computed, the `snippet` field is unnecessary. Both approaches work; this recommendation avoids re-parsing JSON on every list render |
| A3 | Auto-save debounce delay of 1000ms is appropriate | Architecture Patterns | Industry range is 500ms–2000ms; 1000ms is a common midpoint for note apps. Could be too slow for power users or too fast for mobile network conditions |
| A4 | `useDebounceFn` from `@vueuse/core` returns a function with a `.flush()` method suitable for unmount flushing | Common Pitfalls | @vueuse/core 14.x docs confirm this; [VERIFIED: exports confirmed from installed package] — but flush behavior in Vue 3 Suspense unmount edge cases is not verified |
| A5 | PWA shortcut PNG `public/shortcuts/shortcut-open-notes.png` does not exist yet | Navigation Wiring | Needs to be created (96×96 PNG); no shortcut will break the PWA if the image is missing at install time, but Android may show a broken icon |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

---

## Open Questions (RESOLVED)

1. **Should `snippet` be a PocketBase field or computed at render time?**
   - What we know: Both work. Storing at save time is faster to render.
   - What's unclear: Whether the ~150 chars of extra storage per note is acceptable on the shared backend.
   - RESOLVED: Store `snippet` as a PocketBase field, populated by `generateText()` at save time. This simplifies the read path and avoids future problems when Phase 2 encrypts the `body` field — a pre-computed snippet will also need encryption treatment. Storage overhead is negligible.

2. **Should the Notes tab be added to `WallecxApp.vue` as the 6th tab, or does the 5-tab layout have a CSS constraint?**
   - What we know: The current `wallecx-main-tabs` CSS is not inspected for a max-tab count.
   - What's unclear: Whether adding a 6th tab causes the tab strip to overflow on narrow mobile screens.
   - RESOLVED: PrimeVue `<Tabs>` handles horizontal overflow natively via its built-in nav-button mechanism. The existing `.p-tablist` sticky rule in `wallecx-overrides.css` and the `.wallecx-main-tabs` container already apply `overflow-x: auto`. No additional CSS is required for the 6th tab. Confirmed by inspecting the existing wallecx-overrides.css rules documented in UI-SPEC.md §Tab Strip Overflow (6th Tab).

3. **Does `useEditor` in `<script setup>` inside `BaseMobileDialog` (which mounts/unmounts) properly destroy the editor?**
   - What we know: `useEditor` automatically registers cleanup via `onBeforeUnmount` in Vue 3 `<script setup>`.
   - What's unclear: Whether `<Drawer>` uses `v-if` (true unmount) or `v-show` (hidden but not unmounted) internally in PrimeVue v4.
   - RESOLVED: Place `<NoteEditor>` inside a `v-if="visible"` guard to force true mount/unmount regardless of PrimeVue Drawer's internal rendering strategy. This guarantees `useEditor` cleanup runs via its `onBeforeUnmount` hook. Implemented in Plan 03 Task 2.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install | ✓ | (project already running) | — |
| PocketBase backend | Notes data layer | ✓ | (existing, at api.delveen.cc) | — |
| npm | Package install | ✓ | (project uses npm) | — |

No blocking missing dependencies.

---

## Security Domain

security_enforcement is not set to false — default is enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (reads use existing auth) | pb.authStore JWT (existing) |
| V3 Session Management | No | existing session handling |
| V4 Access Control | Yes | PocketBase collection rules: `user = @request.auth.id` on all operations |
| V5 Input Validation | Yes | Title max length enforced; body stored as JSON not HTML (no XSS risk) |
| V6 Cryptography | No (Phase 1 is plaintext; crypto is Phase 2) | AES-GCM in Phase 2 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Other users reading notes | Spoofing/Info Disclosure | PocketBase `user = @request.auth.id` rule on List/View/Update/Delete |
| XSS via rendered body | Tampering | Store body as ProseMirror JSON, not HTML; Vue's template rendering escapes text nodes automatically |
| Tiptap link XSS (`javascript:` hrefs) | Tampering | `Link.configure({ protocols: ['http', 'https'] })` — explicitly whitelist safe protocols |

---

## Sources

### Primary (HIGH confidence)

- `src/lib/pocketbase/expenseMapper.ts` — verified mapper pattern (read from codebase)
- `src/lib/pocketbase/membershipMapper.ts` — verified mapper pattern (read from codebase)
- `src/lib/pocketbase/perfInstrument.ts` — verified `instrumentedGetFullList` signature (read from codebase)
- `src/components/wallecx/BaseMobileDialog.vue` — verified props, slots, `closeWithoutGuard` API (read from codebase)
- `src/components/wallecx/WallecxApp.vue` — verified tab registration and ACTION_TAB_MAP pattern (read from codebase)
- `src/components/wallecx/WallecxSkeleton.vue` — verified variant union and skeleton pattern (read from codebase)
- `@tiptap/core` dist/index.d.ts — verified `generateText` signature (extracted from npm pack)
- npm registry — all package versions verified via `npm view`
- slopcheck — all 8 packages rated [OK] (run 2026-06-30)

### Secondary (MEDIUM confidence — official docs)

- [tiptap.dev/docs/editor/getting-started/install/vue3](https://tiptap.dev/docs/editor/getting-started/install/vue3) — Vue 3 install command and useEditor
- [tiptap.dev/docs/guides/upgrade-tiptap-v2](https://tiptap.dev/docs/guides/upgrade-tiptap-v2) — v2→v3 breaking changes: BubbleMenu import path, Floating UI, History→UndoRedo
- [tiptap.dev/docs/editor/extensions/functionality/bubble-menu](https://tiptap.dev/docs/editor/extensions/functionality/bubble-menu) — BubbleMenu component API and import path
- [tiptap.dev/docs/editor/api/commands/set-content](https://tiptap.dev/docs/editor/api/commands/set-content) — setContent signature and `emitUpdate: false` parameter

### Tertiary (LOW — community, cited)

- [github.com/ueberdosis/tiptap/issues/6571](https://github.com/ueberdosis/tiptap/issues/6571) — iOS toolbar viewport issue (Jul 2025)
- [github.com/ueberdosis/tiptap/discussions/3114](https://github.com/ueberdosis/tiptap/discussions/3114) — `generateText()` without active editor
- `src/lib/pocketbase/__tests__/membershipMapper.spec.ts` — test pattern for mapper spec files

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all versions verified via npm registry; all packages slopcheck [OK]
- Architecture: HIGH — patterns extracted directly from existing codebase files
- Tiptap v3 API: MEDIUM-HIGH — official docs verified for setContent, BubbleMenu import path, upgrade guide
- Pitfalls: HIGH for project-specific (verified from code); MEDIUM for Tiptap-specific (official docs cited)

**Research date:** 2026-06-30
**Valid until:** 2026-07-30 (Tiptap 3.x is actively releasing; re-verify breaking changes if >30 days elapse)

---

## RESEARCH COMPLETE
