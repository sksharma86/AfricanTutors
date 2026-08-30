/**
 * Isolated Management Overview visual-review fixture.
 * Never imported by the real Overview. Does not write bookings, earnings, or reports.
 */

import { collectNeedsAttention, currentStudyHallIssues } from "./management-ops.mjs";

function later(now, hours, minutes = 0) {
  return new Date(now.getTime() + (hours * 60 + minutes) * 60000).toISOString();
}

function booking(now, overrides = {}) {
  return {
    id: "fx-hall",
    student_first_name: "Jordan",
    student_first_names: null,
    child_count: 1,
    tutor_display_name: "Sarah M.",
    tutor_id: "g-sarah",
    scheduled_start: later(now, 0, 30),
    scheduled_end: later(now, 1, 30),
    duration_minutes: 60,
    status: "confirmed",
    payment_status: "paid",
    is_free_trial: false,
    issues: [],
    ...overrides,
  };
}

export function managementVisualReviewNow(now = new Date(), tz = "America/Chicago", hour = 18, minute = 5) {
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
  if (!Number.isFinite(shownH) || !Number.isFinite(shownM)) return new Date(utcGuess);
  return new Date(utcGuess - (shownH * 60 + shownM - (hour * 60 + minute)) * 60000);
}

export function managementHomeVisualFixture(now = new Date(), { empty = false, scene = null } = {}) {
  const timeZone = "America/Chicago";
  const nowMs = now.getTime();
  if (empty) {
    return {
      bookings: [],
      presenceByBooking: {},
      attentionItems: [],
      guidesActive: 0,
      outstandingTotals: [],
      guides: [],
      reports: [],
      payments: [],
      nowMs,
      timeZone,
    };
  }

  const liveA = booking(now, {
    id: "fx-live-1",
    student_first_name: "Jordan",
    tutor_display_name: "Sarah M.",
    scheduled_start: later(now, -0.4),
    scheduled_end: later(now, 0.6),
  });
  const liveB = booking(now, {
    id: "fx-live-2",
    student_first_name: "Maya",
    tutor_display_name: "Faith N.",
    duration_minutes: 120,
    scheduled_start: later(now, -0.3),
    scheduled_end: later(now, 1.7),
  });
  const next = booking(now, {
    id: "fx-next",
    student_first_name: "Aiden",
    tutor_display_name: "Grace K.",
    scheduled_start: later(now, 0, 25),
    scheduled_end: later(now, 1, 25),
  });
  const uncovered = booking(now, {
    id: "fx-need-guide",
    student_first_name: "Jordan",
    tutor_display_name: null,
    tutor_id: null,
    scheduled_start: later(now, 0, 25),
    scheduled_end: later(now, 1, 25),
  });
  const laterRows = [
    booking(now, { id: "fx-u1", student_first_name: "Ethan", tutor_display_name: "Sarah M.", scheduled_start: later(now, 1), scheduled_end: later(now, 2) }),
    booking(now, { id: "fx-u2", student_first_name: "Priya", tutor_display_name: "Faith N.", scheduled_start: later(now, 1.5), scheduled_end: later(now, 2.5) }),
    booking(now, { id: "fx-u3", student_first_name: "Leo", tutor_display_name: "Grace K.", scheduled_start: later(now, 2), scheduled_end: later(now, 3) }),
  ];
  const completed = Array.from({ length: 7 }, (_, i) =>
    booking(now, {
      id: `fx-done-${i}`,
      status: "completed",
      student_first_name: ["Ava", "Noah", "Ivy", "Sam", "Maya", "Jordan", "Leo"][i],
      tutor_display_name: ["Sarah M.", "Grace K.", "Faith N."][i % 3],
      scheduled_start: later(now, -(8 - i)),
      scheduled_end: later(now, -(7 - i)),
    }),
  );
  const filler = Array.from({ length: 4 }, (_, i) =>
    booking(now, {
      id: `fx-more-${i}`,
      student_first_name: ["Kai", "Nina", "Omar", "Rue"][i],
      tutor_display_name: "Sarah M.",
      scheduled_start: later(now, 2.4 + i * 0.35),
      scheduled_end: later(now, 3.4 + i * 0.35),
    }),
  );

  const confirmHall = booking(now, {
    id: "fx-confirm",
    student_first_name: "Jordan",
    tutor_display_name: scene === "replacement" || scene === "resolved" ? "Grace K." : "Sarah M.",
    tutor_id: scene === "replacement" || scene === "resolved" ? "g-grace" : "g-sarah",
    scheduled_start: later(now, 0, 18),
    scheduled_end: later(now, 1, 18),
  });
  const attendanceByBooking = {};
  if (scene === "missed") {
    attendanceByBooking["fx-confirm"] = {
      id: "fx-att-miss",
      booking_id: "fx-confirm",
      tutor_id: "g-sarah",
      source: "t30",
      status: "missed",
      deadline_at: later(now, 0, -2),
      missed_at: later(now, 0, -2),
    };
  } else if (scene === "replacement") {
    attendanceByBooking["fx-confirm"] = {
      id: "fx-att-rep",
      booking_id: "fx-confirm",
      tutor_id: "g-grace",
      source: "replacement",
      status: "awaiting",
      requested_at: later(now, 0, -1),
      deadline_at: later(now, 0, 9),
    };
  } else if (scene === "resolved") {
    attendanceByBooking["fx-confirm"] = {
      id: "fx-att-res",
      booking_id: "fx-confirm",
      tutor_id: "g-grace",
      source: "replacement",
      status: "confirmed",
      confirmed_at: later(now, 0, -0.2),
    };
  }

  const bookings = scene
    ? [confirmHall, liveA, liveB, next, uncovered, ...laterRows, ...completed, ...filler]
    : [liveA, liveB, next, uncovered, ...laterRows, ...completed, ...filler];
  const presenceByBooking = {
    "fx-live-1": { tutor_first_joined_at: later(now, -0.35), tutor_last_seen_at: later(now, -0.1) },
    "fx-live-2": { student_first_joined_at: later(now, -0.25), student_last_seen_at: later(now, -0.05) },
  };

  const bookingsWithIssues = bookings.map((b) => ({
    ...b,
    issues: currentStudyHallIssues(b, {
      presence: presenceByBooking[b.id],
      attendance: attendanceByBooking[b.id] ?? null,
      assignmentsLoaded: Boolean(scene),
      nowMs,
    }),
  }));

  const attentionItems = collectNeedsAttention({
    bookings: bookingsWithIssues,
    presenceByBooking,
    pendingApplicants: [
      { profile_id: "g-app-1", display_name: "Chinedu A." },
      { profile_id: "g-app-2", display_name: "Amara O." },
    ],
    attendanceByBooking,
    assignmentsLoaded: Boolean(scene),
    nowMs,
  });

  const reports = completed.slice(0, 3).map((b, i) => ({
    booking_id: b.id,
    submitted_at: later(now, -(6.5 - i)),
  }));

  return {
    bookings: bookingsWithIssues,
    presenceByBooking,
    attentionItems,
    guidesActive: 12,
    outstandingTotals: [
      { currency: "KES", earned: 4860000, paid: 3000000, outstanding: 1860000 },
      { currency: "USD", earned: 4000, paid: 0, outstanding: 4000 },
    ],
    guides: [
      ...Array.from({ length: 12 }, (_, i) => ({ status: "approved", approved_at: later(now, -(100 + i)) })),
      { status: "pending", approved_at: null },
      { status: "pending", approved_at: null },
    ],
    reports,
    payments: [{ created_at: later(now, -2), status: "succeeded", stripe_paid_cents: 148200 }],
    nowMs,
    timeZone,
  };
}
