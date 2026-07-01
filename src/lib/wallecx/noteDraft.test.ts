import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { deriveKey } from './notesCrypto'
import { draftKey, saveDraft, loadDraft, clearDraft, isDraftNewer } from './noteDraft'
import type { JSONContent } from '@tiptap/core'

// ---------------------------------------------------------------------------
// Test key — derived once and reused. Fixed userId + salt so the round-trip
// is genuinely exercised under jsdom's window.crypto.subtle (no mock).
// ---------------------------------------------------------------------------
let cryptoKey: CryptoKey
let wrongKey: CryptoKey

const FIXED_USER_ID = 'user000000abc12'
const WRONG_USER_ID = 'user999999xyz99'
const FIXED_SALT = new Uint8Array(16).fill(42)

const SAMPLE_TITLE = 'My secret note title'
const SAMPLE_BODY: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
}

beforeAll(async () => {
  cryptoKey = await deriveKey(FIXED_USER_ID, FIXED_SALT)
  wrongKey = await deriveKey(WRONG_USER_ID, FIXED_SALT)
})

beforeEach(() => {
  localStorage.clear()
})

// ---------------------------------------------------------------------------
// D-01: key format
// ---------------------------------------------------------------------------
describe('draftKey (D-01 key format)', () => {
  it("returns 'kaheeta:note-draft:<id>' for a valid noteId", () => {
    expect(draftKey('abc123')).toBe('kaheeta:note-draft:abc123')
  })

  it("returns 'kaheeta:note-draft:new' when noteId is null", () => {
    expect(draftKey(null)).toBe('kaheeta:note-draft:new')
  })

  it("returns 'kaheeta:note-draft:new' when noteId is empty string", () => {
    expect(draftKey('')).toBe('kaheeta:note-draft:new')
  })

  it("returns 'kaheeta:note-draft:new' when noteId is undefined", () => {
    expect(draftKey(undefined)).toBe('kaheeta:note-draft:new')
  })
})

