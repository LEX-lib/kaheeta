import type { SplitExpense, SplitShare } from '@/types/wallecx/splits/types'

/**
 * CSV export of a group's ledger, one row per (expense × member share) so every
 * member can pivot their own share in a spreadsheet. Amounts are written as
 * plain decimal major units (`123.45`) — never locale-formatted — and the file
 * is UTF-8 with a BOM so Excel opens it correctly.
 */

/** RFC 4180 escaping: quote when the value contains a separator, quote or newline. */
export function csvEscape(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value)
  // Neutralize spreadsheet formula injection on text cells. Numbers (including
  // negative ones) must stay numeric so they still sum in the sheet.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/** Join headers + rows into a CRLF-delimited CSV document with a UTF-8 BOM. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(','))
  return `\ufeff${lines.join('\r\n')}\r\n`
}

/** Cents → plain decimal major units, e.g. `1234` → `"12.34"`. */
export function centsToDecimal(cents: number): string {
  return (Math.round(cents) / 100).toFixed(2)
}

export interface SharesCsvInput {
  groupName: string
  expenses: SplitExpense[]
  shares: SplitShare[]
  currentUserId: string
  /** Resolve a users record id to a display name. */
  nameForUser: (userId: string) => string
}

export const SHARES_CSV_HEADERS = [
  'group',
  'expense_date',
  'description',
  'split_type',
  'currency',
  'expense_amount',
  'paid_by',
  'member',
  'member_share',
  'is_payer',
  'my_share',
  'notes',
] as const

/**
 * Build the group-shares CSV. Soft-deleted expenses are skipped; settlements are
 * included (flagged by `split_type`) so the report reconciles with balances.
 */
export function buildGroupSharesCsv(input: SharesCsvInput): string {
  const sharesByExpense = new Map<string, SplitShare[]>()
  for (const share of input.shares) {
    const list = sharesByExpense.get(share.expense)
    if (list) list.push(share)
    else sharesByExpense.set(share.expense, [share])
  }

  const rows: unknown[][] = []
  for (const expense of input.expenses) {
    if (expense.deleted_at) continue
    const expenseShares = sharesByExpense.get(expense.id) ?? []
    const myShareCents = expenseShares.find((s) => s.user === input.currentUserId)?.amount

    const base = [
      input.groupName,
      expense.expense_date?.slice(0, 10) ?? '',
      expense.name,
      expense.split_type,
      expense.currency,
      centsToDecimal(expense.amount),
      input.nameForUser(expense.paid_by),
    ]
    const tail = [myShareCents === undefined ? '' : centsToDecimal(myShareCents), expense.notes ?? '']

    if (expenseShares.length === 0) {
      // Preserve the expense even when its shares are missing (data repair).
      rows.push([...base, '', '', 'false', ...tail])
      continue
    }

    for (const share of expenseShares) {
      rows.push([
        ...base,
        input.nameForUser(share.user),
        centsToDecimal(share.amount),
        share.user === expense.paid_by ? 'true' : 'false',
        ...tail,
      ])
    }
  }

  return toCsv([...SHARES_CSV_HEADERS], rows)
}

/** `kaheeta-trip-shares-2026-11-25.csv` */
export function groupSharesCsvFilename(groupName: string, isoDate: string): string {
  const slug = groupName
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return `kaheeta-${slug || 'group'}-shares-${isoDate}.csv`
}
