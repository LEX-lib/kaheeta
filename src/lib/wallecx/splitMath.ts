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

/**
 * Split a total across participants in proportion to integer/decimal weights,
 * distributing the leftover cents by the **largest fractional remainder** so the
 * parts sum *exactly* to the total. Powers both the percentage split (weights are
 * percentages) and the shares split (weights are share counts) — the algorithm is
 * identical because only the *relative* weights matter.
 *
 * @param totalCents The full expense amount in integer minor units.
 * @param weights    Map of participant id → weight (percentage or share count).
 *                   Zero/negative total weight yields all-zero shares.
 * @returns A map of participant id → owed amount in cents, summing to
 *          `totalCents` (when the weight total is positive).
 */
export function weightedSplit(
  totalCents: number,
  weights: Record<string, number>,
): Record<string, number> {
  const ids = Object.keys(weights);
  const result: Record<string, number> = {};
  if (ids.length === 0) {
    return result;
  }

  const totalWeight = ids.reduce((sum, id) => sum + (weights[id] ?? 0), 0);
  if (totalWeight <= 0) {
    for (const id of ids) {
      result[id] = 0;
    }
    return result;
  }

  // Floor each share, tracking the fractional remainder for tie-breaking.
  const remainders: Array<{ id: string; frac: number }> = [];
  let allocated = 0;
  for (const id of ids) {
    const exact = (totalCents * (weights[id] ?? 0)) / totalWeight;
    const floor = Math.floor(exact);
    result[id] = floor;
    allocated += floor;
    remainders.push({ id, frac: exact - floor });
  }

  // Hand out the leftover cents to the largest fractional remainders first.
  let leftover = totalCents - allocated;
  remainders.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < remainders.length && leftover > 0; i++) {
    const id = remainders[i]!.id;
    result[id] = (result[id] ?? 0) + 1;
    leftover -= 1;
  }

  return result;
}

/**
 * Recover the integer percentage weights that produced a set of stored shares.
 * The expense row only persists resolved cents, so edit mode has to
 * reverse-engineer the original percentages: run the same largest-remainder
 * split on a total of 100. The result always sums to exactly 100 (when the
 * stored shares sum to something positive), so the editor opens valid.
 *
 * @param centsByUser Stored share amounts in integer minor units, by user id.
 * @returns Integer percentages per user id summing to 100 (empty when all zero).
 */
export function percentagesFromShares(
  centsByUser: Record<string, number>,
): Record<string, number> {
  return weightedSplit(100, centsByUser);
}

/**
 * Recover integer share-count weights from stored share cents, e.g.
 * `{ a: 5000, b: 2500, c: 2500 }` → `{ a: 2, b: 1, c: 1 }`. Divide by the
 * greatest common divisor when that produces a clean ratio; otherwise fall back
 * to rounding each amount against the smallest positive share (which collapses
 * remainder-cent noise like `3334/3333/3333` back to `1/1/1`).
 *
 * @param centsByUser Stored share amounts in integer minor units, by user id.
 * @returns Positive integer weights per user id (zero stays zero).
 */
export function shareCountsFromShares(
  centsByUser: Record<string, number>,
): Record<string, number> {
  const ids = Object.keys(centsByUser);
  const result: Record<string, number> = {};
  if (ids.length === 0) {
    return result;
  }

  const positives = ids
    .map((id) => Math.abs(centsByUser[id] ?? 0))
    .filter((value) => value > 0);
  if (positives.length === 0) {
    for (const id of ids) {
      result[id] = 1;
    }
    return result;
  }

  let divisor = positives[0]!;
  for (const value of positives.slice(1)) {
    divisor = gcd(divisor, value);
  }

  if (divisor <= 1) {
    // No clean common factor — normalise against the smallest positive share.
    const min = Math.min(...positives);
    for (const id of ids) {
      const value = Math.abs(centsByUser[id] ?? 0);
      result[id] = value > 0 ? Math.max(1, Math.round(value / min)) : 0;
    }
    return result;
  }

  for (const id of ids) {
    const value = Math.abs(centsByUser[id] ?? 0);
    result[id] = value > 0 ? Math.round(value / divisor) : 0;
  }
  return result;
}

function gcd(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}
