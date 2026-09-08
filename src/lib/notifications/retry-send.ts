/**
 * PR7E — send a leased email_deliveries row after revalidation.
 * Never throws. Does not create a new idempotency key.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { sendEmail } from "@/lib/email/transport";
import { decideRetryAction } from "@/lib/notifications/retry-revalidate.mjs";
import {
  EMAIL_RETRY_MAX_ATTEMPTS,
  parseDeliveryIdentity,
} from "@/lib/notifications/retry-policy.mjs";
import { getServiceSupabase } from "@/lib/supabase/service";

type DeliveryRow = {
  id?: string;
  idempotency_key?: string;
  notification_type?: string | null;
  to_email?: string | null;
  subject?: string | null;
  body_html?: string | null;
  body_text?: string | null;
  booking_id?: string | null;
  recipient_account_id?: string | null;
  attempts?: number | null;
  [key: string]: unknown;
};

type Service = SupabaseClient;

async function complete(
  service: Service,
  key: string,
  status: string,
  extra: { providerId?: string | null; error?: string | null } = {},
) {
  await service.rpc("complete_email_delivery", {
    p_key: key,
    p_status: status,
    p_provider_message_id: extra.providerId ?? null,
    p_error: extra.error ?? null,
  });
}

async function countProviderSendAttempt(service: Service, key: string, previousAttempts: number) {
  if (previousAttempts >= EMAIL_RETRY_MAX_ATTEMPTS) return false;
  const { data, error } = await service
    .from("email_deliveries")
    .update({
      attempts: previousAttempts + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("idempotency_key", key)
    .eq("status", "pending")
    .eq("attempts", previousAttempts)
    .select("attempts")
    .maybeSingle();
  return !error && data != null;
}

async function loadContext(service: Service, delivery: DeliveryRow) {
  const identity = parseDeliveryIdentity(delivery);
  const bookingId = delivery.booking_id || identity.bookingId;
  const type = String(delivery.notification_type || "");
  let booking = null;
  if (bookingId) {
    const { data } = await service
      .from("bookings")
      .select("id, status, payment_status, scheduled_start, tutor_id, account_id")
      .eq("id", bookingId)
      .maybeSingle();
    booking = data;
  }

  let membership = null;
  const needsMembership =
    type === "payment_failure" ||
    type === "study_hall_365_cancellation_scheduled" ||
    type === "study_hall_365_resumed" ||
    type === "study_hall_365_ended";
  if (needsMembership) {
    if (type === "payment_failure" && identity.invoiceId) {
      const { data } = await service
        .from("study_hall_365_subscriptions")
        .select("status, cancel_at_period_end, ended_at, current_period_end, stripe_latest_invoice_id, account_id")
        .eq("stripe_latest_invoice_id", identity.invoiceId)
        .maybeSingle();
      membership = data;
    }
    if (!membership && identity.stripeSubscriptionId) {
      const { data } = await service
        .from("study_hall_365_subscriptions")
        .select("status, cancel_at_period_end, ended_at, current_period_end, stripe_latest_invoice_id, account_id")
        .eq("stripe_subscription_id", identity.stripeSubscriptionId)
        .maybeSingle();
      membership = data;
    }
    if (!membership && delivery.recipient_account_id) {
      const { data } = await service
        .from("study_hall_365_subscriptions")
        .select("status, cancel_at_period_end, ended_at, current_period_end, stripe_latest_invoice_id, account_id")
        .eq("account_id", delivery.recipient_account_id)
        .is("ended_at", null)
        .maybeSingle();
      membership = data;
    }
  }

  let profileExists = true;
  if (type === "welcome" && (identity.accountId || delivery.recipient_account_id)) {
    const id = identity.accountId || delivery.recipient_account_id;
    const { data } = await service.from("profiles").select("id").eq("id", id).maybeSingle();
    profileExists = Boolean(data?.id);
  }

  let reportExists: boolean | null = null;
  if (type === "session_report_ready" && identity.reportId) {
    const { data } = await service.from("session_reports").select("id").eq("id", identity.reportId).maybeSingle();
    reportExists = Boolean(data?.id);
  } else if ((type === "guide_report_required" || type === "guide_report_overdue") && bookingId) {
    const { data } = await service.from("session_reports").select("id").eq("booking_id", bookingId).limit(1);
    reportExists = Array.isArray(data) ? data.length > 0 : Boolean(data);
  }

  let packageMinutes: number | null = null;
  if (
    (type === "package_balance_low" || type === "package_balance_depleted") &&
    delivery.recipient_account_id
  ) {
    const { data } = await service.rpc("get_package_minutes", { p_account: delivery.recipient_account_id });
    packageMinutes = typeof data === "number" ? data : null;
  }

  let attendanceAwaiting: boolean | null = null;
  if (type === "guide_attendance_request" && bookingId) {
    let q = service
      .from("guide_attendance_assignments")
      .select("id")
      .eq("booking_id", bookingId)
      .eq("status", "awaiting")
      .limit(1);
    if (identity.tutorId) q = q.eq("tutor_id", identity.tutorId);
    const { data } = await q;
    attendanceAwaiting = Array.isArray(data) ? data.length > 0 : Boolean(data);
  }

  let coverageOfferOpen: boolean | null = null;
  if (type === "guide_open_coverage" && bookingId) {
    let q = service
      .from("guide_open_coverage_offers")
      .select("id")
      .eq("booking_id", bookingId)
      .eq("status", "open")
      .limit(1);
    if (identity.tutorId) q = q.eq("tutor_id", identity.tutorId);
    const { data } = await q;
    coverageOfferOpen = Array.isArray(data) ? data.length > 0 : Boolean(data);
  }

  return {
    booking,
    membership,
    profileExists,
    reportExists,
    packageMinutes,
    attendanceAwaiting,
    coverageOfferOpen,
  };
}

export async function evaluateEmailDeliveryRetry(delivery: DeliveryRow) {
  const service = getServiceSupabase();
  const ctx = await loadContext(service, delivery);
  return decideRetryAction({
    delivery,
    booking: ctx.booking,
    membership: ctx.membership,
    profileExists: ctx.profileExists,
    reportExists: ctx.reportExists ?? undefined,
    packageMinutes: ctx.packageMinutes,
    attendanceAwaiting: ctx.attendanceAwaiting ?? undefined,
    coverageOfferOpen: ctx.coverageOfferOpen ?? undefined,
  });
}

/**
 * @param delivery leased email_deliveries row
 * @param opts.countAttempt increment attempts immediately before sendEmail (cron).
 *   Admin retry_email_delivery already incremented.
 */
