---
phase: 02-encryption-layer
reviewed: 2026-07-01T02:12:26Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - src/lib/wallecx/notesCrypto.ts
  - src/lib/wallecx/notesCrypto.test.ts
  - src/composables/useNotesCrypto.ts
  - src/types/wallecx/notes/types.d.ts
  - src/components/wallecx/ManageNote.vue
  - src/components/wallecx/NotesTab.vue
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
resolved:
  - WR-01  # in-flight promise cache + create-race convergence; regression tests added
  - WR-03  # decryptBody contract clarified (any error = fall back); test added
deferred:
  - WR-02  # string-interpolated PB filter → pb.filter() (low risk, server PK)
  - WR-04  # no ciphertext-size bound before write
  - IN-01
  - IN-02
  - IN-03
  - IN-04
  - IN-05
  - IN-06
---

> **Resolution note (post-review):** Both highest-priority warnings fixed immediately.
> WR-01 — `useNotesCrypto` now caches the in-flight derivation PROMISE (not just the
> resolved key), so concurrent first-calls share one salt bootstrap; a rejected promise
> is cleared for retry; and `getOrCreateSalt` converges on the winner's salt if a
> create() races the Unique constraint (400/409). WR-03 — `decryptBody`'s contract is
> now explicit that it rejects for ANY non-ciphertext input (atob InvalidCharacterError
> as well as OperationError) and callers must not narrow their catch. Regression tests
> added: 3 lifecycle tests in `useNotesCrypto.test.ts` (dedup, create-race convergence,
> retry-after-failure) + a WR-03 non-Base64 reject test. 100/100 suite green, vue-tsc
> clean. WR-02, WR-04, and the 6 info items triaged to backlog per the phase-close decision.

# Phase 2: Code Review Report

**Reviewed:** 2026-07-01T02:12:26Z
**Depth:** deep
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 2 adds transparent client-side AES-GCM-256 encryption to note bodies and snippets. The cryptographic core (`notesCrypto.ts`) is well-constructed and adheres to the locked decisions: fresh 12-byte IV per encrypt via `crypto.getRandomValues` (D-07), IV prepended and recovered correctly, loop-based Base64 to survive >65 KB bodies (D-08), key material is `auth.user.id` and never `pb.authStore.token` (D-01), and `decryptBody` deliberately lets its error propagate so callers own the D-10 fallback. No BLOCKER-class cryptographic defects were found — no IV reuse, no static key, no plaintext leak path, no downgrade-to-plaintext-on-write.

The defects that exist are concentrated in the **stateful glue** around the crypto, not the crypto itself:

- A genuine **concurrency race in `getOrDeriveKey`/`getOrCreateSalt`** that can create duplicate settings records (unique-constraint rejection) and/or run PBKDF2 twice (WR-01).
- **PocketBase filter string interpolation** of `userId` in two places — low real-world exploitability because the value is a server-assigned PK, but it violates the project's data-layer safety expectations and should use `pb.filter()` (WR-02).
- The **D-10 fallback contract is documented as "OperationError propagates"** but in the common legacy-plaintext case the thrown error is actually a `DOMException: InvalidCharacterError` from `atob()`, not `OperationError`. Callers catch broadly so behavior is correct, but the documented/tested contract is imprecise and brittle (WR-03).
- **No defensive bound on ciphertext size before write** now that `kaheeta_notes.snippet` max was raised to unlimited (WR-04).

Accepted design boundaries (NOT defects, noted for completeness): `title` remains plaintext (D-04 / out of scope); PBKDF2 at 200k iterations vs OWASP 600k (A2, documented); key is derivable by a privileged operator with DB + source (D-04 no-second-password tradeoff).

## Warnings

### WR-01: Race between concurrent `getOrDeriveKey` calls can create duplicate settings records and double-run PBKDF2

**File:** `src/composables/useNotesCrypto.ts:44-105`
**Issue:** `getOrDeriveKey` guards on `cachedKey`, but the guard is checked and set with an `await` boundary in between (lines 93, 102-104). If two callers invoke `getOrDeriveKey()` before the first `deriveKey` resolves — e.g. `NotesTab.decryptSnippets` and a `ManageNote` mount racing on a deep-link / restored-dialog scenario, or any future eager caller — both observe `cachedKey === null` and both proceed to `getOrCreateSalt`.

Inside `getOrCreateSalt` (lines 44-77), on a first-write user both calls hit the 404 path, both generate a *different* random salt, and both call `.create({ user, ... })`. The collection's `user` field is **Unique** (per 02-02 setup), so the second `create` rejects with a `ClientResponseError`. That rejection is not handled inside `getOrCreateSalt` and propagates out of `getOrDeriveKey`. Worse, the two callers may derive keys from two *different* salts before one create fails — a transient window where a note could be encrypted under a salt that never persists, producing an undecryptable note.

Even in the happy path (existing salt), two concurrent first-calls run PBKDF2 twice (200k iterations each), defeating D-03's "derive once" intent.

