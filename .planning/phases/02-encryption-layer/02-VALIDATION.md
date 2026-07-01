---
phase: 2
slug: encryption-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-01
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.x (jsdom env; `window.crypto.subtle` available, no polyfill) |
| **Config file** | vitest config in `vite.config.ts` (existing) |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test file>`
- **After every plan wave:** Run `npx vitest run` + `npx vue-tsc --build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-xx | 01 | 1 | ENC-01/03 | T-02-* | encrypt→decrypt round-trip returns original JSON | unit | `npx vitest run src/lib/wallecx/notesCrypto.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-xx | 01 | 1 | ENC-01 | T-02-* | wrong key throws OperationError (no plaintext leak) | unit | `npx vitest run src/lib/wallecx/notesCrypto.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-xx | 01 | 1 | ENC-03 | — | legacy plaintext body falls back without crash | unit | `npx vitest run src/lib/wallecx/notesCrypto.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-xx | 02 | 2 | ENC-02 | T-02-* | PBKDF2 uses user.id (not token); key cached per session | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 2-03-xx | 03 | 2 | ENC-01/03 | T-02-* | ManageNote encrypts body+snippet before write; decrypts on load | unit/manual | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/wallecx/notesCrypto.test.ts` — round-trip, wrong-key OperationError, legacy-plaintext fallback, large-body (>65KB) Base64 stubs for ENC-01/02/03
- [ ] No framework install needed — vitest + jsdom already present; `window.crypto.subtle` confirmed working in the test env

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `body` field in PocketBase shows ciphertext, not plaintext | ENC-01 | Requires live PocketBase + Admin UI inspection | Create/edit a note, open kaheeta_notes record in Admin UI, confirm body + snippet are Base64 ciphertext |
| Note decrypts transparently on reopen | ENC-03 | Requires live round-trip through the backend | Reopen an encrypted note; body renders original rich text with no prompt |
| No second password prompt anywhere | ENC-02 | UX assertion across the flow | Full create→edit→reopen flow shows no passphrase/password prompt |
| Legacy Phase 1 plaintext note opens without crash | ENC-03 | Requires a pre-existing plaintext record | Open a note created before encryption; confirm it renders and re-saves as ciphertext |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
