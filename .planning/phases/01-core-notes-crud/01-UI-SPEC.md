---
phase: 1
slug: core-notes-crud
status: approved
design_system: primevue-aura
shadcn_initialized: false
preset: none
created: 2026-06-30
reviewed_at: 2026-06-30
---

# Phase 1 — UI Design Contract

> Visual and interaction contract for the Notes feature: NotesTab, NoteEditor, ManageNote dialog, and NavBar tab entry.
> Pre-populated from RESEARCH.md, REQUIREMENTS.md, base.css tokens, wallecx-overrides.css, main.ts, and live source components.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (PrimeVue Aura — project predates shadcn gate) |
| Preset | PrimeVue Aura with custom navy/amber brand overrides in main.ts |
| Component library | PrimeVue v4 (auto-imported via unplugin-vue-components + PrimeVueResolver — NO import statements in components) |
| Icon library | Iconify `mdi:*` via `<iconify-icon icon="mdi:...">` custom element — no import needed |
| Font | PrimeVue Aura default font stack (system UI stack) |
| Styling | Tailwind CSS v4 utility classes |
| Dark mode | `.my-app-dark` class on `<html>` ONLY — never `@media (prefers-color-scheme: dark)` |

Registry Safety: not applicable (no shadcn, no third-party component registries).

---

## Color Contract

All values sourced from `src/assets/base.css` `@theme` block and `.my-app-dark` overrides. No new color values are introduced in Phase 1.

### Light Mode

| Role | Token | Hex Value | Usage |
|------|-------|-----------|-------|
| Dominant surface (60%) | `--color-surface-page` | `#f5f7fa` | Page background behind the wallecx Card |
| Card / panel surface (30%) | `--color-surface-card` | `#ffffff` | wallecx-root Card, tab panel, dialog/drawer surface |
| Secondary surface | `--color-surface-card-2` | `#eef1f6` | Note cards (lifted tiles inside tab panel) |
| Divider | `--color-surface-divider` | `#e8ecf2` | Card borders, horizontal rules, action bar border-top |
| Accent (10%) | `--color-brand-accent` | `#e89820` | Empty-state icon, active toolbar button highlight, auto-save "saved" status dot, primary CTA button (PrimeVue default) |
| Text heading | `--color-typo-heading` | `#0d1117` | Note title in card, dialog heading, empty-state heading |
| Text body | `--color-typo-body` | `#3d4a5c` | Note snippet in card, dialog body text, editor body text |
| Text muted | `--color-typo-muted` | `#6b7280` | Note updated-date in card, auto-save status text, editor placeholder |
| Destructive | `--color-status-error` | `#c0392b` | Delete icon button icon color (hover), useConfirm acceptClass button |
| Success | `--color-status-success` | `#1a7c45` | Auto-save "Saved" status text |
| Brand primary (adaptive) | `--color-brand-primary` | navy in light / amber in dark | Empty-state icon — matches MembershipsTab pattern; token is theme-adaptive unlike `--color-brand-accent` (amber-only) |

### Dark Mode (`.my-app-dark`)

| Role | Token | Hex Value | Usage |
|------|-------|-----------|-------|
| Dominant surface (60%) | `--color-surface-page` | `#001327` | Page background |
| Card / panel surface (30%) | `--color-surface-card` | `#0a2c52` | wallecx-root Card, tab panel, drawer surface |
| Secondary surface | `--color-surface-card-2` | `#0e3360` | Note cards (`.my-app-dark .p-card` override in wallecx-overrides.css already handles this) |
| Divider | `--color-surface-divider` | `rgba(255,255,255,0.08)` | Card borders, action bar border-top |
| Accent (10%) | `--color-brand-accent` | `#e89820` | Same reserved elements as light mode |
| Text heading | `--color-typo-heading` | `#ffffff` | Note title, dialog heading, empty-state heading |
| Text body | `--color-typo-body` | `#d7e2f0` | Note snippet, editor body text |
| Text muted | `--color-typo-muted` | `#8095af` | Note date, auto-save status, editor placeholder |
| Destructive | `--color-status-error` | `#c0392b` | Delete actions (theme-independent) |
| Success | `--color-status-success` | `#1a7c45` | Auto-save "Saved" status text (theme-independent) |
| Brand primary (adaptive) | `--color-brand-primary` | (same as light) | Empty-state icon (dark: resolves to amber) |

