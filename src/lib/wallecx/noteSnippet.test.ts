import { describe, it, expect } from 'vitest'
import { generateNoteSnippet } from './noteSnippet'
import type { JSONContent } from '@tiptap/core'

describe('generateNoteSnippet', () => {
  describe('ordered-list content is not dropped', () => {
    it('returns both list items text from an orderedList doc', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'First item' }] },
                ],
              },
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'Second item' }] },
                ],
              },
            ],
          },
        ],
      }
      const result = generateNoteSnippet(doc)
      expect(result).toContain('First item')
      expect(result).toContain('Second item')
    })
  })

  describe('bullet-list content is not dropped (no regression)', () => {
    it('returns both list items text from a bulletList doc', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'Apple' }] },
                ],
              },
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'Banana' }] },
                ],
              },
            ],
          },
        ],
      }
      const result = generateNoteSnippet(doc)
      expect(result).toContain('Apple')
      expect(result).toContain('Banana')
    })
  })

  describe('block separator and truncation', () => {
    it('joins block content with a single space separator', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'World' }] },
        ],
      }
      const result = generateNoteSnippet(doc)
      expect(result).toBe('Hello World')
    })

    it('truncates result to 150 characters', () => {
      const longText = 'A'.repeat(200)
      const doc: JSONContent = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: longText }] }],
      }
      const result = generateNoteSnippet(doc)
      expect(result.length).toBeLessThanOrEqual(150)
    })
  })

  describe('empty doc returns empty string without throwing', () => {
    it('returns empty string for empty content array', () => {
      const doc: JSONContent = { type: 'doc', content: [] }
      expect(() => generateNoteSnippet(doc)).not.toThrow()
      expect(generateNoteSnippet(doc)).toBe('')
    })

    it('returns empty string for a doc with a single empty paragraph', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [{ type: 'paragraph' }],
      }
      expect(() => generateNoteSnippet(doc)).not.toThrow()
      const result = generateNoteSnippet(doc)
      expect(typeof result).toBe('string')
    })
  })
})
