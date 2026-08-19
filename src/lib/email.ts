import "server-only";

/**
 * Customer email communication for Phase 4B.
 *
 * There is no production email provider wired up in this project yet, so this
 * module is a SAFE STUB: it formats the message and logs it server-side. If a
 * `RESEND_API_KEY` (or compatible provider key) is later added to the
 * environment, `deliver()` can be extended to call that provider — every call
 * site here already produces a subject + body, so no call sites need to change.
 *
 * Deferred (documented): actual provider integration, templated HTML, delivery
 * retries, and unsubscribe handling. Emails are best-effort and NEVER block or
 * fail a financial fulfillment path — callers ignore the boolean result.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "African Tutors <no-reply@africantutors.example>";

/** Whether a real provider is configured. Currently always false in this env. */
export const isEmailConfigured = Boolean(RESEND_API_KEY);

async function deliver(message: EmailMessage): Promise<boolean> {
  if (!message.to) return false;

  if (!isEmailConfigured) {
    // Stub mode: record what WOULD be sent so it is observable in server logs.
    console.info(
      `[email:stub] to=${message.to} subject=${JSON.stringify(message.subject)}\n${message.body}`,
    );
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: message.to,
        subject: message.subject,
        text: message.body,
      }),
    });
    return res.ok;
  } catch {
    // Never let an email failure break a payment/booking path.
    return false;
  }
}

export function sendBookingConfirmed(params: {
  to: string;
  studentName?: string | null;
  subject?: string | null;
  when?: string | null;
  reference?: string | null;
}): Promise<boolean> {
  const lines = [
    `Hi${params.studentName ? ` — this is about ${params.studentName}` : ""},`,
    "",
    "Your African Tutors session is confirmed. An approved tutor is matched and ready.",
    params.subject ? `Subject: ${params.subject}` : null,
    params.when ? `When: ${params.when}` : null,
    params.reference ? `Reference: ${params.reference}` : null,
    "",
    "We'll see you online. Thank you for choosing African Tutors.",
  ].filter(Boolean);
  return deliver({ to: params.to, subject: "Your tutoring session is confirmed", body: lines.join("\n") });
}

export function sendBookingExpired(params: {
  to: string;
  studentName?: string | null;
  reference?: string | null;
  creditedCents?: number | null;
}): Promise<boolean> {
  const lines = [
    "Hi,",
    "",
    "The payment window for your requested African Tutors session expired, so the time slot has been released.",
    params.reference ? `Reference: ${params.reference}` : null,
    params.creditedCents && params.creditedCents > 0
      ? `Any amount already received has been added to your account balance ($${(params.creditedCents / 100).toFixed(2)}).`
      : "No payment was taken.",
    "",
    "You're welcome to book again any time — your free trial and balances are unaffected.",
  ].filter(Boolean);
  return deliver({ to: params.to, subject: "Your booking hold expired", body: lines.join("\n") });
}

export function sendCancellation(params: {
  to: string;
  early: boolean;
  restoredMinutes?: number | null;
  restoredCreditCents?: number | null;
  reference?: string | null;
}): Promise<boolean> {
  const lines = params.early
    ? [
        "Hi,",
        "",
        "Your African Tutors session has been cancelled with 24+ hours' notice, so the value has been returned to your account.",
        params.restoredMinutes ? `Package minutes restored: ${params.restoredMinutes}` : null,
        params.restoredCreditCents ? `Account credit restored: $${(params.restoredCreditCents / 100).toFixed(2)}` : null,
        params.reference ? `Reference: ${params.reference}` : null,
        "",
        "You can rebook any time — your balance is ready to use.",
      ]
    : [
        "Hi,",
        "",
        "Your African Tutors session has been cancelled less than 24 hours before the start time. Per our policy, this session is forfeited and no credit is returned.",
        params.reference ? `Reference: ${params.reference}` : null,
        "",
        "If you believe this is a mistake, please contact support.",
      ];
  return deliver({
    to: params.to,
    subject: params.early ? "Your session was cancelled — value returned" : "Your session was cancelled",
    body: lines.filter(Boolean).join("\n"),
  });
}

export function sendTutorReassignment(params: { to: string; reassigned: boolean; reference?: string | null; compCreditCents?: number | null }): Promise<boolean> {
  const lines = params.reassigned
    ? [
        "Hi,",
        "",
        "Your assigned tutor became unavailable, so we've matched you with another approved African Tutors tutor. Your session time is unchanged.",
        params.reference ? `Reference: ${params.reference}` : null,
      ]
    : [
        "Hi,",
        "",
        "Your assigned tutor became unavailable and we couldn't arrange a replacement in time, so we've released the session and returned all value to your account.",
        params.compCreditCents && params.compCreditCents > 0
          ? `We've also added $${(params.compCreditCents / 100).toFixed(2)} account credit for the inconvenience.`
          : null,
        params.reference ? `Reference: ${params.reference}` : null,
      ];
  return deliver({ to: params.to, subject: "Update about your tutoring session", body: lines.filter(Boolean).join("\n") });
}

export function sendDisputeReceived(params: { to: string; reference?: string | null }): Promise<boolean> {
  return deliver({
    to: params.to,
    subject: "We received your session concern",
    body: ["Hi,", "", "Thank you for letting us know about your recent session. Our team will review it and follow up with a resolution.", params.reference ? `Reference: ${params.reference}` : null, ""].filter(Boolean).join("\n"),
  });
}

export function sendDisputeResolved(params: { to: string; resolution: string; creditCents?: number | null; restoredMinutes?: number | null; refundCents?: number | null }): Promise<boolean> {
  const lines = [
    "Hi,",
    "",
    `We've completed our review of your session concern. Outcome: ${params.resolution}.`,
    params.restoredMinutes ? `Package minutes added: ${params.restoredMinutes}` : null,
    params.creditCents ? `Account credit added: $${(params.creditCents / 100).toFixed(2)}` : null,
    params.refundCents ? `Refund issued to your original payment method: $${(params.refundCents / 100).toFixed(2)}` : null,
    "",
    "Thank you for helping us keep African Tutors high quality.",
  ];
  return deliver({ to: params.to, subject: "Update on your session concern", body: lines.filter(Boolean).join("\n") });
}

export function sendRefundIssued(params: { to: string; amountCents: number; reason?: string | null }): Promise<boolean> {
  return deliver({
    to: params.to,
    subject: "A refund has been issued",
    body: ["Hi,", "", `A refund of $${(params.amountCents / 100).toFixed(2)} has been issued to your original payment method.`, params.reason ? `Reason: ${params.reason}` : null, "", "It may take a few business days to appear."].filter(Boolean).join("\n"),
  });
}

export function sendPackagePurchased(params: {
  to: string;
  minutes: number;
  amountCents: number;
}): Promise<boolean> {
  const hours = params.minutes / 60;
  const body = [
    "Hi,",
    "",
    `Thank you — your ${Number.isInteger(hours) ? hours : hours.toFixed(1)}-hour tutoring package is now active.`,
    `Minutes added: ${params.minutes}`,
    `Amount paid: $${(params.amountCents / 100).toFixed(2)}`,
    "",
    "These minutes never expire and are ready to use on your next booking.",
  ].join("\n");
  return deliver({ to: params.to, subject: "Your tutoring package is ready", body });
}
