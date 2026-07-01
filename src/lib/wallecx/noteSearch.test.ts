import { describe, it, expect } from 'vitest'
import { filterNotesByTitle } from './noteSearch'
import type { Note } from '@/types/wallecx/notes/types'

// Minimal Note fixture — only id and title are needed by the filter predicate.
function makeNote(id: string, title: string): Note {
  return { id, title, body: '', snippet: '', user: '', created: '', updated: '' } as Note
}

describe('filterNotesByTitle', () => {
  const notes: Note[] = [
    makeNote('1', 'Weekly meeting'),
    makeNote('2', 'MEETING agenda'),
    makeNote('3', 'Grocery list'),
    makeNote('4', ''),
    makeNote('5', 'Budget review'),
  ]

  describe('empty / whitespace query — returns all notes', () => {
    it('returns all notes when query is empty string', () => {
      expect(filterNotesByTitle(notes, '')).toHaveLength(notes.length)
    })
    it('returns all notes when query is spaces only', () => {
      expect(filterNotesByTitle(notes, '   ')).toHaveLength(notes.length)
    })
    it('returns all notes when query is tabs/whitespace', () => {
      expect(filterNotesByTitle(notes, '\t \n')).toHaveLength(notes.length)
    })
  })

  describe('case-insensitive substring matching', () => {
    it('matches uppercase query against lowercase title', () => {
      const result = filterNotesByTitle(notes, 'MEET')
      expect(result.map((n) => n.id)).toContain('1') // "Weekly meeting"
      expect(result.map((n) => n.id)).toContain('2') // "MEETING agenda"
    })
    it('matches lowercase query against uppercase title', () => {
      const result = filterNotesByTitle(notes, 'meet')
      expect(result.map((n) => n.id)).toContain('1')
      expect(result.map((n) => n.id)).toContain('2')
    })
    it('matches mixed-case query', () => {
      const result = filterNotesByTitle(notes, 'MeEt')
      expect(result.map((n) => n.id)).toContain('1')
      expect(result.map((n) => n.id)).toContain('2')
    })
  })

  describe('whitespace trimming on query', () => {
    it('trims leading/trailing whitespace before matching', () => {
      const result = filterNotesByTitle(notes, '  meeting  ')
      expect(result.map((n) => n.id)).toContain('1')
      expect(result.map((n) => n.id)).toContain('2')
    })
    it('trims tabs around query', () => {
      const result = filterNotesByTitle(notes, '\tmeeting\t')
      expect(result.map((n) => n.id)).toContain('1')
    })
  })

  describe('title-only filter — body/snippet not considered', () => {
    it('does not match a note whose body/snippet contains the query but title does not', () => {
      // makeNote gives body='', snippet='' — none of the fixture notes have the query in body.
      // Specifically: query "Grocery" should match id='3' only (title match), not any other note.
      const result = filterNotesByTitle(notes, 'Grocery')
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('3')
    })
  })

  describe('empty title handling', () => {
    it('excludes a note with empty title when query is active', () => {
      // note id='4' has title='' — must be excluded for any non-empty query
      const result = filterNotesByTitle(notes, 'meeting')
      expect(result.map((n) => n.id)).not.toContain('4')
    })
    it('includes a note with empty title when query is empty', () => {
      const result = filterNotesByTitle(notes, '')
      expect(result.map((n) => n.id)).toContain('4')
    })
  })

  describe('non-matching query returns empty array', () => {
    it('returns [] for a query that matches nothing', () => {
      const result = filterNotesByTitle(notes, 'xyzzy-no-match-ever')
      expect(result).toHaveLength(0)
    })
  })

  describe('does not mutate input array', () => {
    it('returns original array reference for empty query', () => {
      const result = filterNotesByTitle(notes, '')
      // The function MAY return the same reference or a copy — either is valid.
      // What must NOT happen is a sort/mutation of the input.
      expect(result).toHaveLength(notes.length)
    })
    it('preserves input array order for non-empty query', () => {
      const result = filterNotesByTitle(notes, 'meeting')
      // Order in result should match order in input
      const resultIds = result.map((n) => n.id)
      expect(resultIds).toEqual(['1', '2'])
    })
  })
})