export async function sendLeasedEmailDelivery(
  delivery: DeliveryRow,
  opts: { countAttempt?: boolean } = {},
) {
  const service = getServiceSupabase();
  const key = String(delivery.idempotency_key || "");
  if (!key) return { status: "failed", reason: "missing_idempotency_key" };
  try {
    const ctx = await loadContext(service, delivery);
    const decision = decideRetryAction({
      delivery,
      booking: ctx.booking,
      membership: ctx.membership,
      profileExists: ctx.profileExists,
      reportExists: ctx.reportExists ?? undefined,
      packageMinutes: ctx.packageMinutes,
      attendanceAwaiting: ctx.attendanceAwaiting ?? undefined,
      coverageOfferOpen: ctx.coverageOfferOpen ?? undefined,
    });
    if (!decision.ok) {
      await complete(service, key, "skipped", { error: decision.reason });
      return { status: "skipped", reason: decision.reason };
    }
    if (opts.countAttempt !== false) {
      const counted = await countProviderSendAttempt(service, key, Number(delivery.attempts ?? 0));
      if (!counted) {
        return { status: "skipped", reason: "send_lease_lost" };
      }
    }
    const result = await sendEmail({
      to: String(delivery.to_email || ""),
      subject: String(delivery.subject || ""),
      html: String(delivery.body_html || ""),
      text: String(delivery.body_text || ""),
      type: delivery.notification_type || undefined,
      idempotencyKey: typeof delivery.id === "string" ? delivery.id : null,
    });
    await complete(service, key, result.status, {
      providerId: result.id ?? null,
      error: result.error ?? null,
    });
    return { status: result.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : "retry exception";
    try {
      await complete(service, key, "failed", { error: message });
    } catch {
      /* ignore */
    }
    return { status: "failed", reason: message };
  }
}
