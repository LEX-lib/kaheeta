**UI hint:** yes

**Plans:** 3 plans

Plans:
**Wave 1** *(parallel — no shared files)*
- [ ] 05-01-PLAN.md — OrderedList extension + numbered-list toolbar button in NoteEditor.vue; extract snippet generation into a pure tested `noteSnippet.ts` (includes OrderedList) + Vitest round-trip; rewire ManageNote.vue [D-01]
- [ ] 05-02-PLAN.md — Editor CSS in wallecx-overrides.css: list markers/indent (bullets + numbers + nesting), heading/paragraph vertical rhythm, and a global amber caret visible in both themes [D-02, D-03]

**Wave 2** *(depends on 05-01 + 05-02)*
- [ ] 05-03-PLAN.md — Automated gate (vitest + type-check) then blocking human visual UAT of lists, typography, caret, and no-regression in both light and dark themes [D-01, D-02, D-03]

---

*Roadmap created: 2026-06-30*
*Last updated: 2026-07-01 — Phase 5 planned: 3 plans (05-01 OrderedList+snippet, 05-02 editor CSS in parallel Wave 1 → 05-03 human visual UAT Wave 2). Hardens NOTE-01/NOTE-02; implements D-01 lists, D-02 typography, D-03 amber caret.*
