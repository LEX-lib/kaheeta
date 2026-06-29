import { describe, it, expect } from 'vitest';
import { computeBalances } from './balances';
import type { SplitExpense, SplitShare, SplitType } from '@/types/wallecx/splits/types';

let seq = 0;
function expense(
  partial: Partial<SplitExpense> & { paid_by: string },
): SplitExpense {
  seq += 1;
  return {
    id: `e${seq}`,
    created: '',
    updated: '',
    group: 'g1',
    added_by: partial.paid_by,
    name: 'Test',
    amount: 0,
    currency: 'USD',
    split_type: 'equal' as SplitType,
    expense_date: '2026-06-01',
    ...partial,
  } as SplitExpense;
}

function share(expenseId: string, user: string, amount: number): SplitShare {
  return {
    id: `${expenseId}-${user}`,
    created: '',
    updated: '',
    expense: expenseId,
    user,
    amount,
  } as SplitShare;
}

describe('computeBalances', () => {
  it('two-person equal split: payer is owed the other half', () => {
    // Alice pays 100.00, split equally with Bob.
    const e = expense({ id: 'e', paid_by: 'alice', amount: 10000 });
    const shares = [share('e', 'alice', 5000), share('e', 'bob', 5000)];

    const alice = computeBalances([e], shares, 'alice');
    expect(alice).toEqual([{ userId: 'bob', currency: 'USD', amount: 5000 }]);

    const bob = computeBalances([e], shares, 'bob');
    expect(bob).toEqual([{ userId: 'alice', currency: 'USD', amount: -5000 }]);
  });

  it('aggregates multiple expenses per person', () => {
    const e1 = expense({ id: 'e1', paid_by: 'alice', amount: 10000 });
    const e2 = expense({ id: 'e2', paid_by: 'bob', amount: 4000 });
    const shares = [
      share('e1', 'alice', 5000),
      share('e1', 'bob', 5000),
      share('e2', 'alice', 2000),
      share('e2', 'bob', 2000),
    ];
    // Alice: +5000 (e1) - 2000 (e2 my share, Bob paid) = +3000
    expect(computeBalances([e1, e2], shares, 'alice')).toEqual([
      { userId: 'bob', currency: 'USD', amount: 3000 },
    ]);
  });

  it('three-person split owes the payer from two people', () => {
    const e = expense({ id: 'e', paid_by: 'alice', amount: 9000 });
    const shares = [
      share('e', 'alice', 3000),
      share('e', 'bob', 3000),
      share('e', 'carol', 3000),
    ];
    const alice = computeBalances([e], shares, 'alice');
    expect(alice).toEqual(
      expect.arrayContaining([
        { userId: 'bob', currency: 'USD', amount: 3000 },
        { userId: 'carol', currency: 'USD', amount: 3000 },
      ]),
    );
    expect(alice).toHaveLength(2);
  });

  it('a settlement cancels a balance', () => {
    const e = expense({ id: 'e', paid_by: 'alice', amount: 10000 });
    const shares = [share('e', 'alice', 5000), share('e', 'bob', 5000)];
    // Bob settles up: Bob pays Alice 50.00 (settlement = expense paid_by bob,
    // sole share assigned to alice).
    const settle = expense({
      id: 's',
      paid_by: 'bob',
      amount: 5000,
      split_type: 'settlement',
    });
    const settleShares = [share('s', 'alice', 5000)];

    const alice = computeBalances([e, settle], [...shares, ...settleShares], 'alice');
    expect(alice).toEqual([]); // +5000 from e, -5000 from settlement → netted out
  });

  it('skips soft-deleted expenses', () => {
    const e = expense({ id: 'e', paid_by: 'alice', amount: 10000, deleted_at: '2026-06-02' });
    const shares = [share('e', 'alice', 5000), share('e', 'bob', 5000)];
    expect(computeBalances([e], shares, 'alice')).toEqual([]);
  });

  it('keeps currencies separate', () => {
    const e1 = expense({ id: 'e1', paid_by: 'alice', amount: 10000, currency: 'USD' });
    const e2 = expense({ id: 'e2', paid_by: 'bob', amount: 10000, currency: 'EUR' });
    const shares = [
      share('e1', 'alice', 5000),
      share('e1', 'bob', 5000),
      share('e2', 'alice', 5000),
      share('e2', 'bob', 5000),
    ];
    const alice = computeBalances([e1, e2], shares, 'alice');
    expect(alice).toEqual(
      expect.arrayContaining([
        { userId: 'bob', currency: 'USD', amount: 5000 },
        { userId: 'bob', currency: 'EUR', amount: -5000 },
      ]),
    );
    expect(alice).toHaveLength(2);
  });
});
