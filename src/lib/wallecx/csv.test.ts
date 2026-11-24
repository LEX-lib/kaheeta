import { describe, expect, it } from 'vitest'
import {
  buildGroupSharesCsv,
  centsToDecimal,
  csvEscape,
  groupSharesCsvFilename,
  toCsv,
} from './csv'
import type { SplitExpense, SplitShare } from '@/types/wallecx/splits/types'

const expense = (overrides: Partial<SplitExpense>): SplitExpense =>
  ({
    id: 'e1',
    collectionId: 'kaheeta_split_expenses',
    collectionName: 'kaheeta_split_expenses',
    created: '',
    updated: '',
    group: 'g1',
    paid_by: 'u_a',
    added_by: 'u_a',
    name: 'Dinner',
    amount: 10000,
    currency: 'PHP',
    split_type: 'equal',
    expense_date: '2026-11-25',
    deleted_at: '',
    ...overrides,
  }) as SplitExpense

const share = (overrides: Partial<SplitShare>): SplitShare =>
  ({
    id: 's1',
    collectionId: 'kaheeta_split_shares',
    collectionName: 'kaheeta_split_shares',
    created: '',
    updated: '',
    expense: 'e1',
    user: 'u_a',
    amount: 5000,
    ...overrides,
  }) as SplitShare

const names: Record<string, string> = {
  u_a: 'Ana',
  u_b: 'Bob',
  u_c: 'Cara, "CC"',
}

const nameForUser = (id: string): string => names[id] ?? id

function lines(csv: string): string[] {
  return csv.replace(/^\ufeff/, '').split('\r\n').filter(Boolean)
}

describe('csvEscape', () => {
  it('leaves plain values untouched', () => {
    expect(csvEscape('Dinner')).toBe('Dinner')
    expect(csvEscape(123)).toBe('123')
  })

  it('quotes commas, quotes and newlines', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')
    expect(csvEscape('line1\r\nline2')).toBe('"line1\r\nline2"')
  })

  it('renders null/undefined as empty', () => {
    expect(csvEscape(null)).toBe('')
    expect(csvEscape(undefined)).toBe('')
  })
})

describe('toCsv', () => {
  it('writes a BOM, headers and CRLF rows', () => {
    const out = toCsv(['a', 'b'], [
      [1, 2],
      ['x', 'y'],
    ])
    expect(out.startsWith('\ufeff')).toBe(true)
    expect(out).toBe('\ufeffa,b\r\n1,2\r\nx,y\r\n')
  })
})

describe('centsToDecimal', () => {
  it('formats cents as plain decimals', () => {
    expect(centsToDecimal(12345)).toBe('123.45')
    expect(centsToDecimal(5)).toBe('0.05')
    expect(centsToDecimal(0)).toBe('0.00')
  })
})

describe('buildGroupSharesCsv', () => {
  it('emits one row per member share with the viewer share repeated', () => {
    const csv = buildGroupSharesCsv({
      groupName: 'Trip',
      expenses: [expense({})],
      shares: [
        share({ id: 's1', user: 'u_a', amount: 5000 }),
        share({ id: 's2', user: 'u_b', amount: 5000 }),
      ],
      currentUserId: 'u_b',
      nameForUser,
    })

    const rows = lines(csv)
    expect(rows).toHaveLength(3) // header + 2 shares
    expect(rows[0]).toContain('member_share')
    expect(rows[1]).toBe('Trip,2026-11-25,Dinner,equal,PHP,100.00,Ana,Ana,50.00,true,50.00,')
    expect(rows[2]).toBe('Trip,2026-11-25,Dinner,equal,PHP,100.00,Ana,Bob,50.00,false,50.00,')
  })

  it('includes settlements and flags the payer', () => {
    const csv = buildGroupSharesCsv({
      groupName: 'Trip',
      expenses: [
        expense({
          id: 'st',
          name: 'Settlement',
          split_type: 'settlement',
          paid_by: 'u_b',
          amount: 2500,
        }),
      ],
      shares: [share({ id: 'ss', expense: 'st', user: 'u_a', amount: 2500 })],
      currentUserId: 'u_b',
      nameForUser,
    })

    const rows = lines(csv)
    expect(rows).toHaveLength(2)
    expect(rows[1]).toBe(
      'Trip,2026-11-25,Settlement,settlement,PHP,25.00,Bob,Ana,25.00,false,,',
    )
  })

  it('escapes names with commas and quotes', () => {
    const csv = buildGroupSharesCsv({
      groupName: 'Trip',
      expenses: [expense({})],
      shares: [share({ id: 's3', user: 'u_c', amount: 10000 })],
      currentUserId: 'u_a',
      nameForUser,
    })
    expect(lines(csv)[1]).toContain('"Cara, ""CC"""')
  })

  it('skips soft-deleted expenses', () => {
    const csv = buildGroupSharesCsv({
      groupName: 'Trip',
      expenses: [expense({ deleted_at: '2026-11-26T00:00:00.000Z' })],
      shares: [share({})],
      currentUserId: 'u_a',
      nameForUser,
    })
    expect(lines(csv)).toHaveLength(1)
  })

  it('keeps an expense with no shares', () => {
    const csv = buildGroupSharesCsv({
      groupName: 'Trip',
      expenses: [expense({})],
      shares: [],
      currentUserId: 'u_a',
      nameForUser,
    })
    const rows = lines(csv)
    expect(rows).toHaveLength(2)
    expect(rows[1]).toBe('Trip,2026-11-25,Dinner,equal,PHP,100.00,Ana,,,false,,')
  })

  it('writes an empty my_share when the viewer is not involved', () => {
    const csv = buildGroupSharesCsv({
      groupName: 'Trip',
      expenses: [expense({})],
      shares: [
        share({ id: 's1', user: 'u_a', amount: 5000 }),
        share({ id: 's2', user: 'u_b', amount: 5000 }),
      ],
      currentUserId: 'u_c',
      nameForUser,
    })
    const rows = lines(csv)
    expect(rows[1]!.endsWith(',,')).toBe(true)
    expect(rows[2]!.endsWith(',,')).toBe(true)
  })
})

describe('groupSharesCsvFilename', () => {
  it('slugifies the group name', () => {
    expect(groupSharesCsvFilename('Bali Trip!', '2026-11-25')).toBe(
      'kaheeta-bali-trip-shares-2026-11-25.csv',
    )
  })

  it('falls back to "group" for an empty slug', () => {
    expect(groupSharesCsvFilename('!!!', '2026-11-25')).toBe(
      'kaheeta-group-shares-2026-11-25.csv',
    )
  })
})
