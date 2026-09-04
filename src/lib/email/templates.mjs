import { formatChildNames, possessiveStudyHall } from "../household-children.mjs";
import { t30DeadlineIso } from "../guide-attendance.mjs";
import { formatTime, tzAbbreviation } from "../timezone-format.mjs";

/**
 * Pure email templates for Study Hall (at home) transactional email. No provider, no
 * DB, no secrets — each builder returns { subject, html, text } from already-
 * resolved SAFE data (first-name display identity only; never email/phone).
 *
 * Session links always point at the authenticated Study Hall (at home) route
 * (APP_URL/dashboard/session/<booking_id>), never a Daily room/token — the app
 * performs authorization and mints Daily access at click time.
 *
 * Plain ESM (+ .d.ts) so subjects/URLs/timezone rendering are unit-testable.
 */

const BRAND = "Study Hall (at home)";

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

/** Operational clock for Guide alerts: "6:00 PM CDT". */
export function formatOpsClock(iso, tz) {
  if (!iso) return "a time we'll confirm";
  const zone = tz || "UTC";
  try {
    const time = formatTime(iso, zone);
    const abbr = tzAbbreviation(iso, zone);
    return abbr ? `${time} ${abbr}` : time;
  } catch {
    return formatWhen(iso, tz);
  }
}

function hoursLabel(minutes) {
  if (minutes === 60) return "1 hour";
  if (minutes === 120) return "2 hours";
  if (minutes === 180) return "3 hours";
  return `${minutes || 60} minutes`;
}

