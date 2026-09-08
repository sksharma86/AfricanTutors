import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";

import {
  PLAN_MY_WEEK_HREF,
  PLAN_WEEK_DURATION_MINUTES,
  PLAN_WEEK_MAX_OFFSET,
  PLAN_WEEK_NOTICE_MINUTES,
  bookingsByLocalDate,
  canScheduleStart,
  formatPlanSessionLine,
  isWithinPlanningHorizon,
  normalizePlanWeekRequest,
  planWeekResultMessage,
  planningWeek,
  slotsForLocalDate,
  startAlreadyBooked,
} from "../src/lib/plan-my-week.mjs";
import { PARENT_PORTAL_NAV } from "../src/lib/parent-portal.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const TZ = "America/Chicago";
/** Monday Sep 7 2026 10:00 AM Chicago (CDT, UTC-5). */
const NOW = new Date("2026-09-07T15:00:00.000Z");
const NOW_MS = NOW.getTime();
/** Wednesday Sep 9 2026 4:00 PM Chicago. */
const WED_4PM = "2026-09-09T21:00:00.000Z";
/** Thursday Sep 10 2026 4:00 PM Chicago. */
const THU_4PM = "2026-09-10T21:00:00.000Z";
/** Friday Sep 11 2026 5:00 PM Chicago. */
const FRI_5PM = "2026-09-11T22:00:00.000Z";
/** Monday Sep 7 2026 8:00 AM Chicago — already in the past relative to NOW. */
const MON_8AM = "2026-09-07T13:00:00.000Z";

describe("Plan My Week — week labels and horizon", () => {
  it("labels the local Monday–Sunday week and marks past days", () => {
    const week = planningWeek(TZ, NOW, 0);
    assert.equal(week.monday, "2026-09-07");
    assert.equal(week.sunday, "2026-09-13");
    assert.equal(week.label, "Monday Sep 7 – Sunday Sep 13");
    assert.equal(week.days[0].weekdayLong, "Monday");
    assert.equal(week.days[0].isPast, false);
    assert.equal(week.days[0].isToday, true);
    assert.equal(week.days[2].weekdayLong, "Wednesday");
    assert.equal(week.days[2].monthDay, "Sep 9");
    assert.equal(week.canGoBack, false);
    assert.equal(week.canGoForward, true);
  });

  it("navigates to next week only, not an unlimited calendar", () => {
    const next = planningWeek(TZ, NOW, 1);
    assert.equal(next.monday, "2026-09-14");
    assert.equal(next.sunday, "2026-09-20");
    assert.equal(next.label, "Monday Sep 14 – Sunday Sep 20");
    assert.equal(next.canGoBack, true);
    assert.equal(next.canGoForward, false);
    assert.equal(PLAN_WEEK_MAX_OFFSET, 1);
    const clamped = planningWeek(TZ, NOW, 9);
    assert.equal(clamped.weekOffset, 1);
    assert.equal(isWithinPlanningHorizon("2026-09-21T21:00:00.000Z", TZ, NOW), false);
    assert.equal(isWithinPlanningHorizon(WED_4PM, TZ, NOW), true);
  });

  it("keeps notice minutes aligned with the booking engine", () => {
    const bookingConfig = read("src/lib/booking-config.ts");
    assert.match(bookingConfig, /MIN_BOOKING_NOTICE_MINUTES = 120/);
    assert.equal(PLAN_WEEK_NOTICE_MINUTES, 120);
    assert.equal(PLAN_WEEK_DURATION_MINUTES, 60);
  });
});