### Accent Reserved For

The `--color-brand-accent` amber is reserved exclusively for:
1. Empty-state icon color (`style="color: var(--color-brand-accent)"`)
2. Primary CTA button (PrimeVue default primary severity maps to this in dark mode)
3. Auto-save "Saved" status indicator (success confirmation only, not idle/pending/error)
4. Active/focused state on PrimeVue Tabs ink bar (handled by PrimeVue Aura — no custom code)

The amber accent is NOT used on: note card borders, editor toolbar buttons in their default state, or section headers.

---

## Typography

Sourced from existing tab components (MembershipsTab.vue, WallecxSkeleton.vue, KaheetaNavBar.vue) and PrimeVue Aura defaults.

| Role | Size | Weight | Line Height | Token / Class |
|------|------|--------|-------------|---------------|
| Note card title, empty state heading | 14px (0.875rem) | 600 / 400 | 1.4 | `text-sm font-semibold` (title) / `text-sm` (empty state) |
| Snippet, metadata, dates, auto-save status, tab labels | 12px (0.75rem) | 400 (regular) | 1.4 | `text-xs` |
| Dialog / drawer title, editor body (ProseMirror) | 16px (1rem) | 600 / 400 | 1.4 / 1.6 | Aura Dialog default / `.ProseMirror p` — 16px enforced for iOS auto-zoom |
| Editor heading H1 | 28px (1.75rem) | 600 (semibold) | 1.2 | `.ProseMirror h1` |

Declared sizes (4-size scale):
- **12px** — snippet, metadata, dates, auto-save status, tab labels
- **14px** — card titles, empty-state heading
- **16px** — dialog/drawer title, editor body (ProseMirror paragraphs)
- **28px** — editor H1 heading

H2 (22px) and H3 (18px) CSS rules exist in `.ProseMirror h2/h3` as implementation details but are not tracked as distinct scale entries. Both use `font-weight: 600`.

Declared weights: **400** (regular) and **600** (semibold — card titles, dialog title, H1 heading).

---

## Spacing Scale

Follows the existing 4-point base scale as used in MembershipsTab.vue and ExpensesTab.vue.

| Token | Value | Usage in Notes Phase |
|-------|-------|----------------------|
| xs | 4px (`gap-1`) | Gap between icon and label inside toolbar buttons |
| sm | 8px (`gap-2`, `p-2`) | Gap between skeleton rows; button group gaps |
| md | 16px (`gap-4`, `p-4`) | Standard gap between note cards; card inner padding |
| lg | 24px (`py-6`) | Empty-state top/bottom padding contribution |
| xl | 48px (`py-12`) | Empty state container vertical padding — matches MembershipsTab empty state `py-12` |
| 2xl | 64px | Not used in this phase |

**Card inner padding:** `p-4` (16px all sides) — mirrors existing `<Card>` content padding.

**List gap between cards:** `gap-2` (8px) — matches `expense-row` pattern (flat list rows use `gap-1` to `gap-2`); note cards are taller than expense rows so `gap-2` is appropriate.

**Dialog content padding:** Handled by PrimeVue Drawer/Dialog defaults + `wallecx-overrides.css` safe-area rules. No additional padding override needed.

**Editor toolbar height:** 44px minimum (touch-target floor from `wallecx-overrides.css` `.wallecx-root .p-button.p-button-icon-only`). Toolbar is a flex row with `gap-1` between buttons.

**Editor toolbar padding:** `py-2 px-2` (8px vertical, 8px horizontal) — consistent with existing WallecxToolbar padding.

**Exception:** Touch targets floor is 44px minimum (enforced by `.wallecx-root .p-button.p-button-icon-only` rule in wallecx-overrides.css). All icon-only buttons in NotesTab and NoteEditor inherit this automatically.

---

## Component Contracts

### 1. NotesTab.vue — List View

