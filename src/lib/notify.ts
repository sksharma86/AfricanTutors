import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import * as T from "@/lib/email/templates.mjs";
import { sendEmail } from "@/lib/email/transport";
import { getServiceSupabase } from "@/lib/supabase/service";

/**
 * Central, idempotent transactional-notification service.
 *
 * Every business email is claimed under a STABLE key (e.g.
 * `booking-confirmed:<booking_id>`) via `claim_email_delivery`, so financial /
 * webhook / cron retries never send a duplicate. Recipients are resolved
 * server-side from authoritative profile/auth data — never from a client-supplied
 * address. Nothing here ever throws or blocks the caller's business action.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL || null;

const firstName = (name?: string | null) => (name ? name.split(" ")[0] : null);

async function emailForAccount(service: SupabaseClient, accountId: string | null): Promise<string | null> {
  if (!accountId) return null;
  try {
    const { data } = await service.auth.admin.getUserById(accountId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Claim → resolve recipient → send → record. Returns the outcome; never throws.
 */
async function deliver(opts: {
  key: string;
  type: string;
  accountId?: string | null;
  bookingId?: string | null;
  toEmailOverride?: string | null;
  rendered: { subject: string; html: string; text: string };
}): Promise<{ status: string }> {
  const service = getServiceSupabase();
  try {
    const to = opts.toEmailOverride ?? (await emailForAccount(service, opts.accountId ?? null));
    const claim = await service.rpc("claim_email_delivery", {
      p_key: opts.key,
      p_type: opts.type,
      p_account: opts.accountId ?? null,
      p_to: to,
      p_booking: opts.bookingId ?? null,
      // Persist rendered content so a failed delivery can be retried later.
      p_subject: opts.rendered.subject,
      p_html: opts.rendered.html,
      p_text: opts.rendered.text,
    });
    if (claim.error) return { status: "error" };
    if (claim.data !== true) return { status: "duplicate" }; // already claimed → do not resend

    if (!to) {
      await service.rpc("complete_email_delivery", { p_key: opts.key, p_status: "skipped", p_error: "no recipient email" });
      return { status: "skipped" };
    }
    const result = await sendEmail({ to, subject: opts.rendered.subject, html: opts.rendered.html, text: opts.rendered.text });
    await service.rpc("complete_email_delivery", {
      p_key: opts.key,
      p_status: result.status,
      p_provider_message_id: result.id ?? null,
      p_error: result.error ?? null,
    });
    return { status: result.status };
  } catch {
    // Best-effort: mark failed if possible, but never surface to the caller.
    try {
      await getServiceSupabase().rpc("complete_email_delivery", { p_key: opts.key, p_status: "failed", p_error: "notify exception" });
    } catch {
      /* ignore */
    }
    return { status: "failed" };
  }
}

// --- Context loaders --------------------------------------------------------

async function loadBooking(service: SupabaseClient, bookingId: string) {
  const { data: b } = await service
    .from("bookings")
    .select("id, account_id, student_id, tutor_id, subject_name, other_subject_text, scheduled_start, duration_minutes, is_free_trial, tutor_display_name, student_first_name")
    .eq("id", bookingId)
    .maybeSingle();
  if (!b) return null;
  let studentTz = "UTC";
  if (b.student_id) {
    const { data: s } = await service.from("students").select("timezone").eq("id", b.student_id).maybeSingle();
    studentTz = s?.timezone || "UTC";
  }
  let tutorTz = "UTC";
  if (b.tutor_id) {
    const { data: tp } = await service.from("tutor_profiles").select("timezone").eq("profile_id", b.tutor_id).maybeSingle();
    tutorTz = tp?.timezone || "UTC";
  }
  return {
    ...b,
    subject: b.subject_name ?? (b.other_subject_text ? `Other — ${b.other_subject_text}` : "Tutoring"),
    studentTz,
    tutorTz,
    tutorFirst: firstName(b.tutor_display_name),
    studentFirst: b.student_first_name ?? null,
  };
}