describe("Plan My Week — past times and one-hour slots", () => {
  it("rejects past local times and times inside the notice window", () => {
    assert.equal(canScheduleStart(MON_8AM, TZ, NOW_MS), false);
    assert.equal(canScheduleStart(WED_4PM, TZ, NOW_MS), true);
    const almostNow = new Date(NOW_MS + 30 * 60_000).toISOString();
    assert.equal(canScheduleStart(almostNow, TZ, NOW_MS), false);
  });

  it("filters authoritative slot instants to one local day without inventing availability", () => {
    const slots = slotsForLocalDate([WED_4PM, THU_4PM, MON_8AM, "not-a-slot"], "2026-09-09", TZ, NOW_MS);
    assert.deepEqual(slots, [WED_4PM]);
  });

  it("enforces 60-minute duration on submit and accepts multiple days", () => {
    const rejected = normalizePlanWeekRequest(
      { duration: 120, sessions: [{ startISO: WED_4PM }] },
      { timeZone: TZ, nowMs: NOW_MS },
    );
    assert.equal(rejected.ok, false);
    assert.match(rejected.error, /60 minutes/);

    const accepted = normalizePlanWeekRequest(
      { duration: 60, sessions: [{ startISO: WED_4PM }, { startISO: THU_4PM }, { startISO: FRI_5PM }] },
      { timeZone: TZ, nowMs: NOW_MS },
    );
    assert.equal(accepted.ok, true);
    assert.equal(accepted.sessions.length, 3);
    assert.deepEqual(
      accepted.sessions.map((s) => s.localDate),
      ["2026-09-09", "2026-09-10", "2026-09-11"],
    );
  });

  it("recognizes an existing household booking and does not duplicate it", () => {
    const existing = [{ id: "b-existing", status: "confirmed", scheduled_start: WED_4PM }];
    assert.equal(startAlreadyBooked(existing, WED_4PM)?.id, "b-existing");
    const result = normalizePlanWeekRequest(
      { duration: 60, sessions: [{ startISO: WED_4PM }, { startISO: THU_4PM }] },
      { timeZone: TZ, nowMs: NOW_MS, existingBookings: existing },
    );
    assert.equal(result.sessions.length, 1);
    assert.equal(result.sessions[0].startISO, THU_4PM);
    assert.equal(result.skipped.length, 1);
    assert.equal(result.skipped[0].status, "already_scheduled");
    assert.equal(result.skipped[0].bookingId, "b-existing");

    const byDate = bookingsByLocalDate(existing, TZ);
    assert.equal(byDate.get("2026-09-09")[0].id, "b-existing");
  });

  it("dedupes the same start twice in one submit (partial week still proceeds)", () => {
    const result = normalizePlanWeekRequest(
      { duration: 60, sessions: [{ startISO: WED_4PM }, { startISO: WED_4PM }, { startISO: THU_4PM }] },
      { timeZone: TZ, nowMs: NOW_MS },
    );
    assert.equal(result.sessions.length, 2);
    assert.equal(result.skipped[0].status, "already_scheduled");
  });

  it("formats confirm-screen lines as weekday date plus 60-minute range", () => {
    assert.equal(formatPlanSessionLine(WED_4PM, TZ), "Wed Sep 9 — 4:00–5:00 PM");
    assert.equal(planWeekResultMessage("No Guide is available for that time. Please choose another slot."), "Time no longer available");
  });
});

