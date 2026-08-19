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
