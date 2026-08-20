/**
 * Lightweight, provider-agnostic conversion analytics.
 *
 * There is no analytics vendor wired up yet. `track()` is a safe no-op that
 * forwards events to whatever is present at runtime, in this order:
 *   1. `window.dataLayer` (GTM-compatible) if defined
 *   2. `window.__analytics(event, props)` if a host app registers one
 *   3. dev console (only in development)
 *
 * To wire a real provider later, populate one of the above — no call sites change.
 * NEVER pass student names, emails, or other PII in `props`; use ids/enums only.
 */

export const ANALYTICS_EVENTS = {
  ctaClick: "cta_click",
  signupStarted: "signup_started",
  signupCompleted: "signup_completed",
  freeTrialBookingStarted: "free_trial_booking_started",
  freeTrialBooked: "free_trial_booked",
  paidBookingStarted: "paid_booking_started",
  paidBookingCompleted: "paid_booking_completed",
  packagePurchaseStarted: "package_purchase_started",
  packagePurchaseCompleted: "package_purchase_completed",
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

type Props = Record<string, string | number | boolean | null | undefined>;

interface AnalyticsWindow extends Window {
  dataLayer?: unknown[];
  __analytics?: (event: string, props?: Props) => void;
}

export function track(event: AnalyticsEvent, props: Props = {}): void {
  if (typeof window === "undefined") return;
  const w = window as AnalyticsWindow;
  const payload = { event, ...props };
  try {
    if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push(payload);
      return;
    }
    if (typeof w.__analytics === "function") {
      w.__analytics(event, props);
      return;
    }
    if (process.env.NODE_ENV === "development") {
      console.debug("[analytics]", event, props);
    }
  } catch {
    // Analytics must never break the app.
  }
}
