/**
 * Isolated Guide Home visual-review fixtures. Never imported by the real Guide Home.
 * Used only when GUIDE_HOME_VISUAL_REVIEW=1. Does not write bookings, earnings, or reports.
 */

function weekdayInTz(date, tz) {
  try {
    const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
    const i = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
    return i >= 0 ? i : date.getDay();
  } catch {
    return date.getDay();
  }
}

/** Pin review composition to a stable local clock without writing data. */
export function guideVisualReviewNow(now = new Date(), tz = "America/Chicago", hour = 16, minute = 0) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const utcGuess = Date.parse(`${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
  const shown = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcGuess));
  const shownH = Number(shown.find((p) => p.type === "hour")?.value);
  const shownM = Number(shown.find((p) => p.type === "minute")?.value);
  if (!Number.isFinite(shownH) || !Number.isFinite(shownM)) {
    return new Date(utcGuess);
  }
  return new Date(utcGuess - (shownH * 60 + shownM - (hour * 60 + minute)) * 60000);
}

function later(now, hours, minutes = 0) {
  return new Date(now.getTime() + (hours * 60 + minutes) * 60000).toISOString();
}

function booking(overrides = {}) {
  return {
    id: "fixture-next",
    subject_name: null,
    other_subject_text: null,
    student_first_name: "Jordan",
    student_first_names: null,
    child_count: 1,
    student_grade: null,
    request_note: null,
    scheduled_start: later(new Date(), 2),
    scheduled_end: later(new Date(), 3),
    duration_minutes: 60,
    status: "confirmed",
    is_free_trial: false,
    ...overrides,
  };
}

export function guideHomeVisualFixture(now = new Date(), { reportNeeded = false, empty = false, scene = null } = {}) {
  if (empty) {
    return {
      firstName: "Sarah",
      bookings: [],
      availability: [],
      exceptions: [],
      earnings: [],
      reportedBookings: [],
      reportsReady: true,
      timeZone: "America/Chicago",
      nowMs: now.getTime(),
      currency: "USD",
      profileStatus: "approved",
    };
  }
  const nextOffsetMin = scene === "before" ? 120 : scene === "required" || scene === "confirmed" || scene === "missed" ? 27 : 2;
  const next = booking({
    id: "fixture-next",
    scheduled_start: new Date(now.getTime() + nextOffsetMin * 60000).toISOString(),
    scheduled_end: new Date(now.getTime() + (nextOffsetMin + 60) * 60000).toISOString(),
    student_first_name: "Jordan",
    attendance:
      scene === "required"
        ? {
            id: "fx-att-req",
            booking_id: "fixture-next",
            tutor_id: "g-sarah",
            source: "t30",
            status: "awaiting",
            requested_at: new Date(now.getTime() - 3 * 60000).toISOString(),
            deadline_at: new Date(now.getTime() + 7 * 60000).toISOString(),
          }
        : scene === "confirmed"
          ? {
              id: "fx-att-ok",
              booking_id: "fixture-next",
              tutor_id: "g-sarah",
              source: "t30",
              status: "confirmed",
              requested_at: new Date(now.getTime() - 8 * 60000).toISOString(),
              deadline_at: new Date(now.getTime() + 2 * 60000).toISOString(),
              confirmed_at: new Date(now.getTime() - 1 * 60000).toISOString(),
            }
          : scene === "missed"
            ? {
                id: "fx-att-miss",
                booking_id: "fixture-next",
                tutor_id: "g-sarah",
                source: "t30",
                status: "missed",
                requested_at: new Date(now.getTime() - 12 * 60000).toISOString(),
                deadline_at: new Date(now.getTime() - 2 * 60000).toISOString(),
                missed_at: new Date(now.getTime() - 2 * 60000).toISOString(),
              }
            : scene === "before"
              ? null
              : {
                  id: "fx-att-default",
                  booking_id: "fixture-next",
                  tutor_id: "g-sarah",
                  source: "t30",
                  status: "confirmed",
                  confirmed_at: new Date(now.getTime() - 20 * 60000).toISOString(),
                },
  });
  const todayB = booking({
    id: "fixture-today-2",
    scheduled_start: later(now, 2),
    scheduled_end: later(now, 3),
    student_first_name: "Maya",
  });
  const todayC = booking({
    id: "fixture-today-3",
    scheduled_start: later(now, 4),
    scheduled_end: later(now, 5),
    student_first_name: "Ethan",
  });
  const weekDone = [26, 50].map((hoursAgo, i) =>
    booking({
      id: `fixture-week-${i}`,
      status: "completed",
      scheduled_start: later(now, -hoursAgo),
      scheduled_end: later(now, -hoursAgo + 1),
      student_first_name: ["Ava", "Leo"][i],
    }),
  );
  const laterRow = booking({
    id: "fixture-later",
    scheduled_start: later(now, 48),
    scheduled_end: later(now, 49),
    student_first_name: "Priya",
  });
  const missingReport = booking({
    id: "fixture-report",
    status: "completed",
    scheduled_start: later(now, -3),
    scheduled_end: later(now, -2),
    student_first_name: "Jordan",
  });

  const bookings = reportNeeded
    ? [missingReport, next, todayB, todayC, laterRow, ...weekDone]
    : [next, todayB, todayC, laterRow, ...weekDone];

  return {
    firstName: "Sarah",
    bookings,
    availability: [
      { id: "fix-av-1", day_of_week: weekdayInTz(now, "America/Chicago"), start_time: "17:00:00", end_time: "22:00:00" },
      { id: "fix-av-2", day_of_week: (weekdayInTz(now, "America/Chicago") + 1) % 7, start_time: "16:00:00", end_time: "21:00:00" },
    ],
    exceptions: [],
    earnings: [
      { booking_id: "fixture-week-0", amount_cents: 12000, status: "earned", earned_at: later(now, -24), paid_at: null, currency: "USD" },
      { booking_id: "fixture-week-1", amount_cents: 54000, status: "paid", earned_at: later(now, -72), paid_at: later(now, -48), currency: "USD" },
    ],
    reportedBookings: reportNeeded ? [] : ["fixture-week-0", "fixture-week-1", "fixture-week-2"],
    reportsReady: true,
    timeZone: "America/Chicago",
    nowMs: now.getTime(),
    currency: "USD",
    profileStatus: "approved",
  };
}
