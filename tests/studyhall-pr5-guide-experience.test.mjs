import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  PACKAGE_14H_MINUTES,
  PACKAGE_14H_PRICE_CENTS,
  PACKAGE_28H_MINUTES,
  PACKAGE_28H_PRICE_CENTS,
} from "../src/lib/packages.mjs";
import { JOIN_OPEN_LEAD_MIN } from "../src/lib/session-window.mjs";
import { formatStudyHallDuration, guideEarningCents } from "../src/lib/studyhall-duration.mjs";
import { guideJoinUiState, tutorSessionAction } from "../src/lib/tutor-schedule.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Study Hall PR5 — Guide workspace (source)", () => {
  it("Guide dashboard uses Study Hall terminology (not Tutor/Tutoring)", () => {
    const page = read("src/app/dashboard/tutor/page.tsx");
    const next = read("src/components/dashboard/guide-next-study-hall.tsx");
    const today = read("src/components/dashboard/guide-today-schedule.tsx");
    assert.match(page, /Guide workspace/);
    assert.match(today, /Today'?s Study Halls|Upcoming Study Halls/);
    assert.match(next, /Join Study Hall|GuideJoinControl/);
    assert.match(page, /presence, focus, accountability/i);
    assert.doesNotMatch(page, /Your tutor account|Approved subjects|Tutor Dashboard/i);
    // Role copy may say "not … teach lessons / subject tutor" — that is intentional framing.
    assert.match(page, /not expected to teach lessons|not tutoring/i);
    assert.doesNotMatch(page, /Book a tutoring|Tutor Dashboard|subject specialty prep/i);
  });

  it("Guide dashboard does not introduce subject matching or specialty prep", () => {
    const page = read("src/app/dashboard/tutor/page.tsx");
    assert.doesNotMatch(page, /tutor_subjects|Approved subjects|specialty/i);
    assert.match(page, /not tutoring or homework answers/i);
  });

  it("1h/2h/3h duration labels are correct", () => {
    assert.equal(formatStudyHallDuration(60), "1 hour");
    assert.equal(formatStudyHallDuration(120), "2 hours");
    assert.equal(formatStudyHallDuration(180), "3 hours");
    assert.match(read("src/components/dashboard/guide-next-study-hall.tsx"), /formatStudyHallDuration/);
  });

  it("Guide join UI respects T−5 while pending stays non-joinable", () => {
    assert.equal(JOIN_OPEN_LEAD_MIN, 5);
    assert.equal(tutorSessionAction("confirmed", true), "join");
    assert.equal(tutorSessionAction("pending", true), "awaiting");

    const start = "2026-08-24T12:00:00.000Z";
    const end = "2026-08-24T13:00:00.000Z";
    const tMinus6 = Date.parse(start) - 6 * 60000;
    const tMinus4 = Date.parse(start) - 4 * 60000;
    assert.equal(guideJoinUiState("confirmed", start, end, tMinus6).kind, "opens_at");
    assert.equal(guideJoinUiState("confirmed", start, end, tMinus4).kind, "join");
    assert.equal(guideJoinUiState("pending", start, end, tMinus4).kind, "awaiting");
  });

  it("Guide session room reminds supervision role and keeps T−5 copy", () => {
    const room = read("src/components/session/session-room.tsx");
    assert.match(room, /Guide expectations/);
    assert.match(room, /Do not tutor|not expected to teach|Do not tutor/i);
    assert.match(room, /Join Study Hall/);
    assert.match(room, /5\s*minutes before/);
  });

  it("Guide earnings scale with duration (1h/2h/3h); free session still paid to Guide", () => {
    const rate = 1000; // $10/hr
    assert.equal(guideEarningCents(rate, 60), 1000);
    assert.equal(guideEarningCents(rate, 120), 2000);
    assert.equal(guideEarningCents(rate, 180), 3000);
    // Free session still uses booking duration for Guide pay.
    assert.equal(guideEarningCents(rate, 60), 1000);
    const earnSql = read("supabase/migrations/0006_phase4a_review_fixes.sql");
    assert.match(earnSql, /v_rate::numeric \* v_duration \/ 60\.0/);
  });

  it("availability copy is Study Hall / parent oriented", () => {
    const avail = read("src/components/dashboard/availability-manager.tsx");
    assert.match(avail, /parents can book for Study Hall/);
    assert.doesNotMatch(avail, /students can book/);
  });

  it("PR2 package pricing + PR3 free trial + PR4 join window remain intact", () => {
    const pricing = read("src/lib/pricing.ts");
    assert.match(pricing, /PAYG_PRICE_USD = 12/);
    assert.match(pricing, /FREE_TRIAL_MINUTES = 60/);
    assert.match(pricing, /minutes:\s*60,\s*priceUsd:\s*12/);
    assert.match(pricing, /minutes:\s*120,\s*priceUsd:\s*24/);
    assert.match(pricing, /minutes:\s*180,\s*priceUsd:\s*36/);
    assert.doesNotMatch(pricing, /minutes:\s*30,/);
    assert.equal(PACKAGE_14H_MINUTES, 840);
    assert.equal(PACKAGE_14H_PRICE_CENTS, 14000);
    assert.equal(PACKAGE_28H_MINUTES, 1680);
    assert.equal(PACKAGE_28H_PRICE_CENTS, 25200);
    assert.equal(JOIN_OPEN_LEAD_MIN, 5);
    const m22 = read("supabase/migrations/0022_studyhall_pr4_supervision_booking.sql");
    assert.match(m22, /interval '5 minutes'/);
    assert.match(m22, /Study Hall sessions are 1, 2, or 3 hours/);
  });
});
