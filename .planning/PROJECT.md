# Kaheeta

## What This Is

Kaheeta is a personal finance and life-management PWA built on Vue 3 + PocketBase. It tracks expenses, budgets, group splits, memberships, and vaccinations behind a private PocketBase auth layer. The current initiative adds a **Notes section** — an Apple Notes-style encrypted personal journal with WYSIWYG rich-text editing.

## Core Value

Users can capture private, richly-formatted notes knowing the server stores only ciphertext — their content is readable only on their own device.

## Requirements

### Validated

- ✓ Expense tracking with categories and budgets — existing
- ✓ Group expense splitting (co-member balance + export) — existing
- ✓ Membership tracking — existing
- ✓ Vaccination records — existing
- ✓ PocketBase auth layer (login, session persistence, logout) — existing
- ✓ PWA with manual update prompt — existing
- ✓ Mobile-first responsive layout (BaseMobileDialog, safe-area insets) — existing
- ✓ Dark/light theme toggle (`.my-app-dark`, Aura preset, pre-hydration script) — existing

### Active

- [ ] User can create, read, update, and delete notes
- [ ] Each note has a title and a rich-text body (WYSIWYG editor)
- [ ] Notes are displayed in a flat list, sorted by last-modified
- [ ] User can search notes by title or body content
- [ ] Note body is client-side encrypted (AES-GCM via Web Crypto API) before hitting PocketBase — server never stores plaintext
- [ ] Encryption key derived from user's session (PBKDF2) — transparent to the user, no extra password
- [ ] Notes section is accessible via the main wallet nav

### Out of Scope

- Note folders / categories — defer to v2; flat list is sufficient for personal use
- Note sharing — explicitly excluded; notes are a personal journal, never shared
- Tags — defer to v2
- Pin / favourite — defer to v2
- Cross-feature note linking (attach to expense/group) — future; build standalone first but don't block it architecturally
- Collaborative / real-time editing — excluded; personal-only

## Context

**Codebase state (from `/gsd:map-codebase`):**
- Vue 3 SPA with Vite + TypeScript (`noUncheckedIndexedAccess` strict mode)
- PrimeVue auto-imported components + Tailwind utility classes
- `<iconify-icon>` for icons (Iconify API, runtime fetch)
- `instrumentedGetFullList` wraps all PocketBase reads (perf tracking)
- `mapToUpdateX` mappers strip records to writable fields before create/update
- Feature types live in `src/types/wallecx/<feature>/types.d.ts`
- PocketBase collection prefix: `kaheeta_*` for new collections (legacy `wallecx_*` stays)

**Encryption design decision:**
Use the Web Crypto API (built into all modern browsers). On first note create, derive a 256-bit AES-GCM key from the user's PocketBase auth token via PBKDF2 + a per-user salt stored in PocketBase. Encrypt each note's body before write; decrypt after read. The user never enters a separate password. If auth token rotates, re-derive and re-encrypt — handle transparently.

**WYSIWYG editor:** **Tiptap** (`@tiptap/vue-3`). Headless architecture means the toolbar is built from existing PrimeVue Buttons — zero CSS collision with Tailwind/Aura. JSON output is ideal for encrypt-then-store. Install only needed extensions (`bold`, `italic`, `heading`, `bullet-list`, `link`) to stay ~80–90KB gzipped. Use `BubbleMenu` on iOS to avoid virtual keyboard positioning issues. Full comparison: `.planning/research/WYSIWYG-EDITORS.md`

## Constraints

- **Tech stack**: Vue 3 + Vite + TypeScript — no React, no SSR
- **Backend**: PocketBase only — no new backend services
- **Bundle size**: WYSIWYG editor must be lightweight (PWA, mobile-first)
- **Encryption**: Client-side only (Web Crypto API) — no server-side crypto dependencies
- **PocketBase collections**: New collections use `kaheeta_` prefix; never rename `wallecx_*` tables

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Client-side AES-GCM encryption | Server never sees plaintext; no backend changes needed; Web Crypto API is native to all modern browsers | — Pending |
| PBKDF2 key derivation from session token | Transparent to user (no second password); tied to auth lifecycle | — Pending |
| Flat list v1 (no folders/tags) | Minimal scope; Apple Notes users often use search over folders anyway | — Pending |
| Notes standalone section (not embedded in other features) | Reduces scope; cross-feature linking can be added later without refactoring | — Pending |
| Tiptap as WYSIWYG editor | Headless (no CSS collision), JSON output (clean for encryption), Vue 3-native, actively maintained. Quill considered but Delta format less suitable for encryption + dark-mode fight | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-30 after initialization*
