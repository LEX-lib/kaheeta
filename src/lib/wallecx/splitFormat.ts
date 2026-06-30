// Formatting helpers for the split feature. Split amounts are integer minor
// units (cents) with a per-expense currency, so the PHP-locked formatter in
// currency.ts does not apply here.

/**
 * A short list of common ISO currency codes for the per-expense picker. The
 * Select is editable, so any other code can still be typed in — this is just
 * the convenient set.
 */
export const COMMON_CURRENCIES = [
  "USD",
  "PHP",
  "EUR",
  "GBP",
  "JPY",
  "AUD",
  "CAD",
  "SGD",
  "HKD",
  "INR",
  "CNY",
  "KRW",
] as const;

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
