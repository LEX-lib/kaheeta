# Milestones — Kaheeta Notes

## v1.0 — Notes (shipped 2026-07-02)

**Delivered:** A private, end-to-end-encrypted notes feature inside the Kaheeta wallet app — create/edit/delete rich-text notes that are AES-GCM encrypted client-side before they ever reach PocketBase, with instant title search, explicit manual save + draft recovery, and a correctly-rendering editor.

**Stats:** 5 phases · 13 plans · timeline 2026-05-27 → 2026-07-02 (~5 weeks) · git range `878b31b` → `995a6c0`.

**Requirements:** 12 v1 requirements delivered (NOTE-04 superseded by EDIT-01), plus EDIT-01/EDIT-02 (Phase 4) and Phase 5 editor-visuals polish. 0 outstanding.

### Key Accomplishments

1. **Core Notes CRUD (Phase 1)** — Tiptap v3 rich-text editor with toolbar/BubbleMenu, flat last-modified-sorted list with delete confirmation, reachable from the wallet nav + PWA shortcut.
2. **Client-side encryption (Phase 2)** — Every note body + snippet AES-GCM (256-bit) encrypted in-browser before write and decrypted on read; key derived from the user session via PBKDF2 + per-user salt (no second password); lazy plaintext migration for legacy notes. Server stores only ciphertext.
3. **Instant title search (Phase 3)** — Pure `filterNotesByTitle` helper wired into a PrimeVue search input; case-insensitive, client-side, no server round-trip.
4. **Manual save + draft recovery (Phase 4)** — Replaced transparent auto-save with explicit dirty-gated Save; unsaved edits continuously written to localStorage as AES-encrypted drafts with a Restore/Discard prompt on reopen. Code review fixed 3 async-flush/race blockers.
5. **Editor visual correctness (Phase 5)** — Added numbered lists (`@tiptap/extension-ordered-list`), restored bullet/numbered/nested list markers + indentation over Tailwind v4 preflight, heading/paragraph rhythm, and an always-visible amber caret in both themes; snippet generation extracted to a pure tested `noteSnippet.ts` (also fixed a latent ordered-list crash).

### Quality Gates

- Every phase verified (VERIFICATION `passed`); human UAT approved on Phases 3, 4, and 5 (both themes for Phase 5).
- Full suite: 149 tests green; type-check clean.
- Code review run on Phases 4 & 5 (Phase 4: 3 blockers + 4 warnings fixed; Phase 5: 0 blockers).

### Known Deferred Items (acknowledged at close)

- Phase 03 & 04 `HUMAN-UAT.md` files remain with status `passed` / 0 pending scenarios (audit-open flags them; no real gap).
- **WR-01** — dead placeholder CSS in `wallecx-overrides.css`; `@tiptap/extension-placeholder` not installed. Deferred to a future editor-enhancement phase.
- v2 candidates carried forward: full-text body search, pin/tags/folders, note↔record cross-linking, word count, richer editor blocks (blockquote/code/hr, task lists, tables, images).

### Notable Process Notes

- Two GSD write-verb corruptions were caught and recovered this cycle: `gsd-sdk state.*` corrupting STATE.md (edited by hand thereafter) and the `plan-phase` commit truncating ROADMAP.md 199→16 lines (restored from git). Planning files are maintained by hand in this repo.

---
*Milestones log started: 2026-07-02*
