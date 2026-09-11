/**
 * Study Hall PR2 customer catalog constants.
 * Internal prepaid ledger remains minutes: 1 Study Hall = 60 minutes.
 */

export const STUDY_HALL_MINUTES = 60;

export const PACKAGE_CODE_10_STUDY_HALLS = "pkg_10sh";
export const PACKAGE_10SH_MINUTES = 600;
export const PACKAGE_10SH_PRICE_CENTS = 9900;
export const PACKAGE_10SH_STUDY_HALLS = 10;

/**
 * Historical SKUs. Remaining purchased minutes stay usable.
 * 0047 deactivates these as new customer offers (is_active=false).
 */
export const LEGACY_PREPAID_PACKAGE_CODES = ["pkg_14h", "pkg_28h"];
/** @deprecated Use LEGACY_PREPAID_PACKAGE_CODES. Kept for existing imports. */
export const LEGACY_ACTIVE_PACKAGE_CODES = LEGACY_PREPAID_PACKAGE_CODES;
export const HISTORICAL_INACTIVE_PACKAGE_CODES = ["pkg_10h", "pkg_20h", "pkg_40h"];

/** New Parent Portal purchase UI offers only this prepaid SKU. */
export const CUSTOMER_PREPAID_OFFER_CODES = [PACKAGE_CODE_10_STUDY_HALLS];

/**
 * Hours / purchase UI lists only pkg_10sh.
 * Legacy 14h/28h are never re-offered, even as a fallback if pkg_10sh is
 * missing from the query result. Historical balances are independent of this
 * list — they live on package_minute_ledger.
 *
 * @template {{ code?: string }} T
 * @param {T[] | null | undefined} packages
 * @returns {T[]}
 */
export function customerFacingPrepaidPackages(packages) {
  const rows = Array.isArray(packages) ? packages : [];
  const blocked = new Set([...LEGACY_PREPAID_PACKAGE_CODES, ...HISTORICAL_INACTIVE_PACKAGE_CODES]);
  const ten = rows.filter((p) => p && CUSTOMER_PREPAID_OFFER_CODES.includes(p.code));
  if (ten.length > 0) return ten;
  return rows.filter((p) => p && p.code && !blocked.has(p.code));
}

export const STUDY_HALL_365_MONTHLY_CENTS = 14900;
export const STUDY_HALL_365_MONTHLY_USD = 149;
export const STUDY_HALL_365_PRODUCT_NAME = "Study Hall 365";
export const STUDY_HALL_365_KIND = "study_hall_365";