**File:** `src/components/wallecx/NotesTab.vue`
**Pattern:** Follows MembershipsTab.vue structure (defineAsyncComponent target, top-level `await` in `<script setup>` drives Suspense fallback).
**Primary visual anchor (populated state):** The note card list — the first visible card is the focal point. The "New note" button is secondary (top-right). The tab label "Notes" in the nav bar orients the user.
**Primary visual anchor (empty state):** The `mdi:note-text-outline` icon + "Write your first note" CTA button.

#### Note Card Layout

Each note renders as a flat list row (not a grid). Use `flex flex-col gap-2` as the list container. Each card:

```
<div class="flex items-start justify-between gap-2 p-4 rounded border cursor-pointer
            border-[var(--color-surface-divider)]
            bg-[var(--color-surface-card-2)]
            hover:brightness-95 transition-[filter]">
  <div class="flex flex-col gap-1 min-w-0 flex-1">
    <span class="text-sm font-semibold truncate" style="color: var(--color-typo-heading)">
      {{ note.title || 'Untitled' }}
    </span>
    <span class="text-xs" style="color: var(--color-typo-muted)">
      {{ formattedDate }}           <!-- e.g. "30 Jun 2026" via dayjs -->
    </span>
    <p class="text-xs line-clamp-2" style="color: var(--color-typo-body)">
      {{ note.snippet || '' }}
    </p>
  </div>
  <!-- Delete icon button — right-aligned, 44px touch target -->
  <Button text rounded severity="secondary" aria-label="Delete note" @click.stop="requestDelete(note)">
    <iconify-icon icon="mdi:delete-outline" width="20" height="20" aria-hidden="true" />
  </Button>
</div>
```

- `min-w-0 flex-1` on the text column prevents title from overflowing the delete button.
- `truncate` on title for single-line overflow (ellipsis).
- `line-clamp-2` on snippet (2-line max via Tailwind line-clamp utility).
- `@click.stop` on delete button prevents the card's own `@click` (open note) from firing.
- Date format: `dayjs(note.updated).format('D MMM YYYY')` — matches existing date formatting in MembershipsTab.

#### Empty State

Shown when `notes.length === 0` (no notes at all):

```html
<div class="flex flex-col items-center py-12 gap-3">
  <iconify-icon
    icon="mdi:note-text-outline"
    width="48"
    height="48"
    style="color: var(--color-brand-primary)"
    aria-hidden="true"
  />
  <p class="text-sm" style="color: var(--color-typo-heading)">
    No notes yet.
  </p>
  <Button label="Write your first note" icon="pi pi-plus" size="small" @click="openManage(null)" />
</div>
```

Icon uses `--color-brand-primary` (navy in light, amber in dark) — matches the MembershipsTab empty-state icon pattern exactly.

#### Loading State

Suspense fallback in WallecxApp.vue renders:
```html
<WallecxSkeleton variant="note-row" :count="3" />
```

The `note-row` variant (new, to be added to WallecxSkeleton.vue):
```html
<div v-else-if="props.variant === 'note-row'" class="flex flex-col gap-2">
  <Skeleton v-for="i in props.count" :key="i" height="4rem" class="w-full rounded" />
</div>
```

Height `4rem` (64px) accommodates title + date + single-line snippet approximation. Count: 3 (matches all other tab fallbacks).

#### Create Button

Position: top of tab panel, right-aligned on sm+ screens, full-width on mobile (matches MembershipsTab "Add card" button pattern).

```html
<div class="flex gap-2 mb-4 sm:justify-end">
  <Button
    class="flex-1 sm:flex-none"
    label="New note"
    icon="pi pi-plus"
    size="small"
    @click="openManage(null)"
  />
</div>
```

- PrimeVue `<Button>` (auto-imported).
- Icon: `pi pi-plus` (PrimeVue icon — consistent with other tab Add buttons).
- Label: "New note".
- No floating action button (FAB) — the existing tab pattern uses an inline top-bar button, not a FAB.

#### Delete Action

- Icon button on each card: `<iconify-icon icon="mdi:delete-outline">`.
- Tap fires `requestDelete(note)` which calls `useConfirm().require(...)`.
- `useConfirm` must be explicitly imported: `import { useConfirm } from 'primevue/useconfirm'`.
- See Copywriting Contract for confirmation dialog copy.

---