// --- Business notifications -------------------------------------------------

export async function notifyBookingConfirmed(bookingId: string) {
  const service = getServiceSupabase();
  const b = await loadBooking(service, bookingId);
  if (!b) return;
  await deliver({
    key: `booking-confirmed:${bookingId}`,
    type: "booking_confirmed",
    accountId: b.account_id,
    bookingId,
    rendered: T.bookingConfirmed({
      isFreeTrial: b.is_free_trial,
      subject: b.subject,
      whenISO: b.scheduled_start,
      tz: b.studentTz,
      durationMinutes: b.duration_minutes,
      tutorName: b.tutorFirst,
      appUrl: APP_URL,
      bookingId,
    }),
  });
  // Tutor's copy (their timezone). The key includes the tutor id so a
  // reassignment to a DIFFERENT tutor sends a fresh assignment email, while
  // repeat attempts for the same tutor stay idempotent. (Reassigning back to a
  // tutor who was already notified for this booking is treated as the same
  // assignment event and is not re-sent — a deliberate, deterministic rule.)
  if (b.tutor_id && b.scheduled_start) {
    await deliver({
      key: `tutor-new-session:${bookingId}:${b.tutor_id}`,
      type: "tutor_new_session",
      accountId: b.tutor_id,
      bookingId,
      rendered: T.tutorNewSession({
        subject: b.subject,
        whenISO: b.scheduled_start,
        tz: b.tutorTz,
        durationMinutes: b.duration_minutes,
        studentName: b.studentFirst,
        appUrl: APP_URL,
        bookingId,
      }),
    });
  }
}

export async function notifyPackagePurchased(paymentId: string) {
  const service = getServiceSupabase();
  const { data: pay } = await service.from("payments").select("account_id, package_product_id, gross_cents").eq("id", paymentId).maybeSingle();
  if (!pay) return;
  const { data: prod } = await service.from("package_products").select("minutes").eq("id", pay.package_product_id).maybeSingle();
  const { data: bal } = await service.rpc("get_package_minutes", { p_account: pay.account_id });
  await deliver({
    key: `package-purchased:${paymentId}`,
    type: "package_purchased",
    accountId: pay.account_id,
    rendered: T.packagePurchased({ minutes: prod?.minutes ?? 0, amountCents: pay.gross_cents, balanceMinutes: typeof bal === "number" ? bal : null, appUrl: APP_URL }),
  });
}

export async function notifyCancellation(bookingId: string, info: { early: boolean; restoredMinutes?: number | null; restoredCreditCents?: number | null }) {
  const service = getServiceSupabase();
  const b = await loadBooking(service, bookingId);
  if (!b) return;
  await deliver({
    key: `cancellation:${bookingId}`,
    type: "cancellation",
    accountId: b.account_id,
    bookingId,
    rendered: T.cancellation({ early: info.early, restoredMinutes: info.restoredMinutes ?? null, restoredCreditCents: info.restoredCreditCents ?? null }),
  });
  if (b.tutor_id) {
    await deliver({
      key: `cancellation-tutor:${bookingId}`,
      type: "tutor_cancellation",
      accountId: b.tutor_id,
      bookingId,
      rendered: T.tutorCancelled({ early: info.early, subject: b.subject, whenISO: b.scheduled_start, tz: b.tutorTz }),
    });
  }
}

export async function notifyReassignment(bookingId: string, info: { reassigned: boolean; compCreditCents?: number | null; removedTutorId?: string | null }) {
  const service = getServiceSupabase();
  const b = await loadBooking(service, bookingId);
  if (!b) return;
  await deliver({
    key: `${info.reassigned ? "reassignment" : "release"}:${bookingId}`,
    type: info.reassigned ? "reassignment" : "release",
    accountId: b.account_id,
    bookingId,
    rendered: T.tutorReassignment({ reassigned: info.reassigned, compCreditCents: info.compCreditCents ?? null, subject: b.subject, bookingId, appUrl: APP_URL }),
  });
  if (info.reassigned && b.tutor_id && b.scheduled_start) {
    await notifyBookingConfirmed(bookingId); // new tutor gets the tutor-new-session copy (idempotent)
  }
  if (info.reassigned && info.removedTutorId) {
    let tz = "UTC";
    const { data: tp } = await service.from("tutor_profiles").select("timezone").eq("profile_id", info.removedTutorId).maybeSingle();
    tz = tp?.timezone || "UTC";
    await deliver({
      key: `tutor-removed:${bookingId}:${info.removedTutorId}`,
      type: "tutor_removed",
      accountId: info.removedTutorId,
      bookingId,
      rendered: T.tutorRemoved({ subject: b.subject, whenISO: b.scheduled_start, tz }),
    });
  }
}

