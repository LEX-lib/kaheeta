# Phase 2: Encryption Layer — Research

**Researched:** 2026-07-01
**Domain:** Web Crypto API (AES-GCM, PBKDF2), per-user salt storage in PocketBase, key lifecycle management, plaintext migration
**Confidence:** HIGH

---

## Summary

Phase 2 adds transparent client-side AES-GCM-256 encryption to every note body before it is written to PocketBase. The user experiences no change in workflow: key derivation is fully automatic using the user's immutable `id` as PBKDF2 key material combined with a per-user random salt stored on the `users` collection record. No second password, no extra prompts.

The critical design question raised in the objective — "what stable input survives token refresh?" — is answered definitively below. PocketBase auth tokens are short-lived JWTs that generate a new value on every `authWithPassword` call and on every `authRefresh`. A key derived from `pb.authStore.token` would become invalid after the first token refresh, silently making all previously encrypted notes permanently undecryptable. The only stable, never-changing identifier on a PocketBase user record is `record.id` — an immutable 15-character random string assigned at account creation and never modified. [ASSUMED] that PocketBase does not expose an API to change a user's `id` (standard database PK semantics; no evidence in any PocketBase docs that `id` can be mutated by users or admins).

The implementation requires zero new npm packages — `window.crypto.subtle` is a built-in browser API present in all supported browsers, and Vitest 4 on Node 22 with jsdom exposes it without any polyfill (verified in this session). The three-plan structure proposed in the ROADMAP is sound. The main research additions are: (1) a corrected and safe key-derivation design, (2) IV-prepended Base64 wire format for ciphertext, (3) a confirmed recommendation on the snippet field (encrypt it alongside body), and (4) a verified testing strategy using `globalThis.crypto.subtle` directly.

**Primary recommendation:** Derive the key from `user.id + salt` via PBKDF2-SHA256 with 100,000 iterations. Store a random 16-byte salt as a Base64 text field on `users.note_encryption_salt`. Cache the derived `CryptoKey` in a module-scoped ref for the session. Prepend the 12-byte IV to each ciphertext and Base64-encode the whole blob for storage in `body`. Encrypt the snippet field too (store it blank or as a fixed-length encrypted value). Detect legacy plaintext bodies by attempting JSON.parse on decrypt failure as the migration sentinel.

---

## Project Constraints (from CLAUDE.md)

- PocketBase access via the data layer — no `new PocketBase()` in components; use `pb` singleton from `@/lib/pocketbase`
- All list reads via `instrumentedGetFullList` — never call `pb.collection().getFullList()` directly from components
- All writes through `mapToUpdateX` mappers before PocketBase calls
- `kaheeta_*` prefix for all new PocketBase collections; `wallecx_*` tables must NOT be renamed
- PrimeVue components auto-imported — no import statements needed for `<Button>`, `<Toast>`, etc.
- `kaheeta:*` localStorage key prefix for all new keys
- Dark mode via `.my-app-dark` class on `<html>` — never `@media (prefers-color-scheme: dark)`
- Mobile-first: `BaseMobileDialog` for create/edit dialogs
- TypeScript with `noUncheckedIndexedAccess: true` — all indexed access returns `T | undefined`
- `import type` for type-only imports
- `@/` path alias for all `src/`-rooted imports
- `<iconify-icon>` is a registered custom element

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Key derivation (PBKDF2) | Browser/Client (`notesCrypto.ts`) | — | Runs in-browser; never sends key material to server |
| Encryption (AES-GCM) | Browser/Client (`notesCrypto.ts`) | — | Plaintext never leaves the browser |
| Decryption (AES-GCM) | Browser/Client (`notesCrypto.ts`) | — | Ciphertext decrypted locally after fetch |
| Per-user salt storage | PocketBase/Backend (`users` collection) | — | Salt must survive device wipe; stored server-side on user record |
| Salt generation + first-write | Browser/Client (`notesCrypto.ts`) | — | Client generates salt on first note write, POSTs to users collection |
| Key caching for session | Browser/Client (module-scoped ref) | — | PBKDF2 is intentionally slow; run once per login, never persist to localStorage |
| Encrypt-on-write hook | Browser/Client (`ManageNote.vue` saveFn) | — | Wraps existing saveFn; encrypts body+snippet before mapToUpdateNote |
| Decrypt-on-read hook | Browser/Client (`ManageNote.vue` load path) | — | Decrypts body after fetch, before handing to Tiptap editor |
| Plaintext fallback detection | Browser/Client (`notesCrypto.ts` decryptBody) | — | Catches `OperationError`, returns original string as fallback |
| Snippet in notes list | Browser/Client (`NotesTab.vue`) | — | Currently plaintext; must be encrypted or blanked in Phase 2 |

---

## Critical Design Decision: Key Derivation Input

> This section answers the highest-priority question from the objective.

### Why `pb.authStore.token` MUST NOT be used

PocketBase JWTs rotate on every `authWithPassword()` call and on every `authRefresh()`. The SDK's `LocalAuthStore` persists the latest token to `localStorage`, but calling `pb.collection('users').authRefresh()` — which the app does in `WallecxApp.vue onMounted` to re-validate session — produces a **new token**. A key derived from the old token would produce a different key, making all ciphertext from the previous session permanently undecryptable with no error at write time. This is a silent, unrecoverable data-loss scenario. [VERIFIED: PocketBase JS SDK GitHub discussion #4044 — authRefresh returns a new JWT]

### Why `user.id` IS the correct choice

