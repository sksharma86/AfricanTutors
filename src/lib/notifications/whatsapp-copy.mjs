/**
 * Guide WhatsApp copy. Portal remains authoritative — these messages only
 * deep-link to /dashboard/tutor. No inbound YES/Y/1 confirmation.
 *
 * Child first names are allowed (same as Guide email). Never include parent
 * phone, parent email, address, payment, recordings, or Daily URLs.
 */

import { formatTime, tzAbbreviation } from "../timezone-format.mjs";

export const WA_TEMPLATES = Object.freeze({
  attendance: "guide_attendance_confirmation",
  replacement: "guide_replacement_assignment",
});

export function labeledTime(iso, tz) {
  if (!iso) return "your scheduled time";
  const zone = tz || "UTC";
  try {
    const time = formatTime(iso, zone);
    const abbr = tzAbbreviation(iso, zone);
    return abbr ? `${time} ${abbr}` : time;
  } catch {
    return iso;
  }
}

export function guidePortalUrl(appUrl) {
  return `${String(appUrl || "").replace(/\/+$/, "")}/dashboard/tutor`;
}

function hoursLabel(minutes) {
  if (minutes === 60) return "60 minutes";
  if (minutes === 120) return "2 hours";
  if (minutes === 180) return "3 hours";
  return `${minutes || 60} minutes`;
}

/**
 * @param {{
 *   count?: number,
 *   startISO?: string|null,
 *   endISO?: string|null,
 *   tz?: string|null,
 *   durationMinutes?: number|null,
 *   studentName?: string|null,
 *   appUrl?: string|null,
 *   replacement?: boolean,
 * }} ctx
 */
export function guideAttendanceWhatsApp(ctx = {}) {
  const count = Number(ctx.count) > 0 ? Number(ctx.count) : 1;
  const start = labeledTime(ctx.startISO, ctx.tz);
  const end = labeledTime(ctx.endISO || ctx.startISO, ctx.tz);
  const url = guidePortalUrl(ctx.appUrl);
  const replacement = Boolean(ctx.replacement);
  const template = replacement ? WA_TEMPLATES.replacement : WA_TEMPLATES.attendance;
  const variables = {
    1: String(count),
    2: start,
    3: end,
    4: url,
  };

  if (replacement) {
    const body =
      count === 1
        ? [
            "NEW STUDY HALL ASSIGNMENT",
            "",
            `You've been assigned a Study Hall beginning at ${start}.`,
            "",
            "Please confirm your availability now.",
            "",
            url,
          ].join("\n")
        : [
            "NEW STUDY HALL ASSIGNMENTS",
            "",
            `You've been assigned ${count} consecutive Study Halls from ${start} to ${end}.`,
            "",
            "Please confirm that you're available for the full block.",
            "",
            url,
          ].join("\n");
    return { template, variables, body, count, start, end, url };
  }

  if (count === 1) {
    const child = ctx.studentName ? String(ctx.studentName) : null;
    const body = [
      "STUDY HALL ATTENDANCE CONFIRMATION",
      "",
      "Your Study Hall starts in 30 minutes.",
      "",
      start,
      child,
      hoursLabel(ctx.durationMinutes),
      "",
      "Please confirm that you'll be there.",
      "",
      url,
    ]
      .filter((line) => line !== null)
      .join("\n");
    return { template, variables, body, count, start, end, url };
  }

  const body = [
    "STUDY HALL ATTENDANCE CONFIRMATION",
    "",
    `You're scheduled for ${count} consecutive Study Halls from ${start} to ${end}.`,
    "",
    "Please confirm that you'll be available for the full block.",
    "",
    url,
  ].join("\n");
  return { template, variables, body, count, start, end, url };
}

export function whatsappContainsSensitive(text) {
  return /@|phone_e164|parent@|stripe|daily\.co|recording|password|token/i.test(String(text ?? ""));
}
