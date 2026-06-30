---
phase: 1
slug: core-notes-crud
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-30
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/lib/pocketbase/__tests__/notesMapper.spec.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/pocketbase/__tests__/notesMapper.spec.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | NOTE-01 | — | mapToUpdateNote strips id/created/updated/user/collectionId/collectionName/expand | unit | `npx vitest run src/lib/pocketbase/__tests__/notesMapper.spec.ts` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | LIST-02 | — | snippet field stored (≤150 chars plaintext) | unit | `npx vitest run src/lib/pocketbase/__tests__/notesMapper.spec.ts` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | NOTE-01 | — | NoteEditor renders EditorContent with toolbar; BubbleMenu imported from @tiptap/vue-3/menus | manual | — | — | ⬜ pending |
| 1-02-02 | 02 | 1 | NOTE-04 | — | useAutoSave: idle→pending on trigger, pending→saving after debounce, saving→saved on success | unit | `npx vitest run src/composables/useAutoSave.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | LIST-01 | — | NotesTab renders sortedNotes computed from notes ref sorted by -updated | unit | `npx vitest run -t "sorted"` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 2 | NOTE-02 | — | ManageNote opens with existing note content pre-loaded (setContent with emitUpdate:false) | manual | — | — | ⬜ pending |
| 1-03-03 | 03 | 2 | NOTE-03 | — | Delete shows useConfirm dialog; on accept removes note from list and PocketBase | manual | — | — | ⬜ pending |
| 1-03-04 | 03 | 2 | NOTE-04 | — | Auto-save flushes debounce on dialog close (useDebounceFn.flush() called in onBeforeUnmount) | unit | `npx vitest run src/composables/useAutoSave.test.ts` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 2 | NAV-01 | — | Notes tab renders in KaheetaNavBar; ?action=open-notes navigates to Notes tab | manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/pocketbase/__tests__/notesMapper.spec.ts` — covers `mapToUpdateNote` strip behavior (mirrors `membershipMapper.spec.ts` pattern): fields stripped (id, created, updated, user, collectionId, collectionName, expand), fields preserved (title, body, snippet), snippet capped at 150 chars
- [ ] `src/composables/useAutoSave.test.ts` — covers debounce timing, status transitions (idle → pending → saving → saved → error), `.flush()` on unmount fires save immediately
- [ ] `src/lib/wallecx/notesSnippet.test.ts` (optional) — covers `generateText()` round-trip: given a ProseMirror JSON doc, returns expected plaintext string

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rich-text editor renders with toolbar and BubbleMenu | NOTE-01 | DOM rendering requires browser | Open ManageNote dialog → type text → select text → verify BubbleMenu appears with bold/italic buttons |
| Opening existing note pre-loads content without triggering auto-save | NOTE-02 | Network+timer interaction | Open existing note in PocketBase Admin UI → note's `updated` timestamp must NOT change on open |
| Confirmation dialog on delete | NOTE-03 | Interaction flow | Tap delete on a note → confirm dialog appears → confirm → note removed from list and PocketBase |
| Body snippet appears in list item | LIST-02 | Visual rendering | Create a note with body text → list item shows first ~150 chars as plaintext |
| Notes tab visible in wallet nav | NAV-01 | Visual/navigation | Load app → verify Notes tab appears in KaheetaNavBar → tap → Notes list renders |
| iOS keyboard viewport handling | NOTE-01, NOTE-04 | Device-specific | On iOS Safari: open ManageNote → focus editor → keyboard appears → BubbleMenu visible above selection → toolbar not obscured |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