/** Absolute http(s) app href, or empty. Never emit a Gmail-broken relative path. */
export function absoluteAppHref(appUrl, path) {
  const base = String(appUrl || "").trim().replace(/\/+$/, "");
  const suffix = String(path || "").startsWith("/") ? path : `/${path || ""}`;
  if (!/^https?:\/\//i.test(base) || suffix === "/") return "";
  return `${base}${suffix}`;
}

function opsCta(href, label) {
  if (!href || !/^https?:\/\//i.test(href)) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 8px">
  <tr><td align="center" bgcolor="#111827" style="background-color:#111827;border-radius:12px">
    <a href="${esc(href)}" target="_blank" style="display:inline-block;width:100%;box-sizing:border-box;background-color:#111827;color:#ffffff;text-decoration:none;padding:16px 18px;border-radius:12px;font-weight:700;font-size:16px;line-height:1.25;text-align:center;min-height:48px">${esc(label)}</a>
  </td></tr>
</table>
<p style="margin:8px 0 0;font-size:13px;line-height:1.45;text-align:center">
  <a href="${esc(href)}" target="_blank" style="color:#111827;text-decoration:underline;word-break:break-all">${esc(href)}</a>
</p>`;
}

function opsFact(label, value) {
  return `<p style="margin:0 0 14px;line-height:1.45"><span style="display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;font-weight:700">${esc(label)}</span><span style="display:block;margin-top:4px;font-size:22px;line-height:1.25;font-weight:700;color:#111827">${esc(value)}</span></p>`;
}

/** Professional operations-alert chrome. Large tap target. Not a marketing blast. */
function opsLayout({ eyebrow, heading, preheader, factsHtml, cta, note, footer }) {
  const preview = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}</div>`
    : "";
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head>
<body style="margin:0;background:#f6f6f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937">
${preview}
<div style="max-width:560px;margin:0 auto;padding:20px 16px">
  <div style="font-weight:700;letter-spacing:.02em;color:#111827;font-size:16px;margin-bottom:14px">${BRAND}</div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:22px 20px">
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:#111827">${esc(eyebrow)}</p>
    <h1 style="font-size:24px;line-height:1.25;margin:0 0 18px;color:#111827">${esc(heading)}</h1>
    ${factsHtml}
    ${cta || ""}
    ${note ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.5;color:#374151">${esc(note)}</p>` : ""}
  </div>
  <p style="color:#9ca3af;font-size:12px;margin-top:16px">${esc(footer || `You're receiving this because you Guide with ${BRAND}. Confirm from your authenticated Guide portal.`)}</p>
</div></body></html>`;
}

function layout(heading, paragraphsHtml, cta) {
  const button = cta
    ? `<p style="margin:24px 0"><a href="${esc(cta.href)}" style="background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">${esc(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f6f6f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937">
<div style="max-width:560px;margin:0 auto;padding:24px">
  <div style="margin:0 0 16px 0;line-height:1.25">
    <span style="font-weight:700;letter-spacing:-0.02em;color:#0c0c0b;font-size:18px">Study Hall</span>
    <span style="font-weight:500;color:#6a665d;font-size:15px"> (at home)</span>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:24px">
    <h1 style="font-size:20px;margin:0 0 12px">${esc(heading)}</h1>
    ${paragraphsHtml}
    ${button}
  </div>
  <p style="color:#9ca3af;font-size:12px;margin-top:16px">You're receiving this because you have a ${BRAND} account. Sessions are conducted on-platform for your safety.</p>
</div></body></html>`;
}

const p = (t) => `<p style="margin:0 0 12px;line-height:1.5">${esc(t)}</p>`;
const textJoin = (lines) => lines.filter(Boolean).join("\n");

function childPhrase(ctx) {
  if (Array.isArray(ctx.studentNames) && ctx.studentNames.length) {
    return formatChildNames(ctx.studentNames, ctx.studentName || "your child");
  }
  return ctx.studentName || "your child";
}

function studyHallPhrase(ctx) {
  if (Array.isArray(ctx.studentNames) && ctx.studentNames.length) {
    return possessiveStudyHall(ctx.studentNames);
  }
  if (ctx.studentName) return `${ctx.studentName}'s Study Hall`;
  return "Study Hall";
}

function childrenLine(ctx) {
  const names = childPhrase(ctx);
  if (!ctx.studentName && !(ctx.studentNames && ctx.studentNames.length)) return null;
  const count = Array.isArray(ctx.studentNames) ? ctx.studentNames.length : 1;
  return count > 1 ? `Children: ${names}` : `Child: ${names}`;
}

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
  const hall = studyHallPhrase(ctx);
  const hours =
    ctx.durationMinutes === 60 ? "1 hour" : ctx.durationMinutes === 120 ? "2 hours" : ctx.durationMinutes === 180 ? "3 hours" : `${ctx.durationMinutes || 60} minutes`;
  const fundingLine = free
    ? "Payment: free introductory session — no charge."
    : ctx.funding === "package"
      ? "Payment: covered by your prepaid Study Hall hours."
      : ctx.funding === "credit"
        ? "Payment: covered by your account credit."
        : null;
  const lines = [
    free
      ? `${hall} (free 1-hour) is confirmed. No payment method was required.`
      : `${hall} is confirmed.`,
    `When: ${when}`,
    `Duration: ${hours}`,
    ctx.tutorName ? `Guide: ${ctx.tutorName}` : "An approved Guide is matched.",
    fundingLine,
    "The room opens 5 minutes before the start — join from your dashboard when it's time.",
  ];
  return {
    subject: free ? "Your free Study Hall is confirmed" : "Your Study Hall is confirmed",
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
  const hrsLabel = Number.isInteger(hrs) ? `${hrs}` : hrs.toFixed(1);
  const packageName =
    ctx.packageName ||
    (ctx.minutes === 840 ? "14 Hour Routine" : ctx.minutes === 1680 ? "28 Hour Routine" : `${hrsLabel}-hour Study Hall package`);
  const balHrs = typeof ctx.balanceMinutes === "number" ? ctx.balanceMinutes / 60 : null;
  const balLabel =
    balHrs == null ? null : Number.isInteger(balHrs) ? `${balHrs} hours` : `${balHrs.toFixed(1)} hours`;
  const lines = [
    `Thank you — your ${packageName} is active.`,
    `Package: ${packageName}`,
    `Hours added: ${hrsLabel}`,
    `Amount paid: ${formatMoney(ctx.amountCents)}`,
    balLabel ? `New Study Hall balance: ${balLabel}` : null,
    "These hours never expire and apply automatically when you book.",
  ];
  return {
    subject: "Your prepaid Study Hall hours are ready",
    html: layout("Package activated", lines.filter(Boolean).map(p).join(""), ctx.appUrl ? { href: ctx.appUrl, label: "Book a session" } : null),
    text: textJoin(lines.filter(Boolean)),
  };
}

export function reminder(ctx) {
  const when = formatWhen(ctx.whenISO, ctx.tz);
  const url = sessionUrl(ctx.appUrl, ctx.bookingId);
  const hall = studyHallPhrase(ctx);
  const hours =
    ctx.durationMinutes === 60 ? "1 hour" : ctx.durationMinutes === 120 ? "2 hours" : ctx.durationMinutes === 180 ? "3 hours" : `${ctx.durationMinutes || 60} minutes`;

  // 24h kind is retained for template compatibility but PR8 policy never sends it.
  if (ctx.kind === "24h") {
    return {
      subject: "Study Hall tomorrow",
      html: layout("Upcoming Study Hall", p("This day-before reminder is disabled in Study Hall policy.")),
      text: "This day-before reminder is disabled in Study Hall policy.",
    };
  }

  if (ctx.role === "tutor") {
    const lines = [
      "Reminder: you have a Study Hall session in about an hour.",
      childrenLine(ctx),
      `When: ${when}`,
      `Duration: ${hours}`,
      "Join opens 5 minutes before the start — join from your Guide dashboard.",
    ];
    return {
      subject: "Study Hall starts in about an hour",
      html: layout("Upcoming Study Hall", lines.filter(Boolean).map(p).join(""), { href: url, label: "Open session" }),
      text: textJoin([...lines, "", `Join: ${url}`]),
    };
  }

  const lines = [
    `${BRAND} reminder: ${hall} starts at ${when}.`,
    "Please have them ready at their workspace.",
    `Duration: ${hours}`,
    "The room opens 5 minutes before — join from your dashboard when it's time.",
  ];
  return {
    subject: "Study Hall starts in about an hour",
    html: layout("Upcoming Study Hall", lines.map(p).join(""), { href: url, label: "View session" }),
    text: textJoin([...lines, "", `Dashboard: ${url}`]),
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
  const base = (ctx.appUrl || "").replace(/\/+$/, "");
  const dash = ctx.bookingId
    ? `${base}/dashboard/student/study-halls/${ctx.bookingId}`
    : `${base}/dashboard/student#reports`;
  const lines = [
    ctx.studentName || (ctx.studentNames && ctx.studentNames.length)
      ? `${studyHallPhrase(ctx)} report is ready.`
      : "Your Study Hall report is ready.",
    `When: ${when}`,
    "It's a short note from the Guide about focus, what they worked on, and how the session went — not a grade or academic assessment.",
    "Open your Parent account to read the report.",
  ];
  return {
    subject: "Your Study Hall report is ready",
    html: layout("Study Hall report ready", lines.map(p).join(""), { href: dash, label: "Read report" }),
    text: textJoin([...lines, "", `Read report: ${dash}`]),
  };
}

export function disputeResolved(ctx) {
  const lines = [
    `We've completed our review. Outcome: ${ctx.resolution}.`,
    ctx.restoredMinutes ? `Package minutes added: ${ctx.restoredMinutes}` : null,
    ctx.creditCents ? `Account credit added: ${formatMoney(ctx.creditCents)} (usable on future sessions).` : null,
    ctx.refundCents ? `Refund to your original payment method: ${formatMoney(ctx.refundCents)} (card/Stripe refund, not account credit).` : null,
    `Thank you for helping us keep ${BRAND} high quality.`,
  ];
  return { subject: "Update on your session concern", html: layout("Concern resolved", lines.filter(Boolean).map(p).join("")), text: textJoin(lines.filter(Boolean)) };
}

export function tutorApproved(ctx) {
  const lines = [`Hi ${ctx.name || "there"},`, `Congratulations — your ${BRAND} Guide application has been approved. You can set your availability and you'll be matched to sessions.`];
  return { subject: `You're approved to Guide with ${BRAND}`, html: layout("You're approved!", lines.map(p).join(""), ctx.appUrl ? { href: ctx.appUrl, label: "Set your availability" } : null), text: textJoin(lines) };
}

export function tutorNewSession(ctx) {
  const when = formatWhen(ctx.whenISO, ctx.tz);
  const url = sessionUrl(ctx.appUrl, ctx.bookingId);
  const hours =
    ctx.durationMinutes === 60 ? "1 hour" : ctx.durationMinutes === 120 ? "2 hours" : ctx.durationMinutes === 180 ? "3 hours" : `${ctx.durationMinutes || 60} minutes`;
  const lines = [
    "You've been assigned a new Study Hall session.",
    `When: ${when}`,
    `Duration: ${hours}`,
    childrenLine(ctx),
    "Join from your Guide dashboard — the room opens 5 minutes before start.",
  ];
  return { subject: "New Study Hall assigned", html: layout("New Study Hall assigned", lines.filter(Boolean).map(p).join(""), { href: url, label: "View session" }), text: textJoin([...lines.filter(Boolean), "", `Join: ${url}`]) };
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

/** Guide T-30 / replacement confirmation. V1 primary channel is email. Does not confirm for them. */
export function guideAttendanceRequest(ctx) {
  const count = Number(ctx.count) > 0 ? Number(ctx.count) : 1;
  const start = formatOpsClock(ctx.whenISO, ctx.tz);
  const deadline = formatOpsClock(ctx.deadlineISO || t30DeadlineIso(ctx.whenISO), ctx.tz);
  const end = ctx.endISO ? formatOpsClock(ctx.endISO, ctx.tz) : null;
  const hours = hoursLabel(ctx.durationMinutes);
  const dash = absoluteAppHref(ctx.appUrl, "/dashboard/tutor");
  const replacement = Boolean(ctx.replacement);
  const child = childrenLine(ctx);
  const subject = replacement
    ? count > 1
      ? `⚠️ ACTION REQUIRED NOW: Confirm ${count} new Study Halls`
      : "⚠️ ACTION REQUIRED NOW: Confirm your new Study Hall assignment"
    : count > 1
      ? `⚠️ ACTION REQUIRED NOW: Confirm ${count} upcoming Study Halls`
      : "⚠️ ACTION REQUIRED NOW: Confirm your upcoming Study Hall";
  const heading = count > 1 ? "Confirm your upcoming Study Halls" : "Confirm your upcoming Study Hall";
  const startValue = count > 1 && end ? `${start} – ${end}` : start;
  const ctaLabel = count > 1 ? `CONFIRM ALL ${count}` : "CONFIRM I WILL BE THERE";
  const note =
    "If you do not confirm by the deadline, the Study Hall may be released for emergency coverage.";
  const factsHtml =
    opsFact(count > 1 ? "Your Study Halls begin at" : "Your Study Hall begins at", `${startValue}`) +
    (count === 1 ? opsFact("Duration", hours) : "") +
    opsFact("Confirmation deadline", deadline) +
    (child ? `<p style="margin:0 0 8px;font-size:14px;color:#374151">${esc(child)}</p>` : "");
  const textLines = [
    "ACTION REQUIRED",
    "",
    count > 1 ? `Your Study Halls begin at: ${startValue}` : `Your Study Hall begins at: ${start}`,
    count === 1 ? `Duration: ${hours}` : null,
    `Confirmation deadline: ${deadline}`,
    child,
    "",
    ctaLabel,
    dash,
    "",
    note,
  ];
  return {
    subject,
    html: opsLayout({
      eyebrow: "Action required",
      heading,
      preheader: `Confirm by ${deadline}.`,
      factsHtml,
      cta: opsCta(dash, ctaLabel),
      note,
    }),
    text: textJoin(textLines),
  };
}

/**
 * Private emergency coverage offer. Operational facts only — no parent contact,
 * payment, address, other Guide names, or child identity.
 */
export function guideOpenCoverageOffer(ctx) {
  const start = formatOpsClock(ctx.whenISO, ctx.tz);
  const end = ctx.endISO ? formatOpsClock(ctx.endISO, ctx.tz) : null;
  const hours = hoursLabel(ctx.durationMinutes);
  const accept = /^https?:\/\//i.test(String(ctx.acceptUrl || ""))
    ? String(ctx.acceptUrl)
    : absoluteAppHref(ctx.appUrl, ctx.bookingId ? `/dashboard/tutor/open-coverage/${ctx.bookingId}` : "");
  const window = end ? `${start} – ${end}` : start;
  let timeOnly = start;
  try {
    timeOnly = formatTime(ctx.whenISO, ctx.tz || "UTC");
  } catch {
    timeOnly = start;
  }
  const subject = `🚨 URGENT: Study Hall needs coverage at ${timeOnly}`;
  const note =
    "Clicking Accept immediately assigns this Study Hall to you AND confirms your attendance. No second confirmation is required. If another Guide accepts first, the portal will say this Study Hall has already been covered.";
  const factsHtml =
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.45;color:#111827;font-weight:600">A Study Hall needs immediate Guide coverage.</p>` +
    opsFact("Today", window) +
    opsFact("Duration", hours) +
    `<p style="margin:0 0 4px;font-size:15px;line-height:1.5;color:#111827;font-weight:600">First eligible Guide to accept gets this Study Hall.</p>`;
  return {
    subject,
    html: opsLayout({
      eyebrow: "Urgent coverage needed",
      heading: "Urgent coverage needed",
      preheader: "First available Guide to accept gets this Study Hall.",
      factsHtml,
      cta: opsCta(accept, "ACCEPT THIS STUDY HALL"),
      note,
      footer: `You're receiving this because you are an approved ${BRAND} Guide. Accept from your authenticated Guide portal.`,
    }),
    text: textJoin([
      "URGENT COVERAGE NEEDED",
      "",
      "A Study Hall needs immediate Guide coverage.",
      "",
      "TODAY",
      window,
      hours,
      "",
      "First eligible Guide to accept gets this Study Hall.",
      "",
      "ACCEPT THIS STUDY HALL",
      accept,
      "",
      note,
    ]),
  };
}

/** T-2 automatic protection. Do not name the Guide. Do not blame the Guide. */
export function coverageFailureProtection(ctx) {
  const lines = [
    "We're sorry. We weren't able to confirm Guide coverage for your upcoming Study Hall, so we've cancelled it rather than leave you waiting.",
    ctx.restorationLine || "Your booking has been fully restored.",
    "We've added a complimentary Study Hall hour to your account for the inconvenience.",
    "You can book another time whenever you're ready.",
  ];
  return {
    subject: "We couldn't provide your Guide tonight",
    html: layout("We couldn't provide your Guide tonight", lines.filter(Boolean).map(p).join(""), ctx.appUrl ? { href: `${String(ctx.appUrl).replace(/\/+$/, "")}/dashboard/student`, label: "Open your account" } : null),
    text: textJoin(lines.filter(Boolean)),
  };
}

/** Parent: Study Hall could not provide Guide coverage. Do not name the Guide. */
export function coverageCancellation(ctx) {
  const lines = [
    "We're sorry, but we're unable to provide a Guide for your scheduled Study Hall today.",
    ctx.restorationLine || "Your session value has been restored automatically.",
    ctx.compCreditCents ? `We've also added ${formatMoney(ctx.compCreditCents)} to your account for the inconvenience.` : null,
    "We apologize for the disruption.",
  ];
  return {
    subject: "Update about your Study Hall today",
    html: layout("We're sorry — we couldn't provide a Guide", lines.filter(Boolean).map(p).join(""), ctx.appUrl ? { href: ctx.appUrl, label: "Open your account" } : null),
    text: textJoin(lines.filter(Boolean)),
  };
}

export function adminAlert(ctx) {
  const lines = [ctx.summary || "An operational event needs attention.", ...(ctx.lines || [])];
  return { subject: `[Ops] ${ctx.title || `${BRAND} alert`}`, html: layout(ctx.title || "Operational alert", lines.filter(Boolean).map(p).join("")), text: textJoin(lines.filter(Boolean)) };
}

/** Guide: please submit the post-session report. */
export function guideReportRequired(ctx) {
  const when = formatWhen(ctx.whenISO, ctx.tz);
  const dash = (ctx.appUrl || "").replace(/\/+$/, "") + "/dashboard/tutor";
  const lines = [
    "Please submit the short post-session Study Hall report.",
    childrenLine(ctx),
    `When: ${when}`,
    "Parents rely on this note — it only takes a minute.",
  ];
  return {
    subject: "Study Hall report required",
    html: layout("Report required", lines.filter(Boolean).map(p).join(""), { href: dash, label: "Open Guide dashboard" }),
    text: textJoin([...lines.filter(Boolean), "", dash]),
  };
}

/** Guide: report is overdue. */
export function guideReportOverdue(ctx) {
  const when = formatWhen(ctx.whenISO, ctx.tz);
  const dash = (ctx.appUrl || "").replace(/\/+$/, "") + "/dashboard/tutor";
  const lines = [
    "Your post-session Study Hall report is overdue.",
    childrenLine(ctx),
    `When: ${when}`,
    "Please submit it from your Guide dashboard as soon as you can.",
  ];
  return {
    subject: "Overdue: Study Hall report",
    html: layout("Report overdue", lines.filter(Boolean).map(p).join(""), { href: dash, label: "Submit report" }),
    text: textJoin([...lines.filter(Boolean), "", dash]),
  };
}

/** Parent: prepaid minutes ran out after a booking. */
export function packageBalanceDepleted(ctx) {
  const lines = [
    "Your prepaid Study Hall hours are used up.",
    "Buy more hours anytime — they never expire and apply automatically when you book.",
  ];
  return {
    subject: "Your prepaid Study Hall hours are used up",
    html: layout("Prepaid hours used up", lines.map(p).join(""), ctx.appUrl ? { href: `${String(ctx.appUrl).replace(/\/+$/, "")}/dashboard/student/packages`, label: "Buy more hours" } : null),
    text: textJoin([...lines, "", ctx.appUrl ? `${String(ctx.appUrl).replace(/\/+$/, "")}/dashboard/student/packages` : ""]),
  };
}

/** Parent: prepaid minutes low (less than one standard hour left). */
export function packageBalanceLow(ctx) {
  const mins = typeof ctx.balanceMinutes === "number" ? ctx.balanceMinutes : 0;
  const label = mins <= 0 ? "0 minutes" : mins === 60 ? "1 hour" : `${mins} minutes`;
  const lines = [
    `Your prepaid Study Hall balance is running low (${label} left).`,
    "Buy more hours anytime so your next booking stays covered.",
  ];
  return {
    subject: "Your prepaid Study Hall balance is low",
    html: layout("Prepaid balance low", lines.map(p).join(""), ctx.appUrl ? { href: `${String(ctx.appUrl).replace(/\/+$/, "")}/dashboard/student/packages`, label: "Buy more hours" } : null),
    text: textJoin([...lines, "", ctx.appUrl ? `${String(ctx.appUrl).replace(/\/+$/, "")}/dashboard/student/packages` : ""]),
  };
}

/** Parent: admin (or system) applied account credit. */
export function accountCreditApplied(ctx) {
  const lines = [
    `We've added ${formatMoney(ctx.amountCents)} account credit to your ${BRAND} account.`,
    ctx.reason ? `Note: ${ctx.reason}` : null,
    "Credit applies automatically toward future Study Hall bookings.",
  ];
  return {
    subject: "Account credit added",
    html: layout("Account credit added", lines.filter(Boolean).map(p).join(""), ctx.appUrl ? { href: ctx.appUrl, label: "View dashboard" } : null),
    text: textJoin(lines.filter(Boolean)),
  };
}
