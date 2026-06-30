import { describe, it, expect } from 'vitest';
import { simplifyDebts } from './simplifyDebts';
import { computeBalances } from './balances';
import type { SplitExpense, SplitShare } from '@/types/wallecx/splits/types';

let seq = 0;
function expense(paid_by: string, amount: number, id?: string, currency = 'USD'): SplitExpense {
  seq += 1;
  return {
    id: id ?? `e${seq}`,
    created: '',
    updated: '',
    group: 'g1',
    paid_by,
    added_by: paid_by,
    name: 'X',
    amount,
    currency,
    split_type: 'equal',
    expense_date: '2026-06-01',
  } as SplitExpense;
}
function share(expenseId: string, user: string, amount: number): SplitShare {
  return { id: `${expenseId}-${user}`, created: '', updated: '', expense: expenseId, user, amount } as SplitShare;
}

describe('simplifyDebts', () => {
  // A owes B 10, B owes C 10  →  simplified: A owes C 10, B drops out.
  const expenses = [expense('u_b', 1000, 'e1'), expense('u_c', 1000, 'e2')];
  const shares = [
    share('e1', 'u_a', 1000), // B paid, A consumed → A owes B
    share('e2', 'u_b', 1000), // C paid, B consumed → B owes C
  ];

  it('collapses a chain (A→B→C becomes A→C)', () => {
    const a = simplifyDebts(expenses, shares, 'u_a');
    expect(a).toEqual([{ userId: 'u_c', currency: 'USD', amount: -1000 }]); // A owes C

    const c = simplifyDebts(expenses, shares, 'u_c');
    expect(c).toEqual([{ userId: 'u_a', currency: 'USD', amount: 1000 }]); // A owes C
  });

  it('drops the intermediary (B nets to zero)', () => {
    // Pairwise, B sees two rows; simplified, B sees none.
    expect(computeBalances(expenses, shares, 'u_b')).toHaveLength(2);
    expect(simplifyDebts(expenses, shares, 'u_b')).toEqual([]);
  });

  it('preserves each user total vs raw balances (just fewer transfers)', () => {
    const rawTotal = (uid: string) =>
      computeBalances(expenses, shares, uid).reduce((s, b) => s + b.amount, 0);
    const simpTotal = (uid: string) =>
      simplifyDebts(expenses, shares, uid).reduce((s, b) => s + b.amount, 0);
    for (const uid of ['u_a', 'u_b', 'u_c']) {
      expect(simpTotal(uid)).toBe(rawTotal(uid));
    }
  });

  it('keeps currencies separate', () => {
    const exps = [expense('u_b', 1000, 'e1', 'USD'), expense('u_b', 2000, 'e2', 'EUR')];
    const shrs = [share('e1', 'u_a', 1000), share('e2', 'u_a', 2000)];
    const a = simplifyDebts(exps, shrs, 'u_a');
    expect(a).toEqual(
      expect.arrayContaining([
        { userId: 'u_b', currency: 'USD', amount: -1000 },
        { userId: 'u_b', currency: 'EUR', amount: -2000 },
      ]),
    );
    expect(a).toHaveLength(2);
  });

  it('skips soft-deleted expenses', () => {
    const e = expense('u_b', 1000, 'e1');
    e.deleted_at = '2026-06-02';
    expect(simplifyDebts([e], [share('e1', 'u_a', 1000)], 'u_a')).toEqual([]);
  });

  it('returns nothing when everyone is square', () => {
    // A and B each pay 10 split equally → both net zero.
    const exps = [expense('u_a', 1000, 'e1'), expense('u_b', 1000, 'e2')];
    const shrs = [
      share('e1', 'u_a', 500),
      share('e1', 'u_b', 500),
      share('e2', 'u_a', 500),
      share('e2', 'u_b', 500),
    ];
    expect(simplifyDebts(exps, shrs, 'u_a')).toEqual([]);
  });
});
