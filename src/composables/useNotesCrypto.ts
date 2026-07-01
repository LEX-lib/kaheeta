// Session key lifecycle for transparent note encryption (ENC-02).
//
// This composable owns the *stateful* concerns Plan 01's pure primitives left
// open: where the PBKDF2 salt lives, when the derivation runs, and how the
// derived key is cached and invalidated.
//
// D-01: key material is auth.user.id (immutable user PK) + a per-user salt.
//       NEVER pb.authStore.token — the JWT rotates on authRefresh(), which
//       would orphan every previously-encrypted note. This module never reads
//       .token.
// D-03: the derived CryptoKey is cached in a MODULE-scoped variable so PBKDF2
//       runs once per session (not per useNotesCrypto() call, not per save).
// D-05: the salt is stored in the kaheeta_user_settings collection, one record
//       per user (not on the shared users collection).
// D-06: the salt is 16 random bytes, generated once and persisted Base64.

import { deriveKey, uint8ToBase64, SALT_LENGTH } from "@/lib/wallecx/notesCrypto";
import { pb } from "@/lib/pocketbase";
import { useAuthStore } from "@/stores/auth";
import type { UserSettings } from "@/types/wallecx/notes/types";
import { ClientResponseError } from "pocketbase";

// Module-scoped so the derived key survives component mount/unmount across the
// whole session (D-03). Reset to null on logout by the onChange handler below.
let cachedKey: CryptoKey | null = null;

// Registered once at module load (not inside the exported function). When the
// auth record becomes null — i.e. logout, or a token clear on 401 — drop the
// cached key so a second user on the same browser cannot inherit the first
// user's key (D-01 shared-device safety, Pitfall 3).
pb.authStore.onChange((_token, record) => {
  if (!record) {
    cachedKey = null;
  }
});

/**
 * Fetch the user's persisted PBKDF2 salt, bootstrapping it on first use.
 *
 * Reads the caller's kaheeta_user_settings record; if none exists (404) or the
 * salt field is empty, generates a fresh 16-byte salt (D-06), persists it, and
 * returns the new bytes. Non-404 errors are rethrown.
 */
async function getOrCreateSalt(userId: string): Promise<Uint8Array> {
  let existing: UserSettings | null = null;
  try {
    existing = await pb
      .collection("kaheeta_user_settings")
      .getFirstListItem<UserSettings>(`user = '${userId}'`);
  } catch (err) {
    // getFirstListItem throws a 404 ClientResponseError when no record matches;
    // that is the expected first-write path. Anything else is a real failure.
    if (!(err instanceof ClientResponseError) || err.status !== 404) {
      throw err;
    }
  }

  if (existing && existing.note_encryption_salt) {
    return Uint8Array.from(atob(existing.note_encryption_salt), (c) => c.charCodeAt(0));
  }

  // No record, or a record with an empty salt: generate and persist one.
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const b64 = uint8ToBase64(salt);

  if (existing) {
    await pb
      .collection("kaheeta_user_settings")
      .update(existing.id, { note_encryption_salt: b64 });
  } else {
    await pb
      .collection("kaheeta_user_settings")
      .create({ user: userId, note_encryption_salt: b64 });
  }

  return salt;
}

/**
 * Session key lifecycle. Returns `getOrDeriveKey` (derive-once + cache) and
 * `clearKey` (manual invalidation). Logout invalidation is automatic via the
 * module-level onChange handler.
 */
export function useNotesCrypto() {
  const auth = useAuthStore();

  /**
   * Return the AES-GCM key for the current session, deriving it exactly once.
   * Subsequent calls return the module-cached key without re-running PBKDF2 or
   * re-fetching the salt (D-03).
   */
  async function getOrDeriveKey(): Promise<CryptoKey> {
    if (cachedKey) {
      return cachedKey;
    }

    const userId = auth.user?.id;
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const salt = await getOrCreateSalt(userId);
    cachedKey = await deriveKey(userId, salt);
    return cachedKey;
  }

  /** Drop the cached key. Called on logout via onChange; exposed for callers. */
  function clearKey(): void {
    cachedKey = null;
  }

  return { getOrDeriveKey, clearKey };
}