**Fix:** Cache the in-flight *promise*, not just the resolved key, so concurrent callers share one derivation:
```typescript
let cachedKey: CryptoKey | null = null;
let derivePromise: Promise<CryptoKey> | null = null;

async function getOrDeriveKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  if (derivePromise) return derivePromise;

  const userId = auth.user?.id;
  if (!userId) throw new Error("Not authenticated");

  derivePromise = (async () => {
    const salt = await getOrCreateSalt(userId);
    cachedKey = await deriveKey(userId, salt);
    return cachedKey;
  })();
  try {
    return await derivePromise;
  } catch (e) {
    derivePromise = null; // allow retry after a transient failure
    throw e;
  }
}
```
Also clear `derivePromise = null` alongside `cachedKey = null` in the `onChange` logout handler (line 31-35) and in `clearKey` (line 108-110), otherwise a stale rejected/resolved promise could be re-served after logout.

### WR-02: PocketBase filter built via string interpolation of `userId` (data-layer injection pattern)

**File:** `src/composables/useNotesCrypto.ts:49`, `src/components/wallecx/NotesTab.vue:46`
**Issue:** Both filters interpolate a raw value into the PocketBase filter DSL:
```typescript
.getFirstListItem<UserSettings>(`user = '${userId}'`)          // useNotesCrypto.ts:49
filter: `user = '${auth.user?.id ?? ''}'`                       // NotesTab.vue:46
```
In practice `auth.user.id` is a server-assigned 15-char alphanumeric PK, so this is low-exploitability today. But it is exactly the injection-prone pattern the PocketBase SDK's `pb.filter()` binding API exists to prevent: a single unescaped quote in the interpolated value would break the filter or alter its semantics. Relying on "the id can't contain a quote" is an implicit trust assumption that will silently become a hole if this pattern is copied to a user-controlled field (e.g. Phase 3 title search).

**Fix:** Use the SDK's parameter binding:
```typescript
// useNotesCrypto.ts
.getFirstListItem<UserSettings>(pb.filter("user = {:uid}", { uid: userId }))

// NotesTab.vue
filter: pb.filter("user = {:uid}", { uid: auth.user?.id ?? '' }),
```

### WR-03: D-10 fallback relies on catching `atob` `InvalidCharacterError`, not the documented `OperationError`

**File:** `src/lib/wallecx/notesCrypto.ts:74-80`, `src/lib/wallecx/notesCrypto.test.ts:57-63`, `src/components/wallecx/ManageNote.vue:79-84`
**Issue:** The module header (lines 9-10) and `decryptBody`'s doc comment (lines 70-72) state the fallback contract as "`decryptBody` lets **OperationError** propagate so callers own the legacy-plaintext fallback." But for a typical Phase 1 legacy body such as `{"type":"doc",...}`, execution never reaches `subtle.decrypt`. `base64ToUint8` (line 75 → 97) calls `atob("{\"type\"...")`, and `{`, `"`, `:`, space, `}` are not valid Base64 characters, so `atob` throws a `DOMException: InvalidCharacterError` first.

The test at `notesCrypto.test.ts:58-62` asserts only `.rejects.toThrow()` — it passes for *either* error type and therefore does not actually verify the "OperationError" wording. The consuming `catch {}` blocks in `ManageNote.vue` (line 81) and `NotesTab.vue` (line 31) are bare and catch anything, so runtime behavior is correct today. The risk is contract drift: a future maintainer reading the comment might narrow a catch to `if (e.name === 'OperationError')`, which would then let legacy notes crash the component (the exact WR-01-from-Phase-1 regression this phase was meant to close). A legacy body that *happens* to be valid Base64 would instead fail GCM auth and throw `OperationError`, so both error types occur in practice.

**Fix:** Correct the doc/comment to state that decrypt rejects with *either* `OperationError` (auth failure) *or* `InvalidCharacterError` (non-Base64 legacy input), and that callers must catch broadly. Add a test asserting the specific behavior for a non-Base64 legacy body (e.g. assert the error is caught and the fallback path yields the raw plaintext), so the contract is pinned rather than implied.

### WR-04: No defensive upper bound on ciphertext size before write (snippet `max` was relaxed to unlimited)

**File:** `src/components/wallecx/ManageNote.vue:104-123`; schema change per `02-03-SUMMARY.md:52`
**Issue:** To fit encrypted snippets, the operator raised `kaheeta_notes.snippet` `max` from 150 to `0` (unlimited), and `body` was already unbounded. The plaintext snippet is still capped via `.slice(0, 150)` (line 108), but `body` is `JSON.stringify(editorContent.value)` with no client-side bound (line 114) and is now written to a field with no server-side length constraint. A pathological or programmatically-inflated Tiptap document therefore has no guardrail at any layer before the encrypt + Base64 (which inflates size ~1.37x) + PocketBase write. This is primarily a robustness/DoS-surface concern rather than a correctness bug, but the removed `max: 150` eliminated the only backstop that previously existed.

