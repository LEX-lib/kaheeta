// Formatting helpers for the split feature. Split amounts are integer minor
// units (cents) with a per-group currency, so the PHP-locked formatter in
// currency.ts does not apply here.

/**
 * Format an integer-cents amount in a given ISO currency, e.g.
 * `formatCents(12345, "USD") === "$123.45"`. Falls back to a plain
 * `<major>.<minor> <code>` string if the currency code is not recognised by
 * Intl (so a typo'd group currency never throws).
 */
export function formatCents(amountCents: number, currency: string): string {
  const major = amountCents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}
