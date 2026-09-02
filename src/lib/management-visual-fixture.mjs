/**
 * Isolated Management Overview visual-review fixture.
 * Never imported by the real Overview. Does not write bookings, earnings, or reports.
 */

import { collectOperationalIncidents } from "./management-incidents.mjs";
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

  const confirmLeadMin = scene === "critical" || scene === "criticalresolved" ? 8 : scene === "protected" || scene === "firstprotect" ? 1 : 18;
  const confirmHall = booking(now, {
    id: "fx-confirm",
    student_first_name: "Jordan",
    tutor_display_name:
      scene === "restored" || scene === "history"
        ? "James M."
        : scene === "replacement" || scene === "resolved" || scene === "replace2" || scene === "criticalresolved"
          ? "Grace K."
          : "Sarah M.",
    tutor_id:
      scene === "restored" || scene === "history"
        ? "g-james"
        : scene === "replacement" || scene === "resolved" || scene === "replace2" || scene === "criticalresolved"
          ? "g-grace"
          : "g-sarah",
    scheduled_start: later(now, 0, confirmLeadMin),
    scheduled_end: later(now, 1, confirmLeadMin),
    status: scene === "protected" || scene === "firstprotect" ? "cancelled" : "confirmed",
  });
  const blockKids = ["Jordan", "Maya", "Ethan", "Ava"];
  const blockCount =
    scene === "block4missed" || scene === "split" || scene === "mixedblock" || scene === "firstprotect" ? 4 : scene === "replace2" ? 2 : 0;
  const blockGuide = scene === "replace2" || scene === "split" ? { name: "Grace K.", id: "g-grace" } : { name: "Sarah M.", id: "g-sarah" };
  const blockHalls = blockCount
    ? Array.from({ length: blockCount }, (_, i) =>
        booking(now, {
          id: i === 0 ? "fx-confirm" : `fx-confirm-${i}`,
          student_first_name: blockKids[i],
          tutor_display_name: scene === "split" && i >= 2 ? "James O." : blockGuide.name,
          tutor_id: scene === "split" && i >= 2 ? "g-james" : blockGuide.id,
          scheduled_start: later(now, 0, (scene === "mixedblock" || scene === "firstprotect" ? 8 : 18) + i * 60),
          scheduled_end: later(now, 0, (scene === "mixedblock" || scene === "firstprotect" ? 68 : 78) + i * 60),
          status: scene === "firstprotect" && i === 0 ? "cancelled" : "confirmed",
        }),
      )
    : [];
  const attendanceByBooking = {};
  if (scene === "missed" || scene === "search") {
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
  } else if (scene === "restored" || scene === "history") {
    attendanceByBooking["fx-confirm"] = {
      id: "fx-att-emerg",
      booking_id: "fx-confirm",
      tutor_id: "g-james",
      source: "emergency",
      status: "confirmed",
      confirmed_at: later(now, 0, -0.2),
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
  } else if (scene === "critical") {
    attendanceByBooking["fx-confirm"] = {
      id: "fx-att-crit",
      booking_id: "fx-confirm",
      tutor_id: "g-sarah",
      source: "t30",
      status: "missed",
      deadline_at: later(now, 0, -12),
      missed_at: later(now, 0, -12),
      critical_at: later(now, 0, -1),
    };
  } else if (scene === "criticalresolved") {
    attendanceByBooking["fx-confirm"] = {
      id: "fx-att-crit-ok",
      booking_id: "fx-confirm",
      tutor_id: "g-grace",
      source: "replacement",
      status: "confirmed",
      confirmed_at: later(now, 0, -0.2),
    };
  } else if (scene === "protected") {
    attendanceByBooking["fx-confirm"] = {
      id: "fx-att-prot",
      booking_id: "fx-confirm",
      tutor_id: "g-sarah",
      source: "t30",
      status: "missed",
      resolution: "customer_protected",
      customer_protected_at: later(now, 0, -0.1),
      missed_at: later(now, 0, -12),
    };
  } else if (scene === "block4missed" || scene === "replace2" || scene === "split" || scene === "mixedblock" || scene === "firstprotect") {
    for (const hall of blockHalls) {
      const first = hall.id === "fx-confirm";
      attendanceByBooking[hall.id] = {
        id: `fx-att-${hall.id}`,
        booking_id: hall.id,
        tutor_id: hall.tutor_id,
        source: scene === "replace2" || scene === "split" ? "replacement" : "t30",
        status:
          scene === "firstprotect" && first
            ? "missed"
            : scene === "firstprotect"
              ? "confirmed"
              : scene === "block4missed" || scene === "mixedblock"
                ? "missed"
                : scene === "split" && hall.tutor_id === "g-james"
                  ? "confirmed"
                  : "awaiting",
        deadline_at: later(now, 0, scene === "block4missed" || scene === "mixedblock" || scene === "firstprotect" ? -2 : 9),
        missed_at: scene === "block4missed" || scene === "mixedblock" || (scene === "firstprotect" && first) ? later(now, 0, -2) : null,
        confirmed_at: scene === "split" && hall.tutor_id === "g-james" ? later(now, 0, -0.2) : scene === "firstprotect" && !first ? later(now, 0, -0.2) : null,
        resolution: scene === "firstprotect" && first ? "customer_protected" : null,
        customer_protected_at: scene === "firstprotect" && first ? later(now, 0, -0.1) : null,
      };
    }
  }

  const bookings = scene
    ? [...(blockHalls.length ? blockHalls : [confirmHall]), liveA, liveB, next, uncovered, ...laterRows, ...completed, ...filler]
    : [liveA, liveB, next, uncovered, ...laterRows, ...completed, ...filler];
  const presenceByBooking = {
    "fx-live-1": { tutor_first_joined_at: later(now, -0.35), tutor_last_seen_at: later(now, -0.1) },
    "fx-live-2": { student_first_joined_at: later(now, -0.25), student_last_seen_at: later(now, -0.05) },
  };

  const offerCountByBooking = scene === "search" ? { "fx-confirm": 8 } : {};
  const bookingsWithIssues = bookings.map((b) => ({
    ...b,
    issues: currentStudyHallIssues(b, {
      presence: presenceByBooking[b.id],
      attendance: attendanceByBooking[b.id] ?? null,
      assignmentsLoaded: Boolean(scene),
      offerCount: offerCountByBooking[b.id] ?? 0,
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
    offerCountByBooking,
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

/** Isolated Incident History fixture. Never writes bookings or ledgers. */
export function managementIncidentHistoryFixture(now = new Date()) {
  const timeZone = "America/Chicago";
  const nowMs = now.getTime();
  const iso = (minutesAgo) => new Date(nowMs - minutesAgo * 60_000).toISOString();
  const bookings = [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      status: "cancelled",
      cancelled_at: iso(20),
      student_first_name: "Jay Christopher Montgomery",
      tutor_id: "g-tutor-1",
      tutor_display_name: "Test Tutor 1",
      parent_name: "Parent J",
      scheduled_start: iso(10),
      scheduled_end: iso(-50),
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      status: "cancelled",
      cancelled_at: iso(18),
      student_first_name: "Maddi",
      tutor_id: "g-tutor-1",
      tutor_display_name: "Test Tutor 1",
      scheduled_start: iso(8),
      scheduled_end: iso(-52),
    },
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: "confirmed",
      student_first_name: "Jordan",
      tutor_id: "g-james",
      tutor_display_name: "James M.",
      scheduled_start: iso(-25),
      scheduled_end: iso(-85),
    },
    {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      status: "confirmed",
      student_first_name: "Sam",
      tutor_id: "g-sarah",
      tutor_display_name: "Sarah M.",
      scheduled_start: iso(-8),
      scheduled_end: iso(-68),
    },
  ];
  const incidents = collectOperationalIncidents({
    bookings,
    assignmentsByBooking: {
      [bookings[0].id]: [
        {
          booking_id: bookings[0].id,
          tutor_id: "g-tutor-1",
          source: "t30",
          status: "missed",
          requested_at: iso(40),
          deadline_at: iso(30),
          missed_at: iso(30),
          resolution: "customer_protected",
          customer_protected_at: iso(20),
          resolved_at: iso(20),
        },
      ],
      [bookings[1].id]: [
        {
          booking_id: bookings[1].id,
          tutor_id: "g-tutor-1",
          source: "t30",
          status: "missed",
          requested_at: iso(38),
          missed_at: iso(28),
          resolution: "customer_protected",
          customer_protected_at: iso(18),
        },
      ],
      [bookings[2].id]: [
        {
          booking_id: bookings[2].id,
          tutor_id: "g-sarah",
          source: "t30",
          status: "missed",
          requested_at: iso(50),
          missed_at: iso(40),
        },
        {
          booking_id: bookings[2].id,
          tutor_id: "g-james",
          source: "emergency",
          status: "confirmed",
          requested_at: iso(39),
          confirmed_at: iso(36),
        },
      ],
      [bookings[3].id]: [
        {
          booking_id: bookings[3].id,
          tutor_id: "g-sarah",
          source: "t30",
          status: "missed",
          requested_at: iso(25),
          missed_at: iso(15),
          critical_at: iso(9),
        },
      ],
    },
    offersByBooking: {
      [bookings[2].id]: [
        { booking_id: bookings[2].id, tutor_id: "g-james", status: "claimed", created_at: iso(39), claimed_at: iso(36) },
        { booking_id: bookings[2].id, tutor_id: "g-grace", status: "closed", created_at: iso(39) },
        { booking_id: bookings[2].id, tutor_id: "g-faith", status: "closed", created_at: iso(39) },
        { booking_id: bookings[2].id, tutor_id: "g-chidi", status: "closed", created_at: iso(39) },
      ],
      [bookings[3].id]: [{ booking_id: bookings[3].id, status: "closed", created_at: iso(15), closed_at: iso(9) }],
    },
    complimentaryByBooking: {
      [bookings[0].id]: [{ booking_id: bookings[0].id, minutes_delta: 60, reference: `comp-hour:${bookings[0].id}`, created_at: iso(20) }],
      [bookings[1].id]: [{ booking_id: bookings[1].id, minutes_delta: 60, reference: `comp-hour:${bookings[1].id}`, created_at: iso(18) }],
    },
    emailsByBooking: {
      [bookings[0].id]: [{ notification_type: "coverage_failure_protection", status: "sent", updated_at: iso(20) }],
    },
    guideNames: {
      "g-tutor-1": "Test Tutor 1",
      "g-james": "James M.",
      "g-sarah": "Sarah M.",
    },
    nowMs,
  });
  return { incidents, nowMs, timeZone };
}