describe("Plan My Week — parent portal entry and authorization", () => {
  const page = read("src/app/dashboard/student/plan-week/page.tsx");
  const api = read("src/app/api/plan-week/route.ts");
  const ui = read("src/components/dashboard/plan-my-week.tsx");
  const service = read("src/lib/plan-week-service.ts");
  const next = read("src/components/dashboard/parent-next-study-hall.tsx");
  const upcoming = read("src/components/dashboard/parent-upcoming-list.tsx");
  const halls = read("src/components/dashboard/parent-study-halls.tsx");
  const hallsPage = read("src/app/dashboard/student/study-halls/page.tsx");
  const shell = read("src/components/dashboard/customer-shell.tsx");
  const wizard = read("src/components/booking/booking-wizard.tsx");
  const cancelUi = read("src/components/dashboard/customer-booking-actions.tsx");
  const cancelApi = read("src/app/api/bookings/cancel/route.ts");
  const engine = read("supabase/migrations/0038_one_hour_booking_engine.sql");
  const admin = read("src/app/dashboard/admin/page.tsx");
  const checkout = read("src/lib/checkout-service.ts");

  it("parent can open Plan My Week from a student-only page", () => {
    assert.equal(PLAN_MY_WEEK_HREF, "/dashboard/student/plan-week");
    assert.match(page, /requireRole\(\s*"student"/);
    assert.match(page, /Plan My Week/);
    assert.match(page, /PlanMyWeek/);
    assert.match(page, /resolve_account_timezone/);
    assert.match(next, /\/dashboard\/student\/plan-week/);
    assert.match(upcoming, /Plan my week/);
    assert.match(halls, /Plan my week/);
    assert.match(hallsPage, /\/dashboard\/student\/plan-week/);
    assert.match(shell, /Plan my week/);
    assert.equal(
      PARENT_PORTAL_NAV.some((item) => item.href === PLAN_MY_WEEK_HREF),
      false,
      "Plan My Week stays off the primary five-item nav",
    );
  });

  it("availability comes from get_available_slots at 60 minutes", () => {
    assert.match(ui, /get_available_slots/);
    assert.match(ui, /p_duration:\s*PLAN_WEEK_DURATION_MINUTES/);
    assert.match(ui, /p_subject_id:\s*null/);
    assert.match(ui, /slotsForLocalDate/);
    assert.doesNotMatch(ui, /computeGuideAvailability|guide_availability|fakeSlots/);
    assert.doesNotMatch(service, /get_available_slots/);
  });

  it("submission creates normal bookings through createBookingCheckout / book_session", () => {
    assert.match(api, /schedulePlanWeek/);
    assert.match(service, /createBookingCheckout/);
    assert.match(service, /duration:\s*60/);
    assert.match(service, /isFreeTrial:\s*false/);
    assert.match(ui, /fetch\("\/api\/plan-week"/);
    assert.match(ui, /Schedule My Week/);
    assert.match(ui, /Your Study Hall Week/);
    assert.doesNotMatch(service, /from\("bookings"\)\.insert/);
    assert.doesNotMatch(api, /booking_quote/);
  });

  it("does not implement its own 365 usage or funding math", () => {
    assert.doesNotMatch(ui, /consume_study_hall_365|study_hall_365_day_usage|chooseBookingSource/);
    assert.doesNotMatch(api, /consume_study_hall_365|study_hall_365_day_usage/);
    assert.doesNotMatch(service, /consume_study_hall_365|study_hall_365_day_usage|chooseBookingSource/);
    assert.match(engine, /consume_study_hall_365_day|insert into public\.study_hall_365_day_usage/);
    assert.match(engine, /v_use_free := not public.account_has_used_free_trial/);
    const m40 = read("supabase/migrations/0040_same_day_365_funding_fallback.sql");
    assert.match(m40, /prepaid \/ credit \/ PAYG/);
    assert.doesNotMatch(service, /study_hall_365_day_usage|already_consumed/);
  });

  it("processes sessions independently for partial success and guards double submit", () => {
    assert.match(service, /for \(const session of normalized.sessions\)/);
    assert.match(service, /scheduleOne/);
    assert.match(service, /Partial success is intentional/);
    assert.match(service, /inflight/);
    assert.match(service, /clientRequestId/);
    assert.match(ui, /submittingRef/);
    assert.match(ui, /x-plan-week-request-id/);
    assert.match(ui, /clientRequestId/);
    assert.doesNotMatch(service, /BEGIN;|all-or-nothing|throw if any fail/);
  });

  it("change/remove reuse the established cancellation path instead of a new engine", () => {
    assert.match(ui, /\/api\/bookings\/cancel/);
    assert.match(service, /customer_cancel_booking/);
    assert.match(cancelUi, /\/api\/bookings\/cancel/);
    assert.match(cancelApi, /customer_cancel_booking/);
    assert.match(ui, /Replaces the current session after the new time is confirmed/);
    assert.match(ui, /If payment is needed, the current session stays/);
    assert.match(ui, /After it is removed, you can pick a replacement time/);
    assert.match(service, /replaceBookingId: session.replaceBookingId/);
    assert.match(service, /paymentPending/);
    assert.match(service, /Your current session stays scheduled until then/);
    const m41 = read("supabase/migrations/0041_booking_replacement_finalization.sql");
    assert.match(m41, /replaces_booking_id/);
    assert.match(checkout, /attach_booking_replacement/);
    assert.match(checkout, /p_replaces_booking_id:\s*replaceBookingId/);
  });

  it("parent cannot address another household; Guides cannot use Plan My Week", () => {
    assert.match(api, /getCurrentUser/);
    assert.match(api, /user\.role !== "student"/);
    assert.match(api, /Plan My Week is only available in the Parent Portal/);
    assert.doesNotMatch(api, /body\.accountId|p_account:\s*\(body/);
    assert.match(page, /requireRole\(\s*"student"/);
    assert.match(page, /getGuideApplicantInfo/);
    const tutorHome = read("src/app/dashboard/tutor/page.tsx");
    assert.doesNotMatch(tutorHome, /plan-week|Plan My Week/);
  });

  it("admin, booking wizard, and 365 functions remain intact", () => {
    assert.match(admin, /requireRole\("admin"/);
    assert.doesNotMatch(admin, /Plan My Week/);
    assert.match(wizard, /fetch\("\/api\/checkout\/booking"/);
    assert.match(wizard, /get_available_slots/);
    assert.match(wizard, /booking_quote/);
    assert.match(engine, /create or replace function public.book_session/);
    assert.match(engine, /create or replace function public.booking_quote/);
    const files = readdirSync(new URL("../supabase/migrations", import.meta.url).pathname);
    assert.equal(files.some((name) => name.startsWith("0040")), true);
    assert.equal(files.some((name) => name.startsWith("0041")), true);
    assert.equal(files.some((name) => name.startsWith("0042")), true);
    const m40 = read("supabase/migrations/0040_same_day_365_funding_fallback.sql");
    assert.match(m40, /create or replace function public.book_session/);
    assert.doesNotMatch(m40, /plan-week|Plan My Week/);
    const m42 = read("supabase/migrations/0042_same_day_365_replacement_transfer.sql");
    assert.match(m42, /p_replaces_booking_id/);
    assert.doesNotMatch(m42, /plan-week|Plan My Week/);
    assert.equal(existsSync(new URL("../supabase/migrations/0039_study_hall_365_security_hardening.sql", import.meta.url)), true);
  });

  it("uses compact day rows for mobile instead of a seven-column calendar grid", () => {
    assert.doesNotMatch(ui, /grid-cols-7|min-w-\[640px\]|overflow-y-auto max-h/);
    assert.match(ui, /Add Study Hall/);
    assert.match(ui, /flex flex-wrap gap-2/);
    assert.match(ui, /weekdayLong/);
    assert.match(ui, /Who is joining these Study Halls\?/);
    assert.match(ui, /Every Study Hall is 60 minutes/);
    assert.match(ui, /benefits and balance will be applied automatically/);
    assert.match(ui, /Copy to next week/);
    assert.match(ui, /planCopyToNextWeek/);
    assert.match(ui, /week\.weekOffset === 0/);
  });
});
