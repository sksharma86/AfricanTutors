/**
 * Isolated visual-review fixtures. Never imported by the real Parent Home.
 * Used only when PARENT_HOME_VISUAL_REVIEW=1.
 */

function at(now, daysFromNow, hour = 18, minute = 30) {
  const d = new Date(now);
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function booking(overrides = {}) {
  return {
    id: "fixture-next",
    student_id: "fixture-child",
    public_reference: "FIX-1",
    subject_name: null,
    other_subject_text: null,
    request_note: null,
    scheduled_start: at(new Date(), 0, 18, 30),
    scheduled_end: at(new Date(), 0, 19, 30),
    duration_minutes: 60,
    status: "confirmed",
    is_free_trial: false,
    payment_status: "paid",
    tutor_display_name: "James",
    students: { full_name: "Jordan", timezone: "America/Chicago" },
    ...overrides,
  };
}

export function parentHomeVisualFixture(now = new Date(), { scene = null } = {}) {
  const laterA = booking({
    id: "fixture-up-1",
    scheduled_start: at(now, 1, 18, 30),
    scheduled_end: at(now, 1, 19, 30),
    tutor_display_name: "James",
  });
  const laterB = booking({
    id: "fixture-up-2",
    scheduled_start: at(now, 2, 16, 0),
    scheduled_end: at(now, 2, 17, 0),
    tutor_display_name: "Sarah",
    students: { full_name: "Jordan", timezone: "America/Chicago" },
  });
  const recent = booking({
    id: "fixture-recent",
    status: "completed",
    scheduled_start: at(now, -2, 18, 30),
    scheduled_end: at(now, -2, 19, 30),
    tutor_display_name: "Sarah",
  });
  // Seven earlier completed days + recent = 8 completed this month when `now` is mid/late month.
  const completed = [4, 8, 11, 15, 18, 22, 25].map((day, i) => {
    const start = new Date(now);
    start.setDate(day);
    start.setHours(18, 30, 0, 0);
    const end = new Date(start.getTime() + 60 * 60000);
    return booking({
      id: `fixture-done-${i}`,
      status: "completed",
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      tutor_display_name: i % 2 ? "Sarah" : "James",
    });
  });
  const next = booking({
    id: "fixture-next",
    scheduled_start: new Date(now.getTime() + 2 * 60000).toISOString(),
    scheduled_end: new Date(now.getTime() + 62 * 60000).toISOString(),
  });
  const cancelled = booking({
    id: "fixture-protected",
    status: "cancelled",
    scheduled_start: new Date(now.getTime() + 2 * 60000).toISOString(),
    scheduled_end: new Date(now.getTime() + 62 * 60000).toISOString(),
    tutor_display_name: "Sarah",
  });

  if (scene === "empty") {
    return {
      firstName: "Priya",
      next: null,
      last: null,
      lastReport: null,
      lastRecording: null,
      later: [],
      bookings: [],
      householdTz: "America/Chicago",
      minutes: 0,
      creditCents: 0,
      preferFreeSession: true,
    };
  }

  if (scene === "one-next") {
    return {
      firstName: "Priya",
      next,
      last: recent,
      lastReport: {
        id: "fixture-report",
        booking_id: recent.id,
        submitted_at: recent.scheduled_end,
        focus_rating: "good_focus",
        work_summary: "Homework stayed on track.",
        redirection_level: "a_little",
        guide_note: null,
      },
      lastRecording: {
        id: "fixture-rec",
        booking_id: recent.id,
        status: "completed",
        retention_until: at(now, 60),
        deleted_at: null,
        daily_recording_id: "fixture",
        completed_at: recent.scheduled_end,
      },
      later: [],
      bookings: [next, recent, ...completed],
      householdTz: "America/Chicago",
      minutes: 660,
      creditCents: 0,
      preferFreeSession: false,
    };
  }

  if (scene === "protected") {
    return {
      firstName: "Priya",
      next: null,
      last: recent,
      lastReport: {
        id: "fixture-report",
        booking_id: recent.id,
        submitted_at: recent.scheduled_end,
        focus_rating: "good_focus",
        work_summary: "Homework stayed on track.",
        redirection_level: "a_little",
        guide_note: null,
      },
      lastRecording: {
        id: "fixture-rec",
        booking_id: recent.id,
        status: "completed",
        retention_until: at(now, 60),
        deleted_at: null,
        daily_recording_id: "fixture",
        completed_at: recent.scheduled_end,
      },
      later: [laterA, laterB],
      bookings: [cancelled, laterA, laterB, recent, ...completed],
      householdTz: "America/Chicago",
      minutes: 720,
      creditCents: 0,
      preferFreeSession: false,
    };
  }

  return {
    firstName: "Priya",
    next,
    last: recent,
    lastReport: {
      id: "fixture-report",
      booking_id: recent.id,
      submitted_at: recent.scheduled_end,
      focus_rating: "good_focus",
      work_summary: "Homework stayed on track.",
      redirection_level: "a_little",
      guide_note: null,
    },
    lastRecording: {
      id: "fixture-rec",
      booking_id: recent.id,
      status: "completed",
      retention_until: at(now, 60),
      deleted_at: null,
      daily_recording_id: "fixture",
      completed_at: recent.scheduled_end,
    },
    later: [laterA, laterB],
    bookings: [next, laterA, laterB, recent, ...completed],
    householdTz: "America/Chicago",
    minutes: 660,
    creditCents: 0,
    preferFreeSession: false,
  };
}