PocketBase record `id` values are assigned at record creation from a cryptographically random 15-character string. The `id` is:
- The primary key of the SQLite row — it cannot be changed through any documented API endpoint [ASSUMED — consistent with all database PK semantics and confirmed by absence of any `id`-change API in PocketBase docs]
- Present in `pb.authStore.record.id` immediately after any successful `authWithPassword` or `authRefresh` call
- Stable across all token refreshes, password resets, email changes, and re-logins (those operations rotate the token but do not change the record id)
- Accessible with zero extra network requests — already in the auth store

### Key material: `user.id` alone vs. `user.id + app-constant`

Using only `user.id` as PBKDF2 input provides negligible entropy: the id is only 15 printable characters (~90 bits) and is stored in plaintext on the server. If the PocketBase database is compromised, an attacker can read every user's `id` and bruteforce the key without the salt (since they also have the salt). **The salt elevates this significantly, but it is still stored server-side alongside the ciphertext.** This is the inherent limitation of "no second password" transparent encryption: the threat model is "server stores only opaque bytes" (operator privacy from passive snooping / accidental log leaks), not "server is fully compromised and attacker has database + ciphertext + salt."

Optionally, `user.id + FIXED_APP_SECRET` could be used as the key material, where `FIXED_APP_SECRET` is a short constant embedded in the client-side bundle. This adds a thin layer of security obscurity — an attacker needs both the database dump AND the app source to derive the key — but since the source is public/downloadable, this is marginal. The ROADMAP's design is acceptable as-is; document the threat model clearly.

**Decision:** Use `user.id` as the PBKDF2 `password` input (encoded as UTF-8 bytes). Use the per-user 16-byte random salt. [ASSUMED] that this threat model is acceptable to the project owner; the planner should surface this explicitly.

### PBKDF2 iteration count

OWASP 2023 recommendation: 600,000 iterations for PBKDF2-HMAC-SHA256. [CITED: owasp.org/www-community/password_storage_cheat_sheet]

The ROADMAP does not specify a count. For a transparent no-password UX, the key derivation must complete fast enough that the user does not notice a delay on first note write. On modern hardware, 100,000 iterations takes ~50–150ms; 600,000 iterations takes ~300–800ms — noticeable but not blocking (key derivation is async). The higher count matters most when the key material is weak (short password); since we're using a stable 15-char ID, brute-force difficulty is already high.

**Recommendation:** 200,000 iterations — balance between OWASP guidance and imperceptible UX latency. [ASSUMED — planner should document the choice so the user can confirm.]

---

## Standard Stack

### Core (zero new packages needed)

