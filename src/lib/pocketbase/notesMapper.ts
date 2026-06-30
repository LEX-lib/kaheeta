import type { Note } from "@/types/wallecx/notes/types";

export function mapToUpdateNote(record: Note): {
  title: string;
  body: string;
  snippet: string;
} {
  return {
    title: record.title,
    body: record.body,
    snippet: record.snippet,
  };
}
