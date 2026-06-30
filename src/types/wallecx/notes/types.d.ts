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