### 2. ManageNote.vue — Create/Edit Dialog

**File:** `src/components/wallecx/ManageNote.vue`
**Pattern:** Wraps `BaseMobileDialog` (bottom Drawer on mobile, centered Dialog on desktop).

#### Dialog Titles

| Mode | Title |
|------|-------|
| Create (no existing note) | "New Note" |
| Edit (existing note) | "Edit Note" |

Pass as `:title="isNew ? 'New Note' : 'Edit Note'"` to `BaseMobileDialog`.

#### Title Input

PrimeVue `<InputText>` at the top of the dialog content area, before the editor.

```html
<InputText
  v-model="draft.title"
  placeholder="Note title"
  class="w-full mb-3"
  aria-label="Note title"
  maxlength="500"
/>
```

- `placeholder="Note title"` — no visible label needed (the dialog title provides context).
- `maxlength="500"` — matches PocketBase schema constraint.
- `class="w-full mb-3"` — full width, 12px bottom margin separating from editor.
- No character counter displayed (v1 scope).

#### Auto-Save Status Indicator

Displayed in the dialog header area (inside `BaseMobileDialog`'s header slot, next to the title).

```html
<template #header>
  <!-- BaseMobileDialog header slot — on mobile this is the Drawer header -->
  <div class="flex flex-col items-center w-full gap-1">
    <DragHandle />
    <span class="font-semibold">{{ isNew ? 'New Note' : 'Edit Note' }}</span>
    <span
      class="text-xs"
      :style="{ color: statusColor }"
      aria-live="polite"
      aria-atomic="true"
    >{{ statusText }}</span>
  </div>
</template>
```

Status text and color per state:

| Status | Display Text | Color token |
|--------|-------------|-------------|
| `idle` | `""` (empty string — nothing shown) | — |
| `pending` | `""` (empty — debounce not yet fired) | — |
| `saving` | `"Saving…"` | `var(--color-typo-muted)` |
| `saved` | `"Saved"` | `var(--color-status-success)` (`#1a7c45`) |
| `error` | `"Save failed — tap to retry"` | `var(--color-status-error)` (`#c0392b`) |

- `aria-live="polite"` on the status span so screen readers announce status changes without interrupting.
- On desktop (Dialog), the status text appears below the dialog header title in the same header area, or as a subtle subtitle.

#### No Explicit Save Button

Auto-save only. The `BaseMobileDialog` `#actions` slot is empty for ManageNote. The dialog is closed via the X button (desktop) or swipe-down / X (mobile). No "Save" / "Cancel" buttons in the footer.

#### Dirty-State Guard

`BaseMobileDialog` handles this via its `isDirty` prop and built-in `useConfirm` gate. Wire:
- `:is-dirty="status === 'pending' || status === 'saving'"` — dirty while a save is in flight or queued.
- `:is-saving="status === 'saving'"` — disables the close button while actively saving.

The dirty-state guard confirmation dialog copy (rendered by BaseMobileDialog's existing `confirm.require` call):
- Header: `"Discard changes?"` (BaseMobileDialog.vue hardcodes this — do not override)
- Message: `"Your unsaved changes will be lost."` (BaseMobileDialog.vue hardcodes this — do not override)
- Accept label: `"Discard"`
- Reject label: `"Keep editing"`

---

### 3. NoteEditor.vue — Tiptap Rich-Text Editor

**File:** `src/components/wallecx/NoteEditor.vue`

#### Editor Placeholder

```
"Start writing…"
```

Set via Tiptap `Placeholder` extension or the editor's `editorProps.attributes.placeholder` CSS approach. Use CSS placeholder:

```css
.ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: var(--color-typo-muted);
  pointer-events: none;
  height: 0;
}
```

Where `data-placeholder="Start writing…"` is set via the Placeholder extension. Place this rule in `wallecx-overrides.css`.

#### Desktop Toolbar

A horizontal row of PrimeVue `<Button text rounded>` icon buttons, rendered above `<EditorContent>` on desktop.

| Slot | Function | Icon | aria-label |
|------|----------|------|------------|
| 1 | Bold | `mdi:format-bold` | "Bold" |
| 2 | Italic | `mdi:format-italic` | "Italic" |
| 3 | H1 | `mdi:format-header-1` | "Heading 1" |
| 4 | H2 | `mdi:format-header-2` | "Heading 2" |
| 5 | H3 | `mdi:format-header-3` | "Heading 3" |
| 6 | Bullet list | `mdi:format-list-bulleted` | "Bullet list" |
| 7 | Link | `mdi:link-variant` | "Insert link" |

Button layout: `<div class="flex flex-wrap gap-1 mb-2 border-b pb-2" style="border-color: var(--color-surface-divider)">`.

All toolbar buttons use `<Button text rounded size="small">` (PrimeVue auto-imported). The `size="small"` on the Button component still satisfies the 44px min-height floor from `wallecx-overrides.css` because the floor only applies to `.p-button-icon-only` and these are icon-only.

#### Active State for Toolbar Buttons

When the corresponding mark/node is active in the editor, add `severity="primary"` to that Button. Default (inactive) uses `severity="secondary"`.

```html
<Button
  text rounded size="small"
  :severity="editor.isActive('bold') ? 'primary' : 'secondary'"
  aria-label="Bold"
  @click="editor.chain().focus().toggleBold().run()"
>
  <iconify-icon icon="mdi:format-bold" width="18" height="18" aria-hidden="true" />
</Button>
```

In light mode, `severity="primary"` on a text Button renders with the navy color. In dark mode, it renders with amber. This provides clear active-state visual differentiation without adding custom CSS.

#### BubbleMenu (Mobile + Desktop Selection)

Appears above any text selection. Contains Bold, Italic, and Link only (no headings — too wide for a mobile bubble).

```html
<BubbleMenu v-if="editor" :editor="editor">
  <!-- identical Button pattern as toolbar, severity driven by isActive -->
  <Button text size="small" :severity="editor.isActive('bold') ? 'primary' : 'secondary'"
          aria-label="Bold" @click="editor.chain().focus().toggleBold().run()">
    <iconify-icon icon="mdi:format-bold" width="18" height="18" aria-hidden="true" />
  </Button>
  <Button text size="small" :severity="editor.isActive('italic') ? 'primary' : 'secondary'"
          aria-label="Italic" @click="editor.chain().focus().toggleItalic().run()">
    <iconify-icon icon="mdi:format-italic" width="18" height="18" aria-hidden="true" />
  </Button>
  <Button text size="small" :severity="editor.isActive('link') ? 'primary' : 'secondary'"
          aria-label="Insert link" @click="promptLink()">
    <iconify-icon icon="mdi:link-variant" width="18" height="18" aria-hidden="true" />
  </Button>
</BubbleMenu>
```

BubbleMenu import: `import { BubbleMenu } from '@tiptap/vue-3/menus'` — NOT from `@tiptap/vue-3` (Tiptap v3 breaking change; see RESEARCH.md Pitfall 1).

BubbleMenu background: uses PrimeVue surface defaults (Aura Drawer/Dialog surface). In dark mode, add to wallecx-overrides.css:

```css
.tippy-box,
.floating-ui-bubble-menu {
  background: var(--color-surface-card);
  border: 1px solid var(--color-surface-divider);
  border-radius: 6px;
}
```

Exact class name depends on Floating UI's generated wrapper; scope to `.my-app-dark` wrapper.

#### Link Prompt

When the Link toolbar button is tapped and no link is active: `window.prompt('Enter URL:')` for v1 (simplest viable). If a link mark is active at cursor, toggle it off. Link extension configured with `openOnClick: false` and `protocols: ['http', 'https']` (XSS mitigation from RESEARCH.md security section).

#### Editor Wrapper aria

```html
<div aria-label="Note body" role="textbox" aria-multiline="true">
  <EditorContent :editor="editor" />
</div>
```

---

### 4. Notes Tab — WallecxApp.vue Registration

**Tab entry (6th tab):**

```html
<Tab value="notes">
  <iconify-icon icon="mdi:note-text-outline" width="16" height="16" aria-hidden="true" />
  Notes
</Tab>
```

Position: after "Groups" (currently the 5th tab). The `wallecx-main-tabs` CSS already handles horizontal overflow via `overflow-x: auto` on narrow screens (the `.p-tablist` sticky rule in `wallecx-overrides.css` handles positioning). No additional CSS needed for the 6th tab — PrimeVue Tabs scrolls the tab strip natively.

**Tab panel:**

```html
<TabPanel value="notes">
  <Suspense>
    <NotesTab />
    <template #fallback>
      <WallecxSkeleton variant="note-row" :count="3" />
    </template>
  </Suspense>
</TabPanel>
```

**ACTION_TAB_MAP entry:**

```typescript
'open-notes': 'notes',
```

---

## Copywriting Contract

All copy is specific and production-ready. No placeholder text.

| Element | Copy |
|---------|------|
| Tab label | Notes |
| Empty state heading | No notes yet. |
| Empty state CTA button | Write your first note |
| Create button label (top bar) | New note |
| Delete confirmation header | Delete note? |
| Delete confirmation message | "{title}" will be permanently deleted. |
| Delete confirm button | Delete |
| Delete cancel button | Cancel |
| Auto-save: idle | *(empty — nothing shown)* |
| Auto-save: pending | *(empty — nothing shown)* |
| Auto-save: saving | Saving… |
| Auto-save: saved | Saved |
| Auto-save: error | Save failed — tap to retry |
| Editor placeholder | Start writing… |
| Title input placeholder | Note title |
| Dialog title — create | New Note |
| Dialog title — edit | Edit Note |
| Dirty-state guard header | Discard changes? *(BaseMobileDialog default — do not override)* |
| Dirty-state guard message | Your unsaved changes will be lost. *(BaseMobileDialog default — do not override)* |
| Dirty-state discard button | Discard *(BaseMobileDialog default)* |
| Dirty-state keep button | Keep editing *(BaseMobileDialog default)* |
| Loading attachment text | Loading… *(WallecxSkeleton attachment variant — not used in notes)* |
| Note "untitled" fallback | Untitled *(shown in card title if note.title is empty string)* |
| Delete success toast | Note deleted. |
| Delete error toast | Failed to delete note. |
| Load error toast | Failed to load notes. |

---

## Interaction Contracts

### Auto-Save Trigger

- Debounce delay: **1000ms** (sourced from RESEARCH.md Pattern 7 and Assumption A3).
- Trigger: Tiptap `onUpdate` callback (fires on every content change) calls `autoSave.trigger()`.
- `trigger()` sets status to `'pending'`, queues the debounced save.
- On debounce flush: status → `'saving'`, PocketBase write executes, status → `'saved'` or `'error'`.
- On dialog close (`onBeforeUnmount`): call `debouncedSave.flush()` to force an immediate save before unmount (prevents last-keystroke data loss — RESEARCH.md Pitfall 7).
- `setContent(content, false)` on load to prevent auto-save firing on programmatic load (RESEARCH.md Pitfall 2).

### Note Open Flow

1. User taps anywhere on a note card (except the delete button).
2. `openManage(note)` sets `manageRecord` and `showManage = true`.
3. `ManageNote.vue` mounts with `isNew = false`, pre-populates title and editor content.
4. `BaseMobileDialog` renders as bottom Drawer (mobile) or centered Dialog (desktop, 40vw width, 960px/75vw breakpoint, 641px/92vw breakpoint — inherits BaseMobileDialog defaults).

### Create Flow

1. User taps "New note" button.
2. `openManage(null)` sets `manageRecord = null` and `showManage = true`.
3. `ManageNote.vue` mounts with `isNew = true`, empty title and empty editor.
4. On first auto-save: creates the record via `pb.collection('kaheeta_notes').create()`, then `Object.assign(record.value, serverRecord)` to capture the server-assigned `id` for subsequent saves (RESEARCH.md Pitfall 4).

### Delete Flow

1. User taps delete icon on a card.
2. `requestDelete(note)` calls `useConfirm().require({ ... })`.
3. PrimeVue `<ConfirmDialog />` (already present in WallecxApp.vue template) renders the confirmation.
4. On "Delete" accept: `pb.collection('kaheeta_notes').delete(note.id)`, then `notes.value = notes.value.filter(n => n.id !== note.id)`.
5. Success: `toast.success('Note deleted.')`. Failure: `toast.error('Failed to delete note.')`.

### Editor BubbleMenu

- Appears on any non-empty text selection, on both mobile and desktop.
- Contains Bold, Italic, Link — 3 buttons only (compact enough for narrow mobile).
- Disappears when selection is collapsed (cursor only).
- Positioned by Floating UI (part of `@floating-ui/dom` — required peer dep of Tiptap v3 BubbleMenu).

### iOS Keyboard Handling

- The Tiptap toolbar is positioned above `<EditorContent>`, inside the scrollable Drawer content.
- `BaseMobileDialog`'s `onFocusin` handler calls `scrollIntoView({ block: 'center', behavior: 'smooth' })` when the editor gains focus, keeping the cursor above the iOS keyboard.
- Additionally, `visualViewport` resize listener sets bottom padding on the editor container to prevent the keyboard from covering content (RESEARCH.md Pattern 8). Implementation: `editorContainerStyle = 'padding-bottom: ${keyboardHeight}px'`.
- The `visualViewport` listener is added in `onMounted` and removed in `onUnmounted`.

### Tab Strip Overflow (6th Tab)

The existing `wallecx-overrides.css` sticky tablist rule applies `clip-path: inset(0)` and the PrimeVue Tabs component handles horizontal scrolling natively via its built-in nav-button mechanism. No additional CSS is needed for the 6th tab. Verify at implementation that the tab strip does not overflow; if nav scroll buttons appear on narrow devices, confirm they are styled correctly by the existing `.my-app-dark .wallecx-root .p-tablist-nav-button` rule.

### Tiptap Editor Lifecycle in BaseMobileDialog

- Place `<NoteEditor>` inside a `v-if="visible"` guard to force true mount/unmount when the dialog opens/closes. This guarantees `useEditor` cleanup runs via its internal `onBeforeUnmount` hook (RESEARCH.md Open Question 3).
- `BaseMobileDialog` uses PrimeVue `<Drawer>` which may use `v-show` internally; the explicit `v-if` on `NoteEditor` prevents editor memory leaks.

---

## Dark Mode Contract

All rules go in `src/assets/wallecx-overrides.css` under `.my-app-dark`. Scoped to prevent global leakage.

### Note Cards

```css
/* Note cards inherit .my-app-dark .p-card rule already in wallecx-overrides.css:
   --p-card-background: var(--color-surface-card-2) → #0e3360
   --p-card-border-color: var(--color-surface-divider) → rgba(255,255,255,0.08)
   No additional rule needed if note cards use <Card> component.
   If note cards use a plain <div>, add: */
.my-app-dark .note-card {
  background: var(--color-surface-card-2);
  border-color: var(--color-surface-divider);
}
```

### ProseMirror Editor

```css
.my-app-dark .ProseMirror {
  background: var(--color-surface-card);
  color: var(--color-typo-body);
  caret-color: var(--color-brand-accent); /* amber cursor in dark mode */
}

.my-app-dark .ProseMirror h1,
.my-app-dark .ProseMirror h2,
.my-app-dark .ProseMirror h3 {
  color: var(--color-typo-heading); /* #ffffff in dark */
}

.my-app-dark .ProseMirror p.is-editor-empty:first-child::before {
  color: var(--color-typo-muted); /* placeholder text color */
}

.my-app-dark .ProseMirror a {
  color: var(--color-typo-link); /* #e89820 amber */
}
```

### Editor Toolbar Buttons (Active State)

Dark-mode active state is handled by PrimeVue Aura's `severity="primary"` button token inversion (amber in dark). No custom CSS needed.

### Auto-Save Status Text

```css
/* Covered by color token application in the component.
   --color-typo-muted (#8095af dark), --color-status-success (#1a7c45),
   --color-status-error (#c0392b) are theme-independent or already dark-overridden
   in base.css. No additional wallecx-overrides.css rule needed. */
```

### BubbleMenu Bubble

```css
.my-app-dark .tiptap-bubble-menu,
.my-app-dark [data-tippy-content],
.my-app-dark .floating-ui-bubble {
  background: var(--color-surface-card-2);
  border: 1px solid var(--color-surface-divider);
  border-radius: 6px;
}
```

Note: The exact selector for the BubbleMenu floating container depends on the Floating UI wrapper class generated by Tiptap v3. Identify at implementation time by inspecting the rendered DOM and refine this selector. The background must be `var(--color-surface-card-2)` (`#0e3360`) so it reads as lifted above the drawer surface (`#0a2c52`).

---

## Accessibility Contract

All contracts must be verified during implementation, not assumed.

| Element | Requirement | Implementation |
|---------|------------|----------------|
| Note list container | `aria-busy="true"` while loading | Apply to the list wrapper div; remove when `isLoading` is false |
| Note card (clickable area) | Role implied by `cursor-pointer` div; add `role="button"` + `tabindex="0"` + `@keydown.enter` to support keyboard open | Each card div |
| Delete icon button | `aria-label="Delete note"` | On `<Button>` element |
| Title `<InputText>` | `aria-label="Note title"` | On `<InputText>` element |
| Editor content wrapper | `aria-label="Note body"` + `role="textbox"` + `aria-multiline="true"` | Div wrapping `<EditorContent>` |
| BubbleMenu Bold button | `aria-label="Bold"` | On each `<Button>` in BubbleMenu |
| BubbleMenu Italic button | `aria-label="Italic"` | On each `<Button>` in BubbleMenu |
| BubbleMenu Link button | `aria-label="Insert link"` | On each `<Button>` in BubbleMenu |
| Auto-save status span | `aria-live="polite"` + `aria-atomic="true"` | On the status text span in dialog header |
| Empty state icon | `aria-hidden="true"` | On `<iconify-icon>` decorative icon |
| Tab icon in WallecxApp | `aria-hidden="true"` | On `<iconify-icon>` in `<Tab>` |
| Loading skeleton | `aria-busy="true"` on container | On the div wrapping `<WallecxSkeleton>` |
| Minimum touch target | 44px min-width and min-height | Inherited from `.wallecx-root .p-button.p-button-icon-only` rule in wallecx-overrides.css |
| Tab touch target | 44px min-height | Inherited from `.wallecx-main-tabs .p-tab` rule in wallecx-overrides.css |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable (project uses PrimeVue, not shadcn) |
| Third-party registries | none | not applicable |
| npm packages (Tiptap v3) | All 8 packages audited in RESEARCH.md | slopcheck [OK] — no postinstall scripts, no flagged patterns. View passed 2026-06-30. |

No third-party component registries are used. All new UI code is hand-authored following existing project patterns.

---

## Pre-Population Sources

| Source | Decisions Used |
|--------|---------------|
| `src/assets/base.css` | All color tokens (60+ values extracted verbatim) |
| `src/assets/wallecx-overrides.css` | Touch-target floor (44px), dialog height (85dvh), sticky tablist, iOS safe-area padding, dark surface rules |
| `src/main.ts` | PrimeVue Aura preset, navy #002244 / amber #E89820 primary scale |
| `src/components/wallecx/WallecxApp.vue` | Tab registration pattern, ACTION_TAB_MAP, Suspense + WallecxSkeleton fallback |
| `src/components/wallecx/BaseMobileDialog.vue` | Props contract (title, isDirty, isSaving), dirty-guard copy (hardcoded), header slot structure |
| `src/components/wallecx/WallecxSkeleton.vue` | Existing variants, note-row variant pattern (mirrors expense-row) |
| `src/components/wallecx/MembershipsTab.vue` | Empty-state layout, Add button pattern, card grid pattern |
| `src/components/wallecx/KaheetaNavBar.vue` | Tab icon size (16x16), font-weight patterns, color variable usage |
| `01-RESEARCH.md` | Auto-save delay (1000ms), BubbleMenu import path, setContent emitUpdate:false, Object.assign id-refresh, generateText snippet, all anti-patterns |
| `REQUIREMENTS.md` | NOTE-01 through NOTE-04, LIST-01, LIST-02, NAV-01 — all Phase 1 requirements |
| `STATE.md` | Locked decisions: Tiptap, flat list, plaintext CRUD in Phase 1 |

User input required: 0 decisions (all pre-populated from upstream artifacts and live codebase).

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS (FLAG: `--color-typo-link` amber — add to table at implementation if needed)
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-06-30
