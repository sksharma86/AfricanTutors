/**
 * Study Hall PR2 customer catalog constants.
 * Internal prepaid ledger remains minutes: 1 Study Hall = 60 minutes.
 */

export const STUDY_HALL_MINUTES = 60;

export const PACKAGE_CODE_10_STUDY_HALLS = "pkg_10sh";
export const PACKAGE_10SH_MINUTES = 600;
export const PACKAGE_10SH_PRICE_CENTS = 10000;
export const PACKAGE_10SH_STUDY_HALLS = 10;

/** Historical SKUs kept in the catalog for existing balances / tests. */
export const LEGACY_ACTIVE_PACKAGE_CODES = ["pkg_14h", "pkg_28h"];
export const HISTORICAL_INACTIVE_PACKAGE_CODES = ["pkg_10h", "pkg_20h", "pkg_40h"];

/** New Parent Portal purchase UI offers only this prepaid SKU. */
export const CUSTOMER_PREPAID_OFFER_CODES = [PACKAGE_CODE_10_STUDY_HALLS];

export const STUDY_HALL_365_MONTHLY_CENTS = 14900;
export const STUDY_HALL_365_MONTHLY_USD = 149;
export const STUDY_HALL_365_PRODUCT_NAME = "Study Hall 365";
export const STUDY_HALL_365_KIND = "study_hall_365";