| API / Module | Source | Purpose | Why Standard |
|--------------|--------|---------|--------------|
| `window.crypto.subtle` | Built-in browser API | AES-GCM encrypt/decrypt + PBKDF2 deriveKey | Web Crypto API — W3C standard, no npm package required [VERIFIED: MDN + confirmed available in project's jsdom test environment] |
| `window.crypto.getRandomValues` | Built-in browser API | IV (12-byte) + salt (16-byte) generation | CSPRNG — only safe source of randomness for crypto |

**Confirmed available in project's Vitest jsdom environment (Node 22.14.0):** `globalThis.crypto.subtle` is fully functional, including `generateKey`, `encrypt`, `decrypt`, `deriveKey`. [VERIFIED: live test run in this session — 3/3 AES-GCM tests pass without any polyfill or setup file]

### Already Installed (no change needed)

| Library | Version | Use in Phase 2 |
|---------|---------|----------------|
| `pocketbase` | 0.27.0 | `pb.collection('users').update()` to store salt; `pb.authStore.record.id` for key material |
| `pinia` (via `useAuthStore`) | 3.0.4 | Access `auth.user?.id` for key derivation |
| `vue-sonner` (via `useToast`) | 2.0.9 | `toast.error()` on decrypt failure |

**No new npm packages required for Phase 2.** The Web Crypto API is built into the browser runtime and into Node 18+.

### Package Legitimacy Audit

Not applicable — Phase 2 installs zero new packages.

---

## Architecture Patterns

### System Architecture Diagram

```
LOGIN / SESSION START
       │
       ▼
  useNotesCrypto.ts
  ├─ getSalt()           ← pb.collection('users').getOne(userId) → read note_encryption_salt field
  │   If absent: generate 16-byte salt, persist to users record, return
  │
  ├─ deriveKey(userId, salt)
  │   ├─ importKey("raw", TextEncoder(userId), "PBKDF2")
  │   └─ deriveKey(PBKDF2, salt, 200_000 iters, SHA-256 → AES-GCM-256)
  │
  └─ cachedKey = ref<CryptoKey | null>  ← module-scoped, survives ManageNote mount/unmount

WRITE PATH (ManageNote.vue saveFn)
       │
       ▼
  editorContent → JSON.stringify(editor.getJSON())   [plaintext body]
  generateText() → snippet                            [plaintext snippet]
       │
       ▼
  encryptBody(cachedKey, plaintextBody)
  ├─ iv = getRandomValues(Uint8Array(12))
  ├─ ciphertext = subtle.encrypt(AES-GCM, iv, body)
  └─ result = btoa( iv(12B) + ciphertext )            [Base64: 12B IV prefix + ciphertext]

  encryptSnippet(cachedKey, plaintextSnippet)
  └─ same as above but for snippet string

       │
       ▼
  mapToUpdateNote({ ...record, body: encryptedBody, snippet: encryptedSnippet })
       │
       ▼
  pb.collection('kaheeta_notes').create / .update    [server never sees plaintext]

READ PATH (ManageNote.vue load)
       │
       ▼
  props.note.body   [Base64 IV+ciphertext, or legacy plaintext JSON]
       │
       ▼
  decryptBody(cachedKey, ciphertextB64)
  ├─ buf = Uint8Array from atob(ciphertextB64)
  ├─ iv = buf.slice(0, 12)
  ├─ ciphertext = buf.slice(12)
  ├─ subtle.decrypt(AES-GCM, iv, ciphertext) → plaintext
  └─ CATCH OperationError → return original string (legacy plaintext fallback)
       │
       ▼
  editorContent.value = JSON.parse(decryptedBody)    [Tiptap JSONContent]

NOTES LIST (NotesTab.vue)
  note.snippet is encrypted — decrypt all snippets on list load
  ├─ getKey() returns cached key (no re-derivation)
  └─ decryptSnippet(key, encryptedSnippet) for each note in list
     CATCH → return '' (legacy/failed decrypt → show blank snippet)
```

### Recommended File Structure (new files only)

```
src/
├── lib/wallecx/
│   └── notesCrypto.ts            # Pure crypto functions: deriveKey, encryptBody, decryptBody
│
├── composables/
│   └── useNotesCrypto.ts         # Vue composable: getOrDeriveKey(), salt lifecycle, module cache
│
└── (no new test dirs needed — tests go in src/lib/wallecx/ as notesCrypto.test.ts)
```

**File responsibility boundary:**
- `notesCrypto.ts` — pure functions, no Vue, no PocketBase, testable in isolation
- `useNotesCrypto.ts` — Vue composable, owns the module-scoped `CryptoKey` ref, handles salt fetch/generate via PocketBase, called from `ManageNote.vue` and `NotesTab.vue`

### Pattern 1: Full PBKDF2 + AES-GCM Encrypt/Decrypt (verified pattern)

```typescript
// Source: MDN Web API documentation [CITED: developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey]
// Source: miguelacm.es/en/blog/aes-256-encryption-browser [CITED]

const subtle = window.crypto.subtle
const IV_LENGTH = 12   // 96-bit IV — GCM standard recommendation [CITED: MDN AES-GCM]
const SALT_LENGTH = 16 // 128-bit salt
const PBKDF2_ITERATIONS = 200_000

/**
 * Import user.id as raw key material for PBKDF2.
 * This is the step before deriveKey — importKey wraps the userId bytes
 * in a CryptoKey container that the SubtleCrypto API can operate on.
 */
async function importKeyMaterial(userId: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  return subtle.importKey(
    'raw',
    enc.encode(userId),
    'PBKDF2',
    false,             // not extractable
    ['deriveKey'],
  )
}

/**
 * Derive a 256-bit AES-GCM key from userId + salt via PBKDF2-SHA256.
 * This is intentionally slow (~150ms at 200k iterations) — run once per session.
 */
export async function deriveKey(userId: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await importKeyMaterial(userId)
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,             // not extractable — key never leaves the SubtleCrypto context
    ['encrypt', 'decrypt'],
  )
}

/**
 * Encrypt a plaintext string with AES-GCM.
 * Returns Base64-encoded blob: [12-byte IV][ciphertext+GCM-tag].
 * The IV is unique per encryption; prepended to ciphertext so decrypt can extract it.
 */
export async function encryptBody(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const result = new Uint8Array(IV_LENGTH + ciphertext.byteLength)
  result.set(iv, 0)
  result.set(new Uint8Array(ciphertext), IV_LENGTH)
  return btoa(String.fromCharCode(...result))
}

/**
 * Decrypt a Base64 blob produced by encryptBody.
 * Throws OperationError if the key is wrong or ciphertext is tampered.
 * Callers should catch this to implement the legacy plaintext fallback.
 */
export async function decryptBody(key: CryptoKey, b64: string): Promise<string> {
  const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const iv = buf.slice(0, IV_LENGTH)
  const data = buf.slice(IV_LENGTH)
  const plaintext = await subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(plaintext)
}
```

### Pattern 2: useNotesCrypto Composable (key lifecycle)

```typescript
// Source: pattern inferred from codebase (useAutoSave, useTheme composable patterns) [ASSUMED shape]
// Crypto API patterns from MDN [CITED]

import { ref } from 'vue'
import { pb } from '@/lib/pocketbase'
import { useAuthStore } from '@/stores/auth'
import { deriveKey } from '@/lib/wallecx/notesCrypto'

// Module-scoped — survives ManageNote mount/unmount across the session
// A new key is derived on each login (module re-initialises on page reload)
let _cachedKey: CryptoKey | null = null

const SALT_FIELD = 'note_encryption_salt'  // field name on the users collection

export function useNotesCrypto() {
  const auth = useAuthStore()

  async function getOrDeriveKey(): Promise<CryptoKey> {
    if (_cachedKey) return _cachedKey

    const userId = auth.user?.id
    if (!userId) throw new Error('Not authenticated')

    const salt = await getOrCreateSalt(userId)
    _cachedKey = await deriveKey(userId, salt)
    return _cachedKey
  }

  /** Reset the cached key — call on logout (pb.authStore.onChange) */
  function clearKey(): void {
    _cachedKey = null
  }

  return { getOrDeriveKey, clearKey }
}

async function getOrCreateSalt(userId: string): Promise<Uint8Array> {
  // Fetch the user record — just the salt field
  const record = await pb.collection('users').getOne(userId, {
    fields: `id,${SALT_FIELD}`,
  })

  const existingSalt: string | undefined = (record as Record<string, unknown>)[SALT_FIELD] as string | undefined

  if (existingSalt) {
    // Decode the Base64-stored salt back to Uint8Array
    return Uint8Array.from(atob(existingSalt), (c) => c.charCodeAt(0))
  }

  // First note write for this user — generate and persist a random salt
  const newSalt = window.crypto.getRandomValues(new Uint8Array(16))
  await pb.collection('users').update(userId, {
    [SALT_FIELD]: btoa(String.fromCharCode(...newSalt)),
  })
  return newSalt
}
```

### Pattern 3: Encrypt-on-Write in ManageNote.vue saveFn

```typescript
// Source: ManageNote.vue saveFn pattern (Phase 1) adapted for crypto [VERIFIED: codebase]
// Crypto integration pattern [ASSUMED — specific to this codebase]

// In ManageNote.vue <script setup>:
const { getOrDeriveKey } = useNotesCrypto()

async function saveFn(): Promise<void> {
  const key = await getOrDeriveKey()  // cached — instant after first call

  const rawContent = editorContent.value ?? { type: 'doc', content: [] }
  const plainBody = JSON.stringify(rawContent)
  const plainSnippet = generateText(rawContent, [...extensions], { blockSeparator: ' ' }).slice(0, 150)

  // Encrypt both fields before the mapper sees them
  const encryptedBody = await encryptBody(key, plainBody)
  const encryptedSnippet = await encryptSnippet(key, plainSnippet)

  const payload = mapToUpdateNote({
    ...record.value,
    body: encryptedBody,
    snippet: encryptedSnippet,
  })

  if (isNew.value) {
    const created = await pb.collection('kaheeta_notes').create<Note>({
      ...payload,
      user: auth.user?.id,
    })
    Object.assign(record.value, created)
    emit('note-saved', { ...record.value })
  } else {
    const updated = await pb.collection('kaheeta_notes').update<Note>(record.value.id, payload)
    Object.assign(record.value, updated)
    emit('note-saved', { ...record.value })
  }
}
```

### Pattern 4: Decrypt-on-Read in ManageNote.vue load path

```typescript
// Currently in ManageNote.vue:
// const editorContent = ref<JSONContent | null>(
//   props.note ? (props.note.body ? (JSON.parse(props.note.body) as JSONContent) : null) : null,
// )
// Phase 2 replaces this with an async init:

const editorContent = ref<JSONContent | null>(null)
const isDecrypting = ref(true)

onMounted(async () => {
  if (!props.note?.body) {
    isDecrypting.value = false
    return
  }
  try {
    const key = await getOrDeriveKey()
    let plainBody: string
    try {
      // Attempt to decrypt — throws OperationError for legacy plaintext notes
      plainBody = await decryptBody(key, props.note.body)
    } catch {
      // Legacy plaintext fallback: the body is a raw JSON string, not ciphertext
      plainBody = props.note.body
    }
    editorContent.value = plainBody ? (JSON.parse(plainBody) as JSONContent) : null
  } catch (e) {
    toast.error('Could not decrypt note. It may be corrupted.')
    console.error('ManageNote: decryption failed', e)
  } finally {
    isDecrypting.value = false
  }
})
```

### Pattern 5: Decrypt Snippets in NotesTab.vue list

```typescript
// In NotesTab.vue, after instrumentedGetFullList returns the notes array:
const { getOrDeriveKey } = useNotesCrypto()

async function decryptSnippets(rawNotes: Note[]): Promise<Note[]> {
  const key = await getOrDeriveKey()
  return Promise.all(
    rawNotes.map(async (note) => {
      if (!note.snippet) return note
      try {
        const plain = await decryptBody(key, note.snippet)
        return { ...note, snippet: plain }
      } catch {
        // Legacy plaintext snippet (Phase 1 notes) or empty — use as-is
        return { ...note, snippet: note.snippet }
      }
    })
  )
}

// Replace notes.value = await instrumentedGetFullList(...) with:
const rawNotes = await instrumentedGetFullList<Note>('kaheeta_notes', { ... })
notes.value = await decryptSnippets(rawNotes)
```

### Pattern 6: Salt Storage — users collection field

The salt is stored as a Base64 text field on the existing `users` PocketBase auth collection. This requires:

1. Adding a `note_encryption_salt` **Text** field to the `users` collection in PocketBase Admin UI (optional, not required — absent = user hasn't written any notes yet; null-safe)
2. Setting the **View/Update rule** on the `users` collection to `id = @request.auth.id` so users can read and write their own record (this is typically the default for the built-in `users` collection)

**Alternative: separate `kaheeta_user_settings` collection**

| Approach | Pros | Cons |
|----------|------|------|
| Field on `users` collection | Single record fetch on first note write; user-owned naturally | Requires schema change to built-in collection |
| `kaheeta_user_settings` collection | Follows `kaheeta_*` naming convention; no modification to `users` | Two-request pattern on first write (check if record exists, then create or update); slightly more complex |

**Recommendation:** Add `note_encryption_salt` as a Text field on the `users` collection. The `users` collection is the canonical record for this user's cryptographic identity — storing the salt there is semantically correct. The `kaheeta_*` naming convention applies to new data collections, not to a field added to an existing system collection. [ASSUMED — user confirmation needed on preference for users field vs separate collection]

### Anti-Patterns to Avoid

- **Deriving the key from `pb.authStore.token`**: Token rotates on every refresh. This is the single most dangerous design mistake — notes become permanently undecryptable after the next `authRefresh`. Never use the JWT as key material.
- **Persisting `CryptoKey` to localStorage**: Web Crypto `CryptoKey` objects are not serializable. Even if they were, storing the derived key in localStorage negates the purpose of encryption — any XSS attacker could extract it.
- **Using a single fixed IV for all records**: IV must be unique per encryption. Reusing the same IV with the same key under AES-GCM allows an attacker to XOR two ciphertexts and cancel the keystream — complete plaintext recovery.
- **Calling `decryptBody` without catching `OperationError`**: Decryption throws `OperationError` on auth failure (wrong key, corrupted ciphertext, or legacy plaintext). Uncaught, this crashes the component. Always wrap in try/catch.
- **Encrypting `body` but leaving `snippet` plaintext**: The snippet is a 150-char plaintext preview of the note body. A plaintext snippet stored in PocketBase leaks the most salient content of the note to the server operator. It must be either (a) encrypted alongside body, or (b) blanked out entirely. This research recommends encrypting it.
- **Re-running PBKDF2 on every save**: PBKDF2 at 200k iterations is intentionally slow. Run it once per session (first note write), cache the result, reuse for all subsequent operations.
- **Forgetting to clear the cached key on logout**: Module-scoped `_cachedKey` persists in memory. If two users share a browser session (shared device), the second user would inherit the first user's derived key. Clear on `pb.authStore.onChange` when `record` becomes `null`.
- **Using `atob` on large ciphertexts without size check**: `btoa(String.fromCharCode(...result))` uses spread, which fails for arrays larger than ~65,535 elements. For large note bodies, use a loop-based approach: `result.reduce((acc, byte) => acc + String.fromCharCode(byte), '')`. [CITED: MDN Uint8Array note on spread limit]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AES encryption | Custom XOR / rot13 / any homebrew cipher | `window.crypto.subtle.encrypt({ name: 'AES-GCM', iv })` | AES-GCM is AEAD — provides authentication (detects tampering) as well as encryption |
| IV generation | `Math.random()` based IV | `window.crypto.getRandomValues(new Uint8Array(12))` | Math.random is not cryptographically secure; reused IVs under GCM are catastrophic |
| Key derivation from password/id | Custom HMAC or SHA256 of id | `subtle.deriveKey(PBKDF2, ...)` | PBKDF2 applies deliberate computational cost to prevent brute-force; plain SHA256 of id is trivially reversible |
| Base64 encode/decode | Custom bit-shifting encoder | Native `btoa()` / `atob()` | Correct, fast, no dependency |

**Key insight:** The Web Crypto API is a vetted, native implementation of these primitives. Writing custom crypto in JavaScript is a security anti-pattern — even experienced cryptographers get it wrong.

---

## Common Pitfalls

### Pitfall 1: Token as Key Material (Data Loss)

**What goes wrong:** Notes encrypted with a token-derived key become permanently undecryptable after the next `authRefresh` or re-login. There is no error at write time; the failure appears silently on the next read as a `OperationError` from `subtle.decrypt`.

**Why it happens:** PocketBase JWTs are ephemeral; `authRefresh` always returns a new token value. The ROADMAP draft proposed `pb.authStore.token + salt` — this is the dangerous formulation.

**How to avoid:** Use `user.id` (from `pb.authStore.record.id`) as the PBKDF2 key material. The id is the only truly immutable value on a PocketBase user record.

**Warning signs:** All existing notes fail to decrypt after a user logs out and back in.

### Pitfall 2: `btoa(String.fromCharCode(...largeUint8Array))` Stack Overflow

**What goes wrong:** Spreading a large `Uint8Array` into `String.fromCharCode()` via rest spread exceeds the JavaScript call stack for arrays > ~65k bytes. This only affects unusually large notes, but the body could be several hundred KB for a rich document.

**Why it happens:** `...result` spreads the full array as function arguments.

**How to avoid:** Use a loop:
```typescript
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0)  // noUncheckedIndexedAccess
  }
  return btoa(binary)
}
```

**Warning signs:** `RangeError: Maximum call stack size exceeded` on save of a large note.

### Pitfall 3: Key Cache Not Cleared on Logout

**What goes wrong:** User A writes notes. User B logs in on the same browser. `_cachedKey` still holds User A's derived key. User B's new notes are encrypted with the wrong key.

**Why it happens:** Module-scoped `let _cachedKey` lives for the JavaScript module's lifetime (i.e., the page session).

**How to avoid:** In `useNotesCrypto.ts`, register a `pb.authStore.onChange` handler that calls `clearKey()` when `record` becomes null (logout). The existing `auth.ts` already uses `pb.authStore.onChange` to update `user.value` — the same pattern applies.

**Warning signs:** User B's notes are encrypted but undecryptable after they log out and User A tries to read notes again.

### Pitfall 4: `OperationError` Not Caught on Decrypt

**What goes wrong:** `subtle.decrypt` throws `OperationError` for any authentication failure — wrong key, wrong IV, corrupted bytes, or (critically) a legacy plaintext string passed as ciphertext. If uncaught, the entire `ManageNote.vue` component crashes at mount.

**Why it happens:** `DOMException(OperationError)` is a runtime error; TypeScript does not enforce catch.

**How to avoid:** Always wrap `decryptBody()` in a try/catch. For the legacy plaintext fallback: catch `OperationError`, check if the original string is valid JSON (attempt `JSON.parse`), and if so treat it as plaintext. If it's neither valid ciphertext nor valid JSON, show `toast.error('Note could not be decrypted')` and render an empty editor rather than crashing.

**Warning signs:** ManageNote dialog fails to open for Phase 1 plaintext notes.

### Pitfall 5: Salt Field Absent on First Read

**What goes wrong:** `getOrCreateSalt` reads `users` record. The `note_encryption_salt` field is absent (user hasn't written a note yet; field might also be missing from collection schema). Accessing it as `record.note_encryption_salt` returns `undefined` — which is correctly handled, but TypeScript may error if the type is not declared carefully.

**Why it happens:** PocketBase records are typed as `RecordModel` — a base type with `[key: string]: unknown`. Custom fields require a cast.

**How to avoid:** Cast to `Record<string, unknown>` before accessing: `(record as Record<string, unknown>)[SALT_FIELD] as string | undefined`. Guard with `if (existingSalt && typeof existingSalt === 'string')`.

**Warning signs:** TypeScript error on `record.note_encryption_salt` access; runtime `undefined` comparison.

### Pitfall 6: PBKDF2 Running on Every Note List Load

**What goes wrong:** `NotesTab.vue` calls `getOrDeriveKey()` when the tab mounts. If the cache is empty (first load), key derivation runs. If derivation is not awaited before the decrypt loop starts, notes render without decryption.

**Why it happens:** `instrumentedGetFullList` returns immediately; the decrypt loop must await `getOrDeriveKey()` first.

**How to avoid:** Sequentially: `const key = await getOrDeriveKey()` before the `Promise.all` map. The key is cached after the first call so all subsequent `NotesTab` mounts are instant.

**Warning signs:** Snippets show as Base64 ciphertext in the notes list.

### Pitfall 7: noUncheckedIndexedAccess on Uint8Array.from callback

**What goes wrong:** `Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))` — TypeScript with `noUncheckedIndexedAccess` does not affect this particular pattern (the `from` callback receives individual characters, not indexed access), but `bytes[i]` accesses later in the loop require `bytes[i] ?? 0`.

**Why it happens:** `noUncheckedIndexedAccess: true` makes all indexed access return `T | undefined`.

**How to avoid:** Use the `uint8ToBase64` helper with `bytes[i] ?? 0` as shown in Pitfall 2's fix.

---

## Legacy Plaintext Migration Strategy

Phase 1 shipped plaintext JSON-stringified Tiptap content in the `body` field (e.g., `{"type":"doc","content":[...]}`). Phase 2 stores Base64-encoded AES-GCM ciphertext in the same field.

**Detection sentinel:** Attempt `decryptBody()`. If it throws `OperationError`, the body is either legacy plaintext or corrupted. To distinguish:
1. Catch `OperationError`
2. Try `JSON.parse(originalBody)` — if this succeeds and yields a `{ type: 'doc' }` shaped object, it is a valid legacy plaintext body → render normally
3. If `JSON.parse` also throws → the body is genuinely corrupted → show error toast and render empty editor

**Migration approach: lazy (on-edit, not on-read):** Do not migrate all notes at Phase 2 activation. Only encrypt a note's body when the user edits it (the `saveFn` always writes encrypted output). This approach:
- Requires zero upfront migration script
- Handles the case where the user has many notes but rarely edits old ones (they stay as legacy plaintext until touched)
- `NotesTab.vue` snippet decryption handles legacy snippets gracefully via the same fallback: if `decryptBody` throws, treat the snippet as plaintext and display as-is

**Snippet field for legacy notes:** Phase 1 snippet is plaintext. The `decryptBody` fallback in `NotesTab.vue` silently passes through the legacy plaintext snippet for display. After the user edits the note, the snippet is re-generated and encrypted. No special handling needed beyond the existing fallback.

---

## Snippet Field Recommendation

The ROADMAP does not explicitly address what to do with the `snippet` field in Phase 2. The `snippet` is a 150-char plaintext preview stored at save time, currently visible in PocketBase Admin UI.

**Options:**

| Option | Pros | Cons |
|--------|------|------|
| **Encrypt snippet alongside body (recommended)** | Server never sees any note content; consistent with ENC-01 goal | Snippet must be decrypted for every row in the notes list (async, but key is cached so fast) |
| Blank the snippet (store empty string) | Simplest | Notes list loses the preview entirely — poor UX, breaks LIST-02 |
| Leave snippet as plaintext | No change | Leaks content to server — violates the spirit of ENC-01 |

**Recommendation:** Encrypt `snippet` using the same `encryptBody` function (identical IV+ciphertext format). In `NotesTab.vue`, call `decryptBody` on each snippet after the list loads, using the cached key. For legacy notes, the `OperationError` fallback returns the original plaintext snippet — no visible difference.

This recommendation is [ASSUMED] to be acceptable; the planner should surface it to the user for confirmation.

---

## PocketBase Schema Changes

### Field added to `users` collection

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `note_encryption_salt` | Text | No | Base64-encoded 16-byte random salt. Generated on first note write. Absent = user has never written a note. |

**PocketBase collection rules — no change needed to `users`:** The built-in `users` collection default update rule is `id = @request.auth.id` (user can update their own record). Salt write uses `pb.collection('users').update(userId, { note_encryption_salt: base64salt })` authenticated as the user — this matches the rule. [ASSUMED — actual rules on the deployed PocketBase instance must be verified; this is the PocketBase default]

**No change to `kaheeta_notes` collection:** The `body` and `snippet` fields already hold arbitrary text strings. Encrypted ciphertext is still a string. No schema migration required.

---

## Validation Architecture

nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.7 |
| Config file | `vitest.config.ts` (environment: jsdom) |
| Quick run command | `npx vitest run src/lib/wallecx/notesCrypto.test.ts` |
| Full suite command | `npx vitest run` |

### crypto.subtle in jsdom — CONFIRMED WORKING

**Verified in this research session:** `globalThis.crypto.subtle` is available in the project's jsdom environment on Node 22.14.0. No polyfill, no setup file, no `vitest.setup.ts` required. The following all passed: `crypto.subtle` defined, `generateKey`, round-trip `encrypt`+`decrypt`. [VERIFIED: live test run in this session]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENC-01 | Body encrypted before PocketBase write; server never stores plaintext | Unit: notesCrypto — round-trip test + `encryptBody` output is not JSON | `npx vitest run src/lib/wallecx/notesCrypto.test.ts` | No — Wave 0 |
| ENC-02 | Key derived from user session (user.id + salt) via PBKDF2; no extra password | Unit: `deriveKey` returns CryptoKey; same inputs produce same ciphertext (decryptable) | `npx vitest run src/lib/wallecx/notesCrypto.test.ts` | No — Wave 0 |
| ENC-03 | Decryption in-browser on read; body displayed correctly | Unit: `decryptBody(key, encryptBody(key, plaintext)) === plaintext` | `npx vitest run src/lib/wallecx/notesCrypto.test.ts` | No — Wave 0 |
| (legacy) | Legacy plaintext notes render without crash | Unit: `decryptBody` catch → JSON.parse fallback returns JSONContent | `npx vitest run src/lib/wallecx/notesCrypto.test.ts` | No — Wave 0 |
| (key stability) | Same user.id + salt always produces same key | Unit: decrypt with re-derived key succeeds | `npx vitest run src/lib/wallecx/notesCrypto.test.ts` | No — Wave 0 |
| (wrong key) | Wrong key → OperationError thrown | Unit: `decryptBody` with different key rejects | `npx vitest run src/lib/wallecx/notesCrypto.test.ts` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/wallecx/notesCrypto.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/wallecx/notesCrypto.test.ts` — covers all ENC-* requirements above (pure function tests; no PocketBase mock needed)
- [ ] No additional framework install needed — crypto.subtle works in jsdom without setup

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — key derivation uses existing auth, not a new auth mechanism | `pb.authStore.record.id` from existing session |
| V3 Session Management | Yes — key must be cleared on logout | `pb.authStore.onChange` → `clearKey()` |
| V4 Access Control | Yes — PocketBase `users` collection update rule must restrict `note_encryption_salt` write to the record owner | `id = @request.auth.id` (default rule — must verify on deployed instance) |
| V5 Input Validation | No — encrypted body is opaque bytes; no validation needed client-side | N/A |
| V6 Cryptography | Yes — primary concern of this phase | `window.crypto.subtle` (AES-GCM-256, PBKDF2-SHA256) |

### Threat Model

| Threat | STRIDE | Mitigation |
|--------|--------|-----------|
| Server operator reads note content | Information Disclosure | AES-GCM encryption — server stores only opaque ciphertext |
| Attacker with database dump reads notes | Information Disclosure | Notes are ciphertext; attacker needs user.id + salt + PBKDF2 reversal — the user.id IS in the same dump (limitation of no-second-password design — see above) |
| XSS extracts decrypted note content | Tampering / Info Disclosure | Notes are decrypted in-browser; XSS could read `editorContent.value`. Standard Vue/CSP mitigations apply (out of scope for this phase) |
| User writes plaintext `note_encryption_salt` to arbitrary user records | Tampering | PocketBase collection rule `id = @request.auth.id` prevents writing to another user's record |
| Attacker replaces ciphertext with arbitrary bytes | Tampering | AES-GCM includes a 128-bit authentication tag — tampered ciphertext throws `OperationError` on decrypt |
| IV reuse under same key | Cryptographic weakness | Per-encrypt random IV via `getRandomValues` — no IV is ever reused |

### Known Limitations (threat model boundary)

The "no second password" constraint means the encryption key is derivable by anyone who has access to both the PocketBase database dump (for `user.id` and `note_encryption_salt`) and the PBKDF2 parameters (which are in the source code). This is not end-to-end encryption in the strong sense — it provides opacity against passive server-side snooping and accidental log leaks, not against a fully compromised server. This is acceptable per the project's out-of-scope declaration ("Server-side encryption: Client-side AES-GCM is sufficient; keeps backend simple").

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Web Crypto polyfills (e.g., `crypto-browserify`) | Native `window.crypto.subtle` | Chrome 37+, Firefox 34+, Safari 11+ — 2014-2019 | No npm package needed; browser-native performance |
| CryptoJS library for AES | `window.crypto.subtle` | ~2018 (browser support reached critical mass) | CryptoJS runs in userland JS — avoid; use native SubtleCrypto |
| PBKDF2 100k iterations (OWASP 2021) | 600k iterations (OWASP 2023) | 2023 | Higher iteration count; for this use case (stable id, not a weak password) 200k is a balanced choice |

**Deprecated/outdated:**
- `CryptoJS` npm package: Do not use — JavaScript implementation, no side-channel resistance, outdated API. [ASSUMED based on broad ecosystem consensus]
- PBKDF2 with MD5 or SHA-1 hash: Use SHA-256 only. [CITED: MDN deriveKey docs]

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `window.crypto.subtle` (browser) | AES-GCM encrypt/decrypt | ✓ | All modern browsers; no polyfill needed | — |
| `window.crypto.subtle` (Vitest) | Unit tests | ✓ | Node 22.14.0 via jsdom; confirmed in this session | — |
| PocketBase `users` collection `note_encryption_salt` field | Salt storage | Needs manual setup | — | Create via Admin UI (user setup step, same as kaheeta_notes in Phase 1) |

No blocking missing dependencies.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PocketBase user `record.id` is immutable — never changed by any user or admin API | Critical Design Decision | If id can change, the derived key changes and all notes become undecryptable — catastrophic data loss. Verify by inspecting PocketBase source or checking with the backend owner. |
| A2 | PBKDF2 iteration count of 200,000 is acceptable for UX (~150ms on mid-range hardware) | Critical Design Decision | If too slow on low-end mobile, reduce to 100,000. If security posture demands higher, increase to 600,000. |
| A3 | Storing `note_encryption_salt` on the `users` collection (vs a separate `kaheeta_user_settings` collection) is acceptable | Architecture Patterns | If the team prefers strict separation, a separate collection adds a one-time extra request but follows naming conventions more cleanly. |
| A4 | Encrypting the `snippet` field is preferred over blanking it | Snippet Field Recommendation | If snippet is blanked, the notes list preview disappears. If left as plaintext, server sees content. Recommend encrypt; user should confirm. |
| A5 | The deployed PocketBase instance has the default `id = @request.auth.id` update rule on the `users` collection | PocketBase Schema Changes | If the rule is more restrictive, salt writes will fail with 403. Must verify in Admin UI before deploying. |
| A6 | `btoa` / `atob` approach for Base64 encoding is sufficient (no URL-safe variant needed) | Pattern 1 | If the Base64 string is placed in a URL context (e.g., query param), `+` and `/` chars need URL encoding. For storage in a PocketBase text field, standard Base64 is fine. |
| A7 | The lazy migration approach (encrypt only on edit) is acceptable — Phase 1 notes stay plaintext until edited | Legacy Plaintext Migration | If the user wants all notes encrypted immediately, a one-time migration script is needed. The research recommends lazy migration but defers to the planner to surface this option. |

---

## Open Questions (RESOLVED)

> All three resolved by 02-CONTEXT.md locked decisions (gathered 2026-07-01, post-research). CONTEXT wins where it conflicts with this file.

1. **Is PBKDF2 the correct KDF, or should HKDF be used instead?** — **RESOLVED (D-02):** PBKDF2 (AES-GCM-256 via `window.crypto.subtle`). The "no second password" constraint (D-04) makes `user.id` the only secret, so PBKDF2's iteration cost is the sole brute-force barrier for an attacker with the database. HKDF not adopted.
   - Detail: PBKDF2 suits low-entropy inputs; `user.id` has ~90 bits. HKDF would be near-instant but offers no iteration-count resistance — rejected given the id-only key material.

2. **What happens when the user's password is reset via admin?** — **RESOLVED (D-01, out of scope):** PocketBase password reset does NOT change `user.id`; the id is the permanent key material and survives resets. Assumption A1 (no custom auth hook recreates users with new ids) to be confirmed at execution against the live instance.

3. **Should the `useNotesCrypto` composable be initialised eagerly on login, or lazily on first note write?** — **RESOLVED (D-03):** Lazy — key derived on first `getOrDeriveKey()` call, then cached module-scoped for the session. The ~150ms first-write PBKDF2 delay is imperceptible within the debounced auto-save window.

---

## Sources

### Primary (HIGH confidence)
- `src/components/wallecx/ManageNote.vue` — read directly; saveFn and load path that Phase 2 must wrap [VERIFIED: codebase]
- `src/lib/pocketbase/notesMapper.ts` — read directly; mapToUpdateNote body field is what gets encrypted [VERIFIED: codebase]
- `src/types/wallecx/notes/types.d.ts` — read directly; Note.body is JSON.stringify of Tiptap JSONContent [VERIFIED: codebase]
- `src/stores/auth.ts` — read directly; `pb.authStore.record.id` access pattern [VERIFIED: codebase]
- `src/lib/pocketbase/index.ts` — read directly; `pb` singleton [VERIFIED: codebase]
- `vitest.config.ts` — jsdom environment confirmed [VERIFIED: codebase]
- Live test run — `globalThis.crypto.subtle` available in jsdom, AES-GCM round-trip passes [VERIFIED: this session]
- `developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey` [CITED: MDN]
- `developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt` [CITED: MDN]
- `developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/decrypt` [CITED: MDN]
- `miguelacm.es/en/blog/aes-256-encryption-browser` — complete encrypt/decrypt implementation with IV prepend [CITED]

### Secondary (MEDIUM confidence)
- PocketBase GitHub discussions on token rotation — confirms `authRefresh` returns a new JWT [CITED: github.com/pocketbase/pocketbase/discussions/4044]
- PocketBase JS SDK `BaseAuthStore.ts` — `record.id` preserved even in cookie-size-minimised mode [CITED: github.com/pocketbase/js-sdk]
- OWASP Password Storage Cheat Sheet — 600,000 iterations PBKDF2-SHA256 [CITED: owasp.org]

### Tertiary (LOW — confirmed present but not deeply verified)
- PocketBase record `id` immutability — inferred from PK semantics and absence of any `id`-change API in docs [ASSUMED: A1]

---

## Metadata

**Confidence breakdown:**
- Web Crypto API (PBKDF2 + AES-GCM primitives): HIGH — MDN primary source; confirmed working in project test environment
- Key derivation design (user.id as input): HIGH for token-rotation risk (documented); MEDIUM for id immutability (inferred, not explicitly confirmed in PocketBase docs)
- Architecture integration (ManageNote.vue + NotesTab.vue hooks): HIGH — read Phase 1 source directly
- Salt storage (users collection field): MEDIUM — recommended approach, but alternative (kaheeta_user_settings) is viable
- Testing strategy: HIGH — live confirmed in jsdom

**Research date:** 2026-07-01
**Valid until:** 2026-08-01 (Web Crypto API is stable; PocketBase 0.x may have minor SDK changes)
