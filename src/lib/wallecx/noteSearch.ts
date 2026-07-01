import type { Note } from '@/types/wallecx/notes/types'

/**
 * Filters the already-loaded notes array by a case-insensitive title substring.
 *
 * - Empty or whitespace-only query returns the input array unchanged (no filter).
 * - Matching is case-insensitive and trims leading/trailing whitespace from the query.
 * - Only `note.title` is inspected — body and snippet are not considered.
 * - Notes with an empty title are excluded when a non-empty query is active.
 * - No async, no PocketBase, no sorting, no side effects.
 */
export function filterNotesByTitle(notes: Note[], query: string): Note[] {
  const q = query.toLowerCase().trim()
  if (q.length === 0) return notes
  return notes.filter((note) => note.title.toLowerCase().includes(q))
}