export async function notifyRefund(paymentId: string, refundRef: string, amountCents: number, reason?: string | null) {
  const service = getServiceSupabase();
  const { data: pay } = await service.from("payments").select("account_id").eq("id", paymentId).maybeSingle();
  if (!pay) return;
  await deliver({
    key: `refund-issued:${refundRef}`,
    type: "refund_issued",
    accountId: pay.account_id,
    rendered: T.refundIssued({ amountCents, reason: reason ?? null }),
  });
}

export async function notifyDisputeReceived(disputeId: string, bookingId: string) {
  const service = getServiceSupabase();
  const b = await loadBooking(service, bookingId);
  await deliver({
    key: `dispute-received:${disputeId}`,
    type: "dispute_received",
    accountId: b?.account_id ?? null,
    bookingId,
    rendered: T.disputeReceived({ subject: b?.subject ?? null }),
  });
}

export async function notifyDisputeResolved(disputeId: string, accountId: string, info: { resolution: string; creditCents?: number | null; restoredMinutes?: number | null; refundCents?: number | null }) {
  await deliver({
    key: `dispute-resolved:${disputeId}`,
    type: "dispute_resolved",
    accountId,
    rendered: T.disputeResolved({ resolution: info.resolution, creditCents: info.creditCents ?? null, restoredMinutes: info.restoredMinutes ?? null, refundCents: info.refundCents ?? null }),
  });
}

export async function notifyTutorApproved(tutorId: string, name?: string | null) {
  await deliver({
    key: `tutor-approved:${tutorId}`,
    type: "tutor_approved",
    accountId: tutorId,
    rendered: T.tutorApproved({ name: firstName(name), appUrl: `${APP_URL}/dashboard/tutor` }),
  });
}

export async function notifyWelcome(accountId: string, name?: string | null) {
  await deliver({ key: `welcome:${accountId}`, type: "welcome", accountId, rendered: T.welcome({ name: firstName(name), appUrl: `${APP_URL}/dashboard` }) });
}

export async function notifyReminder(bookingId: string, role: "customer" | "tutor", kind: "24h" | "1h") {
  const service = getServiceSupabase();
  const b = await loadBooking(service, bookingId);
  if (!b || !b.scheduled_start) return { status: "skipped" };
  const accountId = role === "customer" ? b.account_id : b.tutor_id;
  if (!accountId) return { status: "skipped" };
  return deliver({
    key: `reminder-${kind}:${bookingId}:${role}`,
    type: `reminder_${kind}`,
    accountId,
    bookingId,
    rendered: T.reminder({
      role,
      kind,
      subject: b.subject,
      whenISO: b.scheduled_start,
      tz: role === "customer" ? b.studentTz : b.tutorTz,
      tutorName: b.tutorFirst,
      studentName: b.studentFirst,
      appUrl: APP_URL,
      bookingId,
    }),
  });
}

export async function notifyAdminAlert(dedupeKey: string, ctx: { title: string; summary: string; lines?: string[] }) {
  if (!ADMIN_ALERT_EMAIL) return { status: "skipped" };
  return deliver({
    key: `admin:${dedupeKey}`,
    type: "admin_alert",
    accountId: null,
    toEmailOverride: ADMIN_ALERT_EMAIL,
    rendered: T.adminAlert(ctx),
  });
}
