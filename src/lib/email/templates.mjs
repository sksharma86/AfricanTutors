/**
 * Pure email templates for Study Hall at Home transactional email. No provider, no
 * DB, no secrets — each builder returns { subject, html, text } from already-
 * resolved SAFE data (first-name display identity only; never email/phone).
 *
 * Session links always point at the authenticated Study Hall at Home route
 * (APP_URL/dashboard/session/<booking_id>), never a Daily room/token — the app
 * performs authorization and mints Daily access at click time.
 *
 * Plain ESM (+ .d.ts) so subjects/URLs/timezone rendering are unit-testable.
 */

const BRAND = "Study Hall at Home";

export function formatMoney(cents) {
  const d = (cents ?? 0) / 100;
  return Number.isInteger(d) ? `$${d}` : `$${d.toFixed(2)}`;
}

/** Render a UTC instant in the recipient's IANA timezone (falls back safely). */
export function formatWhen(iso, tz) {
  if (!iso) return "a time we'll confirm";
  const timeZone = tz || "UTC";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString();
  }
}

export function sessionUrl(appUrl, bookingId) {
  const base = (appUrl || "").replace(/\/+$/, "");
  return `${base}/dashboard/session/${bookingId}`;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function layout(heading, paragraphsHtml, cta) {
  const button = cta
    ? `<p style="margin:24px 0"><a href="${esc(cta.href)}" style="background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">${esc(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f6f6f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937">
<div style="max-width:560px;margin:0 auto;padding:24px">
  <div style="font-weight:700;letter-spacing:.02em;color:#111827;font-size:18px;margin-bottom:16px">${BRAND}</div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:24px">
    <h1 style="font-size:20px;margin:0 0 12px">${esc(heading)}</h1>
    ${paragraphsHtml}
    ${button}
  </div>
  <p style="color:#9ca3af;font-size:12px;margin-top:16px">You're receiving this because you have an ${BRAND} account. Sessions are conducted on-platform for your safety.</p>
</div></body></html>`;
}

const p = (t) => `<p style="margin:0 0 12px;line-height:1.5">${esc(t)}</p>`;
const textJoin = (lines) => lines.filter(Boolean).join("\n");

// ---------------------------------------------------------------------------

export function welcome(ctx) {
  return {
    subject: `Welcome to ${BRAND}`,
    html: layout(`Welcome to ${BRAND}`, p(`Hi ${ctx.name || "there"},`) + p("Your account is ready. You can book a session and claim your free 1-hour Study Hall session — no credit card required."), ctx.appUrl ? { href: ctx.appUrl, label: "Go to your dashboard" } : null),
    text: textJoin([`Welcome to ${BRAND}`, "", `Hi ${ctx.name || "there"},`, "Your account is ready. Book a session and claim your free 1-hour Study Hall session — no credit card required.", ctx.appUrl || ""]),
  };
}

export function bookingConfirmed(ctx) {
  const when = formatWhen(ctx.whenISO, ctx.tz);
  const url = sessionUrl(ctx.appUrl, ctx.bookingId);
  const free = ctx.isFreeTrial;
  const lines = [
    free ? "Your free 1-hour Study Hall session is confirmed. No payment method was required." : "Your Study Hall session is confirmed.",
    `Subject: ${ctx.subject || "Study Hall"}`,
    `When: ${when}`,
    `Duration: ${ctx.durationMinutes || 60} minutes`,
    ctx.tutorName ? `Guide: ${ctx.tutorName}` : null,
    "Join from your dashboard when it's time — the session opens 5 minutes before the start.",
  ];
  return {
    subject: free ? "Your free session is confirmed" : "Your Study Hall session is confirmed",
    html: layout(
      free ? "Free session confirmed" : "Session confirmed",
      lines.filter(Boolean).map(p).join(""),
      { href: url, label: "View session" },
    ),
    text: textJoin([...lines.filter(Boolean), "", `Join: ${url}`]),
  };
}

export function packagePurchased(ctx) {
  const hrs = (ctx.minutes ?? 0) / 60;
  const lines = [
    `Thank you — your ${Number.isInteger(hrs) ? hrs : hrs.toFixed(1)}-hour package is active.`,
    `Minutes added: ${ctx.minutes}`,
    `Amount paid: ${formatMoney(ctx.amountCents)}`,
    typeof ctx.balanceMinutes === "number" ? `New balance: ${ctx.balanceMinutes} minutes` : null,
    "These minutes never expire and apply automatically to your next booking.",
  ];
  return {
    subject: "Your prepaid hours are ready",
    html: layout("Package activated", lines.filter(Boolean).map(p).join(""), ctx.appUrl ? { href: ctx.appUrl, label: "Book a session" } : null),
    text: textJoin(lines.filter(Boolean)),
  };
}

export function reminder(ctx) {
  const when = formatWhen(ctx.whenISO, ctx.tz);
  const url = sessionUrl(ctx.appUrl, ctx.bookingId);
  const soon = ctx.kind === "1h" ? "starts in about an hour" : "is coming up";
  const who = ctx.role === "tutor" ? `Student: ${ctx.studentName || "your student"}` : `Guide: ${ctx.tutorName || "your Guide"}`;
  const lines = [
    `Reminder: your ${ctx.subject || "Study Hall"} session ${soon}.`,
    `When: ${when}`,
    who,
    "Join from your dashboard — the room opens 5 minutes before start.",
    ctx.role === "customer" ? "Need to cancel? Cancellations 24+ hours ahead return your value to your account." : null,
  ];
  return {
    subject: ctx.kind === "1h" ? "Your session starts soon" : "Reminder: upcoming Study Hall session",
    html: layout("Upcoming session", lines.filter(Boolean).map(p).join(""), { href: url, label: "Join session" }),
    text: textJoin([...lines.filter(Boolean), "", `Join: ${url}`]),
  };
}

export function cancellation(ctx) {
  const lines = ctx.early
    ? [
        "Your session has been cancelled with 24+ hours' notice, so the value has been returned to your account.",
        ctx.restoredMinutes ? `Package minutes returned: ${ctx.restoredMinutes}` : null,
        ctx.restoredCreditCents ? `Account credit returned: ${formatMoney(ctx.restoredCreditCents)}` : null,
        "You can rebook any time.",
      ]
    : [
        "Your session has been cancelled less than 24 hours before the start time. Per our policy, this session is non-refundable.",
        "If you believe this is a mistake, please contact support.",
      ];
  return {
    subject: ctx.early ? "Session cancelled — value returned" : "Session cancelled",
    html: layout("Session cancelled", lines.filter(Boolean).map(p).join("")),
    text: textJoin(lines.filter(Boolean)),
  };
}

export function tutorReassignment(ctx) {
  const url = sessionUrl(ctx.appUrl, ctx.bookingId);
  const lines = ctx.reassigned
    ? ["Your assigned Guide changed, and we've matched you with another approved Guide. Your session time is unchanged.", ctx.subject ? `Subject: ${ctx.subject}` : null]
    : [
        "Your Guide became unavailable and we couldn't arrange a replacement in time, so the session was released and all value returned to your account.",
        ctx.compCreditCents ? `We've added ${formatMoney(ctx.compCreditCents)} account credit for the inconvenience.` : null,
        "Please rebook a time that works for you.",
      ];
  return {
    subject: ctx.reassigned ? "Update: your Guide changed" : "Update about your session",
    html: layout("Session update", lines.filter(Boolean).map(p).join(""), ctx.reassigned ? { href: url, label: "View session" } : ctx.appUrl ? { href: ctx.appUrl, label: "Rebook a session" } : null),
    text: textJoin(lines.filter(Boolean)),
  };
}

export function refundIssued(ctx) {
  // A Stripe cash refund — explicitly NOT account credit.
  const lines = [
    `A refund of ${formatMoney(ctx.amountCents)} has been issued to your original payment method (this is a card/Stripe refund, not account credit).`,
    ctx.reason ? `Reason: ${ctx.reason}` : null,
    "It may take a few business days to appear on your statement.",
  ];
  return {
    subject: "A refund has been issued",
    html: layout("Refund issued", lines.filter(Boolean).map(p).join("")),
    text: textJoin(lines.filter(Boolean)),
  };
}

export function disputeReceived(ctx) {
  const lines = ["Thank you for letting us know about your recent session. Our team will review it and follow up with a resolution.", ctx.subject ? `Session: ${ctx.subject}` : null];
  return { subject: "We received your session concern", html: layout("Concern received", lines.filter(Boolean).map(p).join("")), text: textJoin(lines.filter(Boolean)) };
}

/** Parent notification when a Guide submits the short post-session report. */
export function sessionReportReady(ctx) {
  const when = formatWhen(ctx.whenISO, ctx.tz);
  const dash = (ctx.appUrl || "").replace(/\/+$/, "") + "/dashboard/student#reports";
  const lines = [
    ctx.studentName ? `${ctx.studentName}'s Study Hall report is ready.` : "Your Study Hall report is ready.",
    `When: ${when}`,
    "It's a short note from the Guide about focus, what they worked on, and how the session went — not a grade or academic assessment.",
  ];
  return {
    subject: "Your Study Hall report is ready",
    html: layout("Study Hall report ready", lines.map(p).join(""), { href: dash, label: "View session reports" }),
    text: textJoin([...lines, "", `View: ${dash}`]),
  };
}

export function disputeResolved(ctx) {
  const lines = [
    `We've completed our review. Outcome: ${ctx.resolution}.`,
    ctx.restoredMinutes ? `Package minutes added: ${ctx.restoredMinutes}` : null,
    ctx.creditCents ? `Account credit added: ${formatMoney(ctx.creditCents)} (usable on future sessions).` : null,
    ctx.refundCents ? `Refund to your original payment method: ${formatMoney(ctx.refundCents)} (card/Stripe refund, not account credit).` : null,
    "Thank you for helping us keep Study Hall at Home high quality.",
  ];
  return { subject: "Update on your session concern", html: layout("Concern resolved", lines.filter(Boolean).map(p).join("")), text: textJoin(lines.filter(Boolean)) };
}

export function tutorApproved(ctx) {
  const lines = [`Hi ${ctx.name || "there"},`, "Congratulations — your Study Hall at Home Guide application has been approved. You can set your availability and you'll be matched to sessions."];
  return { subject: "You're approved to Guide with Study Hall at Home", html: layout("You're approved!", lines.map(p).join(""), ctx.appUrl ? { href: ctx.appUrl, label: "Set your availability" } : null), text: textJoin(lines) };
}

export function tutorNewSession(ctx) {
  const when = formatWhen(ctx.whenISO, ctx.tz);
  const url = sessionUrl(ctx.appUrl, ctx.bookingId);
  const lines = [
    "You've been assigned a new Study Hall session.",
    `Subject: ${ctx.subject || "Study Hall"}`,
    `When: ${when}`,
    `Duration: ${ctx.durationMinutes || 30} minutes`,
    ctx.studentName ? `Student: ${ctx.studentName}` : null,
    "Join from your dashboard — the room opens 5 minutes before start.",
  ];
  return { subject: "New session assigned", html: layout("New session assigned", lines.filter(Boolean).map(p).join(""), { href: url, label: "View session" }), text: textJoin([...lines.filter(Boolean), "", `Join: ${url}`]) };
}

export function tutorCancelled(ctx) {
  const when = formatWhen(ctx.whenISO, ctx.tz);
  const lines = [
    `A session was cancelled by the customer (${ctx.early ? "24+ hours ahead" : "less than 24 hours before start"}).`,
    ctx.subject ? `Subject: ${ctx.subject}` : null,
    `When: ${when}`,
    "No action is needed; your upcoming schedule has been updated.",
  ];
  return { subject: "A session was cancelled", html: layout("Session cancelled", lines.filter(Boolean).map(p).join("")), text: textJoin(lines.filter(Boolean)) };
}

export function tutorRemoved(ctx) {
  const when = formatWhen(ctx.whenISO, ctx.tz);
  const lines = ["You've been removed from an upcoming session and it has been reassigned.", ctx.subject ? `Subject: ${ctx.subject}` : null, `When: ${when}`, "No action is needed."];
  return { subject: "You've been removed from a session", html: layout("Session reassigned", lines.filter(Boolean).map(p).join("")), text: textJoin(lines.filter(Boolean)) };
}

export function adminAlert(ctx) {
  const lines = [ctx.summary || "An operational event needs attention.", ...(ctx.lines || [])];
  return { subject: `[Ops] ${ctx.title || "Study Hall at Home alert"}`, html: layout(ctx.title || "Operational alert", lines.filter(Boolean).map(p).join("")), text: textJoin(lines.filter(Boolean)) };
}