// ---------------------------------------------------------------------------
// D-02: encrypt-at-rest — the raw stored value must NOT contain plaintext
// ---------------------------------------------------------------------------
describe('saveDraft — ciphertext-at-rest control (D-02)', () => {
  it('writes a value to localStorage under the correct key', async () => {
    await saveDraft('abc123', { title: SAMPLE_TITLE, body: SAMPLE_BODY }, cryptoKey)
    const raw = localStorage.getItem('kaheeta:note-draft:abc123')
    expect(raw).not.toBeNull()
  })

  it('stored JSON does NOT contain the plaintext title substring', async () => {
    await saveDraft('abc123', { title: SAMPLE_TITLE, body: SAMPLE_BODY }, cryptoKey)
    const raw = localStorage.getItem('kaheeta:note-draft:abc123')
    expect(raw).not.toBeNull()
    // The raw string must not contain the plaintext title — content is ciphertext (D-02)
    expect(raw).not.toContain(SAMPLE_TITLE)
    expect(raw).not.toContain('secret')
  })

  it('stored JSON does NOT contain the plaintext body text', async () => {
    await saveDraft('abc123', { title: SAMPLE_TITLE, body: SAMPLE_BODY }, cryptoKey)
    const raw = localStorage.getItem('kaheeta:note-draft:abc123')
    expect(raw).not.toBeNull()
    // The body text should not appear in plaintext in localStorage (D-02)
    expect(raw).not.toContain('Hello world')
  })

  it('stored value is not directly parseable as the original {title, body} shape', async () => {
    await saveDraft('abc123', { title: SAMPLE_TITLE, body: SAMPLE_BODY }, cryptoKey)
    const raw = localStorage.getItem('kaheeta:note-draft:abc123')!
    const parsed = JSON.parse(raw) as Record<string, unknown>
    // The stored object has a 'content' field (ciphertext string) and 'savedAt',
    // NOT 'title' and 'body' directly — confirming plaintext is not on disk
    expect(parsed['content']).toBeDefined()
    expect(parsed['savedAt']).toBeDefined()
    expect(parsed['title']).toBeUndefined()
    expect(parsed['body']).toBeUndefined()
  })

  it('uses kaheeta:note-draft:new key when noteId is null (new note)', async () => {
    await saveDraft(null, { title: SAMPLE_TITLE, body: SAMPLE_BODY }, cryptoKey)
    const raw = localStorage.getItem('kaheeta:note-draft:new')
    expect(raw).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Round-trip: encrypt → decrypt preserves original content
// ---------------------------------------------------------------------------
describe('loadDraft — encrypt/decrypt round-trip', () => {
  it('round-trips: title and body survive saveDraft → loadDraft', async () => {
    await saveDraft('roundtrip1', { title: SAMPLE_TITLE, body: SAMPLE_BODY }, cryptoKey)
    const result = await loadDraft('roundtrip1', cryptoKey)
    expect(result).not.toBeNull()
    expect(result!.title).toBe(SAMPLE_TITLE)
    expect(result!.body).toEqual(SAMPLE_BODY)
  })

  it('round-trip result includes savedAt as a non-empty ISO string', async () => {
    await saveDraft('ts1', { title: SAMPLE_TITLE, body: SAMPLE_BODY }, cryptoKey)
    const result = await loadDraft('ts1', cryptoKey)
    expect(result).not.toBeNull()
    expect(typeof result!.savedAt).toBe('string')
    expect(result!.savedAt.length).toBeGreaterThan(0)
    // Must be a parseable date
    expect(Number.isNaN(Date.parse(result!.savedAt))).toBe(false)
  })

  it('round-trips a null body correctly', async () => {
    await saveDraft('nullbody', { title: 'Only title', body: null }, cryptoKey)
    const result = await loadDraft('nullbody', cryptoKey)
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Only title')
    expect(result!.body).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Absent / corrupt guard — loadDraft must never throw
// ---------------------------------------------------------------------------
describe('loadDraft — absent and corrupt guard', () => {
  it('returns null for a missing localStorage key (no throw)', async () => {
    const result = await loadDraft('does-not-exist', cryptoKey)
    expect(result).toBeNull()
  })

  it('returns null for a non-JSON garbage value (no throw)', async () => {
    localStorage.setItem('kaheeta:note-draft:bad1', 'not json at all !!!!')
    const result = await loadDraft('bad1', cryptoKey)
    expect(result).toBeNull()
  })

  it('returns null when ciphertext was encrypted with a different key (wrong key = tampered = no throw)', async () => {
    // Save with the real key, then attempt to load with the wrong key
    await saveDraft('tampered', { title: SAMPLE_TITLE, body: SAMPLE_BODY }, cryptoKey)
    const result = await loadDraft('tampered', wrongKey)
    expect(result).toBeNull()
  })

  it('returns null when the content field is a plaintext string (not ciphertext)', async () => {
    // Store a value that looks structurally valid but has a non-ciphertext content field
    localStorage.setItem(
      'kaheeta:note-draft:plain',
      JSON.stringify({ content: 'this is plaintext not base64 cipher !!!', savedAt: new Date().toISOString() }),
    )
    const result = await loadDraft('plain', cryptoKey)
    expect(result).toBeNull()
  })

  it('returns null when the stored object is missing the content field', async () => {
    localStorage.setItem(
      'kaheeta:note-draft:nofield',
      JSON.stringify({ savedAt: new Date().toISOString() }),
    )
    const result = await loadDraft('nofield', cryptoKey)
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// clearDraft
// ---------------------------------------------------------------------------
describe('clearDraft', () => {
  it('removes the localStorage entry; subsequent loadDraft returns null', async () => {
    await saveDraft('toclear', { title: SAMPLE_TITLE, body: SAMPLE_BODY }, cryptoKey)
    expect(localStorage.getItem('kaheeta:note-draft:toclear')).not.toBeNull()
    clearDraft('toclear')
    expect(localStorage.getItem('kaheeta:note-draft:toclear')).toBeNull()
    const result = await loadDraft('toclear', cryptoKey)
    expect(result).toBeNull()
  })

  it('clearDraft on a non-existent key does not throw', () => {
    expect(() => clearDraft('nonexistent-key-xyz')).not.toThrow()
  })

  it('clearDraft(null) clears the new-note draft key', async () => {
    await saveDraft(null, { title: 'New note draft', body: null }, cryptoKey)
    expect(localStorage.getItem('kaheeta:note-draft:new')).not.toBeNull()
    clearDraft(null)
    expect(localStorage.getItem('kaheeta:note-draft:new')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// isDraftNewer (D-03 comparison)
// ---------------------------------------------------------------------------
describe('isDraftNewer (D-03 newer-than-saved comparison)', () => {
  const OLDER = '2026-06-30T10:00:00.000Z'
  const NEWER = '2026-06-30T11:00:00.000Z'
  const SAME = '2026-06-30T10:00:00.000Z'

  it('returns true when draft savedAt is strictly later than record updated', () => {
    expect(isDraftNewer(NEWER, OLDER)).toBe(true)
  })

  it('returns false when draft savedAt equals record updated', () => {
    expect(isDraftNewer(SAME, SAME)).toBe(false)
  })

  it('returns false when draft savedAt is earlier than record updated', () => {
    expect(isDraftNewer(OLDER, NEWER)).toBe(false)
  })

  it('returns false for a null savedAt', () => {
    expect(isDraftNewer(null, NEWER)).toBe(false)
  })

  it('returns false for an undefined savedAt', () => {
    expect(isDraftNewer(undefined, NEWER)).toBe(false)
  })

  it('returns false for an empty string savedAt', () => {
    expect(isDraftNewer('', NEWER)).toBe(false)
  })
})
