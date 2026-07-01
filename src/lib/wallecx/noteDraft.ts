import { encryptBody, decryptBody } from './notesCrypto'
import type { JSONContent } from '@tiptap/core'

/**
 * Pure draft-persistence helpers for local note drafts.
 *
 * Owned responsibilities:
 *   - Key derivation  (D-01): kaheeta:note-draft:<id> / kaheeta:note-draft:new
 *   - Serialize       (D-02): encrypt {title, body} blob with AES-GCM before writing
 *   - Deserialize     (D-02): decrypt, guard all parse/decrypt errors → null (WR-03)
 *   - Clear                 : remove the localStorage entry
 *   - Comparison      (D-03): "is draft newer than saved record?" by timestamp
 *
 * No Vue, no PocketBase — intentionally pure and testable in isolation.
 */

// ---------------------------------------------------------------------------
// Stored shape — what actually lives in localStorage (opaque to callers)
// ---------------------------------------------------------------------------

/** The object serialised into localStorage. `content` is AES-GCM ciphertext. */
interface StoredDraft
{
    content: string   // Base64 ciphertext of JSON.stringify({ title, body })
    savedAt: string   // ISO-8601 timestamp written at save time
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The in-memory representation of a draft that callers write and read. */
export interface DraftPayload
{
    title: string
    body: JSONContent | null
}

/** What loadDraft returns on success: the original payload + its savedAt timestamp. */
export interface LoadedDraft extends DraftPayload
{
    savedAt: string
}

// ---------------------------------------------------------------------------
// D-01: Key derivation
// ---------------------------------------------------------------------------

/**
 * Returns the localStorage key for a given note ID.
 *
 * - Valid noteId  → `kaheeta:note-draft:<noteId>`
 * - null / undefined / empty string → `kaheeta:note-draft:new`
 */
export function draftKey(noteId: string | null | undefined): string
{
    return noteId ? `kaheeta:note-draft:${noteId}` : 'kaheeta:note-draft:new'
}

// ---------------------------------------------------------------------------
// D-02: Save (encrypt-at-rest)
// ---------------------------------------------------------------------------

/**
 * Encrypt `payload` with `key` (AES-GCM) and persist it to localStorage under
 * the key derived from `noteId`.  Title AND body are both encrypted so no
 * plaintext note content ever touches disk (D-02).
 */
export async function saveDraft(
    noteId: string | null | undefined,
    payload: DraftPayload,
    key: CryptoKey,
): Promise<void>
{
    const blob = JSON.stringify({ title: payload.title, body: payload.body })
    const content = await encryptBody(key, blob)
    const stored: StoredDraft = { content, savedAt: new Date().toISOString() }
    localStorage.setItem(draftKey(noteId), JSON.stringify(stored))
}

// ---------------------------------------------------------------------------
// D-02: Load (decrypt with guarded parse — WR-03 + D-10 pattern)
// ---------------------------------------------------------------------------

/**
 * Read and decrypt a stored draft.
 *
 * Returns the original `{ title, body, savedAt }` on success, or `null` on any
 * failure (missing key, corrupt JSON, wrong crypto key, tampered ciphertext,
 * non-ciphertext content).  Never throws — mirror the D-10 guarded-parse
 * pattern from ManageNote.vue.  Per WR-03, ALL errors from decryptBody are
 * caught without narrowing to a specific error type.
 */
export async function loadDraft(
    noteId: string | null | undefined,
    key: CryptoKey,
): Promise<LoadedDraft | null>
{
    const raw = localStorage.getItem(draftKey(noteId))
    if (raw === null) return null

    try
    {
        const stored = JSON.parse(raw) as StoredDraft
        const content = stored.content
        const savedAt = stored.savedAt

        // Guard: structural checks before attempting crypto
        if (typeof content !== 'string' || typeof savedAt !== 'string') return null

        // Decrypt — WR-03: catch ANY error (OperationError, InvalidCharacterError, etc.)
        let blob: string
        try
        {
            blob = await decryptBody(key, content)
        }
        catch
        {
            return null
        }

        // Parse the decrypted blob
        const payload = JSON.parse(blob) as { title: unknown; body: unknown }
        const title = typeof payload.title === 'string' ? payload.title : ''
        const body = (payload.body !== null && typeof payload.body === 'object')
            ? (payload.body as JSONContent)
            : null

        return { title, body, savedAt }
    }
    catch
    {
        // Any JSON.parse or structural error — treat as no draft
        return null
    }
}

// ---------------------------------------------------------------------------
// Clear
// ---------------------------------------------------------------------------

/**
 * Remove the draft from localStorage.  Safe to call when no draft exists.
 */
export function clearDraft(noteId: string | null | undefined): void
{
    localStorage.removeItem(draftKey(noteId))
}

// ---------------------------------------------------------------------------
// D-03: Newer-than-saved comparison
// ---------------------------------------------------------------------------

/**
 * Returns `true` only if `savedAt` parses as a date **strictly greater** than
 * `recordUpdated`.  A falsy or unparseable `savedAt` returns `false`.
 */
export function isDraftNewer(
    savedAt: string | null | undefined,
    recordUpdated: string,
): boolean
{
    if (!savedAt) return false
    const draftTime = Date.parse(savedAt)
    const savedTime = Date.parse(recordUpdated)
    if (Number.isNaN(draftTime)) return false
    return draftTime > savedTime
}
