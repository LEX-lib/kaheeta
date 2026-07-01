import type { RecordModel } from "pocketbase";

export interface Note extends RecordModel {
  id: string;
  created: string;
  updated: string;
  user: string; // relation to users collection
  title: string; // note title, max 500 chars
  body: string; // JSON.stringify of ProseMirror JSONContent, nullable for empty notes
  snippet: string; // plaintext preview, max 150 chars, generated at save time
}

export type AddNote = Omit<Note, "id" | "created" | "updated">;

// Maps to the `kaheeta_user_settings` collection (D-05). Stores the per-user
// PBKDF2 salt (Base64 of 16 random bytes, D-06) used to derive the note
// encryption key. One record per user; `note_encryption_salt` may be an empty
// string before the first note write bootstraps it.
export interface UserSettings extends RecordModel {
  user: string; // relation to users collection
  note_encryption_salt: string; // Base64 of the 16-byte PBKDF2 salt
}
