// Split math for shared expenses. All amounts are integer minor units (cents)
// to avoid float drift — see docs/features/shared-splits-plan.md (decision 4).

/**
 * Split a total equally across participants, distributing remainder cents so the
 * parts sum *exactly* to the total. The first `total % n` participants each get
 * one extra cent.
 *
 * @param totalCents     The full expense amount in integer minor units.
 * @param participantIds The user ids sharing the expense (order is significant:
 *                        leftmost participants absorb the remainder cents).
 * @returns A map of participant id → owed amount in cents. The values always
 *          sum to `totalCents`.
 */
export function equalSplit(
  totalCents: number,
  participantIds: string[],
): Record<string, number> {
  const result: Record<string, number> = {};
  const n = participantIds.length;
  if (n === 0) {
    return result;
  }

  const base = Math.floor(totalCents / n);
  let remainder = totalCents - base * n; // works for negative totals too

  for (const id of participantIds) {
    let share = base;
    if (remainder > 0) {
      share += 1;
      remainder -= 1;
    }
    result[id] = share;
  }

  return result;
}
