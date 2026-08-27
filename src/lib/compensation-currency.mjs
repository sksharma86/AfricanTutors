/**
 * Guide compensation currencies (separate from customer Stripe USD).
 * Amounts are stored as integer minor units (cents / centavos / kobo / paise).
 * No FX conversion lives here — display only.
 */

export const COMPENSATION_CURRENCIES = ["KES", "USD", "INR", "PHP", "NGN"];

const LOCALE_BY_CURRENCY = {
  KES: "en-KE",
  USD: "en-US",
  INR: "en-IN",
  PHP: "en-PH",
  NGN: "en-NG",
};

export function normalizeCompensationCurrency(code) {
  const c = String(code ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(c)) return c;
  return null;
}

export function isSupportedCompensationCurrency(code) {
  const c = normalizeCompensationCurrency(code);
  return c != null && COMPENSATION_CURRENCIES.includes(c);
}

/**
 * Format minor units in the given ISO currency.
 * KES displays as KSh (not $). USD keeps two decimals.
 */
export function formatCompensationMinor(minorUnits, currency) {
  const code = normalizeCompensationCurrency(currency) ?? "USD";
  const major = Number(minorUnits || 0) / 100;
  const hideFraction = Number.isInteger(major) && code !== "USD";
  let formatted = new Intl.NumberFormat(LOCALE_BY_CURRENCY[code] ?? "en-US", {
    style: "currency",
    currency: code,
    minimumFractionDigits: hideFraction ? 0 : 2,
    maximumFractionDigits: hideFraction ? 0 : 2,
  }).format(major);
  if (code === "KES") {
    formatted = formatted.replace(/KES\s*/i, "KSh ").replace(/Ksh/g, "KSh");
  }
  return formatted.replace(/\s+/g, " ").trim();
}

export function formatCompensationHourly(minorUnits, currency) {
  return `${formatCompensationMinor(minorUnits, currency)} / hour`;
}

/**
 * Sum earned / paid / outstanding per currency. Never mixes currencies.
 * @param {{ amount_cents: number, status: string, currency?: string|null }[]} rows
 */
export function aggregateCompensationByCurrency(rows) {
  const by = new Map();
  for (const row of rows ?? []) {
    if (!row || row.status === "voided") continue;
    const currency = normalizeCompensationCurrency(row.currency) ?? "USD";
    const entry = by.get(currency) ?? { currency, earned: 0, paid: 0, outstanding: 0 };
    const amount = Number(row.amount_cents) || 0;
    entry.earned += amount;
    if (row.status === "paid") entry.paid += amount;
    else entry.outstanding += amount;
    by.set(currency, entry);
  }
  const known = COMPENSATION_CURRENCIES.filter((c) => by.has(c));
  const extra = [...by.keys()].filter((c) => !COMPENSATION_CURRENCIES.includes(c)).sort();
  return known.concat(extra).map((c) => by.get(c));
}

/** Format grouped ledger totals. Never concatenates mixed-currency numbers into one figure. */
export function formatCompensationTotals(totals, field) {
  const rows = totals ?? [];
  if (rows.length === 0) return formatCompensationMinor(0, "USD");
  return rows.map((t) => formatCompensationMinor(t[field] ?? 0, t.currency)).join(" · ");
}

/**
 * Per-Guide compensation view for Finance Center.
 * Rate uses the Guide's configured currency. Ledger totals stay grouped by
 * snapshotted earning currency so a later currency change cannot mix history.
 */
export function summarizeGuideCompensation(guides, earnings) {
  const byTutor = new Map();
  for (const row of earnings ?? []) {
    if (!row?.tutor_id) continue;
    const list = byTutor.get(row.tutor_id) ?? [];
    list.push(row);
    byTutor.set(row.tutor_id, list);
  }
  return (guides ?? []).map((g) => ({
    profile_id: g.profile_id,
    name: g.name,
    rate_cents: g.rate_cents ?? null,
    currency: normalizeCompensationCurrency(g.currency) ?? "USD",
    totals: aggregateCompensationByCurrency(byTutor.get(g.profile_id) ?? []),
  }));
}
