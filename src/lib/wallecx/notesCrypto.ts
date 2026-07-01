// Pure crypto primitives for transparent note encryption.
// No Vue, no PocketBase — self-contained functions unit-testable against
// window.crypto.subtle in jsdom. Consumed by useNotesCrypto (Plan 02) and the
// ManageNote/NotesTab hooks (Plan 03).
//
// D-02: AES-GCM-256 via window.crypto.subtle, no new npm packages.
// D-07: fresh 12-byte IV per encrypt call, prepended to the ciphertext.
// D-08: loop-based Base64 (never spread + btoa) to survive >65KB bodies.
// D-10: decryptBody lets OperationError propagate so callers own the
//       legacy-plaintext fallback — it is NOT caught here.

// crypto.subtle resolves to window.crypto.subtle in the browser and
// globalThis.crypto.subtle under jsdom — reference it via the global binding.
const subtle = crypto.subtle;

const IV_LENGTH = 12; // 96-bit IV — AES-GCM standard recommendation (D-07)
const SALT_LENGTH = 16; // 128-bit salt (D-06); retained for reference/consumers

// PBKDF2 iteration count. OWASP 2023 recommends 600,000 for weak passwords;
// 200,000 is the balanced choice here (RESEARCH A2) — the key material is a
// stable 15-char user.id, and this keeps first-write derivation imperceptible
// (~150ms) within the debounced auto-save window.
const PBKDF2_ITERATIONS = 200_000;

/**
 * Import a userId string as raw PBKDF2 key material. Non-extractable; usable
 * only for deriveKey.
 */
async function importKeyMaterial(userId: string): Promise<CryptoKey> {
  const material = new TextEncoder().encode(userId);
  return subtle.importKey("raw", material, "PBKDF2", false, ["deriveKey"]);
}

/**
 * Derive a 256-bit AES-GCM key from userId + salt via PBKDF2-SHA256.
 * Intentionally slow — derive once per session and cache the result.
 */
export async function deriveKey(userId: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await importKeyMaterial(userId);
  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, // non-extractable — the key never leaves the SubtleCrypto context
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt plaintext with AES-GCM. Returns Base64 of [12-byte IV][ciphertext+tag].
 * A fresh random IV is generated for every call (D-07).
 */
export async function encryptBody(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);
  return uint8ToBase64(combined);
}

/**
 * Decrypt a Base64 blob produced by encryptBody.
 * Throws OperationError for a wrong key, tampered bytes, or a legacy plaintext
 * value passed as ciphertext. Callers MUST catch to trigger the D-10 fallback —
 * this function intentionally does NOT catch.
 */
export async function decryptBody(key: CryptoKey, b64: string): Promise<string> {
  const combined = base64ToUint8(b64);
  const iv = combined.slice(0, IV_LENGTH);
  const data = combined.slice(IV_LENGTH);
  const plaintext = await subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plaintext);
}

/**
 * Loop-based Base64 encoder (D-08). Avoids the ~65KB RangeError from
 * btoa(String.fromCharCode(...bytes)). `bytes[i] ?? 0` satisfies
 * noUncheckedIndexedAccess.
 */
export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

/** Decode a standard Base64 string to bytes. */
export function base64ToUint8(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// Exported for consumers that need the salt length when generating salts.
export { SALT_LENGTH, IV_LENGTH };
