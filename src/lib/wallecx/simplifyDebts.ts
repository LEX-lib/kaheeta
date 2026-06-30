import type { SplitExpense, SplitShare, BalanceSummary } from "@/types/wallecx/splits/types";

// Debt simplification — a port of split-pro's simplify step. Unlike
// computeBalances (which reports the *raw* pairwise balances), this minimises
// the number of transactions across the whole group: per currency it reduces
// each member to a single net (fronted − consumed), then greedily settles the
// largest creditor against the largest debtor until everyone is square. The
// result is then projected onto the current user's perspective. Display-only —
// nothing is persisted; it just changes which transfers are *shown*.

interface Transaction {
  from: string; // debtor
  to: string; // creditor
  amount: number; // cents, > 0
}

/** Greedily settle a per-user net map into a minimal-ish set of transactions. */
function settle(nets: Map<string, number>): Transaction[] {
  const arr = [...nets.entries()].map(([u, net]) => ({ u, net })).filter((x) => x.net !== 0);
  const txns: Transaction[] = [];

  // Each step: largest creditor pays off against largest debtor. Integer cents
  // that sum to zero per currency, so this always terminates with all nets 0.
  for (;;) {
    let maxC = -1;
    let maxD = -1;
    for (let k = 0; k < arr.length; k++) {
      if (maxC < 0 || arr[k]!.net > arr[maxC]!.net) maxC = k;
      if (maxD < 0 || arr[k]!.net < arr[maxD]!.net) maxD = k;
    }
    if (maxC < 0 || maxD < 0) break;
    const credit = arr[maxC]!.net;
    const debt = arr[maxD]!.net;
    if (credit <= 0 || debt >= 0) break; // nothing left to settle

    const amount = Math.min(credit, -debt);
    txns.push({ from: arr[maxD]!.u, to: arr[maxC]!.u, amount });
    arr[maxC]!.net -= amount;
    arr[maxD]!.net += amount;
  }

  return txns;
}

/**
 * Compute the current user's *simplified* balances (per currency). Equivalent in
 * total to computeBalances, but with intermediaries collapsed — e.g. A→B and
 * B→C becomes A→C, and B drops out.
 *
 * @returns One {@link BalanceSummary} per simplified transfer involving the
 *          current user. Positive = they owe you; negative = you owe them.
 */
export function simplifyDebts(
  expenses: SplitExpense[],
  shares: SplitShare[],
  currentUserId: string,
): BalanceSummary[] {
  const sharesByExpense = new Map<string, SplitShare[]>();
  for (const share of shares) {
    const list = sharesByExpense.get(share.expense);
    if (list) list.push(share);
    else sharesByExpense.set(share.expense, [share]);
  }

  // currency → (user → net cents); net = fronted − consumed.
  const byCurrency = new Map<string, Map<string, number>>();
  const addNet = (currency: string, user: string, delta: number) => {
    let nets = byCurrency.get(currency);
    if (!nets) {
      nets = new Map<string, number>();
      byCurrency.set(currency, nets);
    }
    nets.set(user, (nets.get(user) ?? 0) + delta);
  };

  for (const expense of expenses) {
    if (expense.deleted_at) continue;
    addNet(expense.currency, expense.paid_by, expense.amount); // fronted the whole bill
    for (const share of sharesByExpense.get(expense.id) ?? []) {
      addNet(expense.currency, share.user, -share.amount); // consumed their share
    }
  }

  const result: BalanceSummary[] = [];
  for (const [currency, nets] of byCurrency) {
    for (const txn of settle(nets)) {
      if (txn.from === currentUserId) {
        result.push({ userId: txn.to, currency, amount: -txn.amount }); // you owe them
      } else if (txn.to === currentUserId) {
        result.push({ userId: txn.from, currency, amount: txn.amount }); // they owe you
      }
    }
  }
  return result;
}