**Fix:** Add a defensive plaintext-size check in `saveFn` before encrypting, surfacing a toast and aborting the save if `plainBody.length` exceeds a sane ceiling (e.g. 1 MB), rather than silently attempting to persist an arbitrarily large ciphertext:
```typescript
const plainBody = JSON.stringify(editorContent.value)
if (plainBody.length > 1_000_000) {
  toast.error('This note is too large to save.')
  return
}
```

## Info

### IN-01: `IV_LENGTH` is exported but unused by any consumer

**File:** `src/lib/wallecx/notesCrypto.ts:101`
**Issue:** `export { SALT_LENGTH, IV_LENGTH }` (and the `export` keyword is also redundant with the named re-export). `SALT_LENGTH` is consumed by `useNotesCrypto.ts:17`, but `IV_LENGTH` has no external consumer — it is only used internally. Dead export surface.
**Fix:** Drop `IV_LENGTH` from the public export list; keep it module-private.

### IN-02: Duplicated Tiptap extension list between `NoteEditor.vue` and `ManageNote.vue`

**File:** `src/components/wallecx/ManageNote.vue:106` vs `src/components/wallecx/NoteEditor.vue:33-45`
**Issue:** `saveFn` re-lists the extension array passed to `generateText` (`[Document, Paragraph, Text, Bold, Italic, Heading, BulletList, ListItem, Link, HardBreak]`) while `NoteEditor.vue` owns the canonical editor schema (same nodes plus `History`, with `Heading`/`Link` configured). The two lists must stay in sync or `generateText` will throw "Unknown node type" for any node the editor produces but the snippet list omits. They currently agree on node/mark types (History adds no schema nodes), so no runtime break today — but this is a maintenance trap.
**Fix:** Export a single shared `snippetExtensions`/`noteExtensions` array from a common module and import it in both places.

### IN-03: Body/snippet derive from inconsistent source expressions in `saveFn`

**File:** `src/components/wallecx/ManageNote.vue:103-114`
**Issue:** The snippet is generated from `rawContent = editorContent.value ?? { type: 'doc', content: [] }` (line 103), but the body is `JSON.stringify(editorContent.value)` (line 114) — the null-coalescing default is applied to one path but not the other. For a null editor state this yields `body = "null"` while the snippet is generated from an empty doc. Round-trips correctly (`JSON.parse("null")` → `null`), so not a bug, but the asymmetry is confusing and invites a future divergence.
**Fix:** Compute `rawContent` once and use it for both: `const plainBody = JSON.stringify(rawContent)`.

### IN-04: `getOrCreateSalt` decodes Base64 inline instead of reusing the `base64ToUint8` helper

**File:** `src/composables/useNotesCrypto.ts:59`
**Issue:** `Uint8Array.from(atob(existing.note_encryption_salt), (c) => c.charCodeAt(0))` reimplements exactly what `base64ToUint8` (exported from `notesCrypto.ts:96`) already does. Encoding uses the shared `uint8ToBase64` helper (line 64) but decoding does not — inconsistent.
**Fix:** Import and use `base64ToUint8` for the decode to keep the Base64 codec in one place.

### IN-05: `getOrCreateSalt` does not validate that the stored salt decodes to `SALT_LENGTH` bytes

**File:** `src/composables/useNotesCrypto.ts:58-60`
**Issue:** Any non-empty `note_encryption_salt` string is accepted and fed to PBKDF2. A truncated, corrupted, or manually-edited settings record would derive a key from a malformed salt, silently producing an unusable key (all notes then fail to decrypt with no diagnostic). PBKDF2 accepts any-length salt, so there is no natural error.
**Fix:** After decoding, assert `salt.length === SALT_LENGTH` and treat a mismatch as a bootstrap error (or regenerate), so corruption surfaces explicitly rather than as universal decrypt failure.

### IN-06: Commented-out `signup` block left in `stores/auth.ts`

**File:** `src/stores/auth.ts:23-33` (touched as a canonical reference for this phase)
**Issue:** A ~10-line commented-out `signup` function and a trailing `//, signup, logout` remain in the auth store. Dead/commented-out code. (Pre-existing, not introduced by Phase 2, but within the reviewed dependency surface.)
**Fix:** Remove the commented block, or restore it as real code if signup is planned.

---

## Notes on accepted design boundaries (not findings)

- **Title stored plaintext** — explicitly out of scope (D-04) and required for LIST-02 display / Phase 3 title search. Server operator can read titles. Known and accepted.
- **PBKDF2 = 200,000 iterations** (`notesCrypto.ts:23`) vs OWASP 2023's 600,000 — documented tradeoff (RESEARCH A2) for imperceptible first-write UX given the stable 15-char id key material. Accepted, not a defect.
- **Not zero-knowledge against a privileged operator** — the key is re-derivable from `user.id` + server-stored salt + public source (D-04). Intentional consequence of the no-second-password constraint.
- **`decryptBody` has no internal try/catch** — deliberate per D-10 so callers own the fallback. Correct as designed (see WR-03 only for the *documented error-type* precision).

---

_Reviewed: 2026-07-01T02:12:26Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
