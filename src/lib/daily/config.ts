/**
 * Daily configuration. Read from the environment; nothing throws at import time
 * so the app builds and all non-video functionality keeps working when Daily is
 * not configured. The API key is SERVER-ONLY and must never be exposed to the
 * browser (never prefix with NEXT_PUBLIC_).
 */
export const DAILY_API_KEY = process.env.DAILY_API_KEY;
/** Your Daily subdomain, e.g. "africantutors" → rooms live at africantutors.daily.co. */
export const DAILY_DOMAIN = process.env.DAILY_DOMAIN;
/** Optional: HMAC secret used to verify Daily webhook authenticity. */
export const DAILY_WEBHOOK_SECRET = process.env.DAILY_WEBHOOK_SECRET;

/** True when the server can create rooms + mint meeting tokens. */
export const isDailyConfigured = Boolean(DAILY_API_KEY && DAILY_DOMAIN);

/**
 * Optional Mode B (custom private S3) recording storage. When all three are set,
 * rooms are created to write cloud recordings to your own bucket (Daily assumes
 * the provided role). Absent → Mode A (Daily-managed storage), the V1 default.
 * These are server-only; AWS secret keys are NEVER used here (Daily uses an
 * assume-role ARN, not static AWS credentials).
 */
export const DAILY_S3_BUCKET = process.env.DAILY_S3_BUCKET_NAME;
export const DAILY_S3_REGION = process.env.DAILY_S3_REGION;
export const DAILY_S3_ASSUME_ROLE_ARN = process.env.DAILY_S3_ASSUME_ROLE_ARN;

/** Custom-S3 recording config for Daily room creation, or null for Mode A. */
export function recordingBucketConfig():
  | { bucket_name: string; bucket_region: string; assume_role_arn: string; allow_api_access: boolean }
  | null {
  if (DAILY_S3_BUCKET && DAILY_S3_REGION && DAILY_S3_ASSUME_ROLE_ARN) {
    return {
      bucket_name: DAILY_S3_BUCKET,
      bucket_region: DAILY_S3_REGION,
      assume_role_arn: DAILY_S3_ASSUME_ROLE_ARN,
      allow_api_access: true, // lets the server mint temporary access links
    };
  }
  return null;
}
