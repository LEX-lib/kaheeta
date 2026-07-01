# Phase 4: Manual Save with Draft Recovery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 4-manual-save-with-draft-recovery
**Areas discussed:** Draft storage lifetime, Encrypt draft at rest, Recovery UX on reopen, Save + close behavior

---

## Draft storage lifetime

| Option | Description | Selected |
|--------|-------------|----------|
| localStorage | Survives full browser restart + accidental tab/window close. Key `kaheeta:note-draft:<id>` / `:new`. | ✓ |
| sessionStorage | Survives in-tab refresh only; cleared on tab/browser close. | |

**User's choice:** localStorage
**Notes:** Matches the goal of surviving an accidental exit, not just a refresh.

---

## Encrypt draft at rest

| Option | Description | Selected |
|--------|-------------|----------|
| Encrypt draft (same AES key) | Reuse getOrDeriveKey + encryptBody; no plaintext note content on disk; key re-derives on recovery. | ✓ |
| Plaintext JSON | Store Tiptap JSON unencrypted; simpler but readable at rest. | |

**User's choice:** Encrypt draft
**Notes:** Keeps the ciphertext-only privacy model intact even for local drafts.

---

## Recovery UX on reopen

| Option | Description | Selected |
|--------|-------------|----------|
| Prompt Restore/Discard | On open, if a newer draft exists, ask before populating the editor. | ✓ |
| Auto-restore + undo banner | Silently load draft, show dismissible "Restored — Discard" banner. | |

**User's choice:** Prompt Restore/Discard
**Notes:** Explicit choice; avoids surprise content swap.

---

## Save + close behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Keep draft; Save clears it | Explicit Save (enabled when dirty) commits + clears draft; close keeps draft with light confirm. | ✓ |
| Keep draft silently, no confirm | Same but no confirm on close; relies on reopen prompt. | |
| Discard on close unless saved | Closing drops the draft — contradicts the goal. | |

**User's choice:** Keep draft; Save clears it
**Notes:** Save is the only thing that commits + clears; closing preserves work for recovery.

---

## Claude's Discretion

- Whether to repurpose `useAutoSave` (debounce + in-flight serialization) for debounced localStorage draft writes or extract a new `useNoteDraft` composable.
- Draft-write cadence, "newer than saved" timestamp comparison, dirty-state wiring into `BaseMobileDialog`, and draft-cleanup edge cases (note deletion, `new` → `note-draft:<id>` key migration after first save).

## Deferred Ideas

- Cross-device / multi-tab draft conflict resolution — out of scope (personal, single-device app).
- Version history / multiple drafts per note — future enhancement.
- Offline save queue for failed writes — separate concern.
