# Phase 2: Encryption Layer - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning
**Source:** plan-phase decisions (post-research)

<domain>
## Phase Boundary

Transparent client-side AES-GCM (256-bit) encryption of note bodies (and snippets)
for the `kaheeta_notes` collection. Encrypt-on-write, decrypt-on-read, no change to
the user's workflow, no second password. Legacy Phase 1 plaintext notes handled
gracefully. Delivers ENC-01, ENC-02, ENC-03.

Out of scope: full-text/body search (v2 SRCH-*), any second-password / passphrase flow,
server-side encryption, cross-device key portability beyond what session-derived keys allow.
</domain>

<decisions>
## Implementation Decisions

### Key derivation (ENC-02) — LOCKED
- **D-01:** PBKDF2 key material MUST be `pb.authStore.record.id` (immutable user PK) + a per-user salt. **NEVER** `pb.authStore.token` — JWTs rotate on `authRefresh()`, which would permanently orphan all previously-encrypted notes (silent, unrecoverable data loss).
- **D-02:** Key is AES-GCM 256-bit, derived via `window.crypto.subtle.deriveKey` (PBKDF2). No new npm packages — `window.crypto.subtle` is built-in and works in the jsdom/Vitest test env.
- **D-03:** Derived `CryptoKey` is cached in a module-scoped ref for the session so PBKDF2 runs once per login, not per save.
- **D-04:** "No second password" (ENC-02) is LOCKED. Accepted consequence: a privileged server operator with DB access could re-derive the key (id + server-stored salt). Protection is real against DB-dump/backup leakage and third-party inspection, NOT zero-knowledge against the operator. This tradeoff is intentional given the no-password constraint.

### Salt storage — LOCKED
- **D-05:** Salt lives in a **new `kaheeta_user_settings` PocketBase collection** (kaheeta_ prefix per project convention), NOT a field on the shared `users` collection. One record per user. Collection rules: List/View/Create/Update all `user = @request.auth.id` (Delete not required). Do NOT modify the shared `users` collection (backend is shared with the origin delveen project).
- **D-06:** Salt is a random 16-byte value, generated once on first note write (or first settings-record creation) and persisted. PBKDF2 salt need not be secret; storing it server-side is fine.

### Wire format (ENC-01, ENC-03) — LOCKED
- **D-07:** Per-encryption 12-byte IV generated fresh via `crypto.getRandomValues` for EVERY encrypt call (never reused). IV is prepended to the ciphertext; the IV+ciphertext bytes are Base64-encoded for storage in the `body` field.
- **D-08:** Base64 encoding MUST use a loop-based `uint8ToBase64` (not spread + `btoa`) to avoid a stack overflow on bodies larger than ~65 KB. Decrypt recovers the IV from the first 12 bytes.
- **D-09:** The `snippet` field MUST also be encrypted — a plaintext 150-char preview would leak the most salient content of every note. Snippet is encrypted with the same scheme.

### Legacy migration — LOCKED
- **D-10:** **Lazy migration.** No upfront migration script. `decryptBody()` catches `OperationError` and falls back to treating the value as Phase 1 plaintext (`JSON.parse` the raw body); if that also throws, surface a `toast.error()` and do not crash. A note is silently upgraded to ciphertext the next time the user edits it. Same fallback applies to the snippet in the list view.

### Claude's Discretion
- Exact module layout of `src/lib/wallecx/notesCrypto.ts` (function signatures per ROADMAP: `deriveKey`, `encryptBody`, `decryptBody`), test structure, and how the cached key is invalidated on logout.
- Whether the `kaheeta_user_settings` read/salt-bootstrap is its own composable or folded into the crypto module.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research + prior phase
- `.planning/phases/02-encryption-layer/02-RESEARCH.md` — Web Crypto API usage, token-rotation trap, wire format, migration analysis
- `.planning/phases/01-core-notes-crud/01-01-SUMMARY.md` — Note type + notesMapper (body/snippet are the encrypted fields)
- `.planning/phases/01-core-notes-crud/01-03-SUMMARY.md` — ManageNote saveFn/load paths Phase 2 must wrap

### Integration points (existing code)
- `src/components/wallecx/ManageNote.vue` — saveFn (encrypt before write) + editorContent load (decrypt after fetch)
- `src/components/wallecx/NotesTab.vue` — list fetch; snippet decrypt for card preview
- `src/lib/pocketbase/notesMapper.ts` — write-guard; encrypted body/snippet flow through mapToUpdateNote
- `src/stores/auth.ts`, `src/lib/pocketbase/index.ts` — `pb.authStore.record.id` (key material), pb singleton

</canonical_refs>

<specifics>
## Specific Ideas

- Crypto primitives in `src/lib/wallecx/notesCrypto.ts` with `notesCrypto.test.ts` (unit-test encrypt→decrypt round-trip, wrong-key OperationError, legacy-plaintext fallback, large-body Base64).
- New `kaheeta_user_settings` collection is a `user_setup` item (documented for the operator to create in PocketBase Admin UI, like Phase 1's kaheeta_notes).
- WR-01 from Phase 1 code review (unguarded `JSON.parse(note.body)`) naturally folds into the decrypt-fallback path — resolve it here.
</specifics>

<deferred>
## Deferred Ideas

- Zero-knowledge (password-derived) encryption — ruled out by ENC-02 (no second password).
- Full-text body search over decrypted content — v2 (SRCH-01).
- Cross-device explicit key export/import — not in scope.
</deferred>

---

*Phase: 02-encryption-layer*
*Context gathered: 2026-07-01 via plan-phase decisions (post-research)*
