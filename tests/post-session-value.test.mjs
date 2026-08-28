import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import * as T from "../src/lib/email/templates.mjs";
import {
  BOOK_ANOTHER_LABEL,
  FREE_CONVERT_BODY,
  FREE_CONVERT_HEADLINE,
  parentPostSessionOffer,
  parentRecordingHomeLabel,
} from "../src/lib/parent-next-step.mjs";
import { parentFocusLabel, WORK_COMPLETED_PLACEHOLDER } from "../src/lib/session-report.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const NOW = Date.parse("2026-08-28T18:00:00Z");

function booking(overrides = {}) {
  return {
    id: "b1",
    status: "completed",
    is_free_trial: true,
    scheduled_start: "2026-08-27T17:00:00Z",
    scheduled_end: "2026-08-27T18:00:00Z",
    ...overrides,
  };
}

describe("Post-session value — Guide report UX", () => {
  it("keeps one-child and three-child report structure with specific work prompt", () => {
    const form = read("src/components/dashboard/guide-session-report.tsx");
    assert.match(form, /How did Study Hall go for each child\?/);
    assert.match(form, /How did Study Hall go/);
    assert.match(form, /What did they work on/);
    assert.match(form, /WORK_COMPLETED_PLACEHOLDER/);
    assert.match(read("src/lib/session-report.mjs"), /Math worksheet and 20 minutes of reading/);
    assert.match(read("src/lib/session-report.mjs"), /homework/);
    assert.match(form, /Focus — How focused was the child/);
    assert.match(form, /Redirection/);
    assert.match(form, /Note for parent \(optional\)/);
    assert.match(form, /Submit report/);
    assert.match(form, /Complete report/);
    assert.equal(WORK_COMPLETED_PLACEHOLDER, "e.g. Math worksheet and 20 minutes of reading");
  });

  it("mandatory Guide report page and recovery remain", () => {
    const page = read("src/app/dashboard/tutor/study-halls/[bookingId]/report/page.tsx");
    const finish = read("src/components/dashboard/guide-finish-report.tsx");
    const halls = read("src/components/dashboard/guide-study-halls.tsx");
    assert.match(page, /Before you finish, tell the parent how the hour went/);
    assert.match(page, /GuideSessionReport/);
    assert.match(finish, /Finish report/);
    assert.match(halls, /Finish report/);
    assert.match(page, /alreadySubmitted/);
  });
});

describe("Post-session value — parent recap", () => {
  it("presents one-child and multi-child reports with human labels", () => {
    const recap = read("src/components/dashboard/parent-session-recap.tsx");
    const detail = read("src/app/dashboard/student/study-halls/[bookingId]/page.tsx");
    assert.match(recap, /Study Hall complete/);
    assert.match(detail, /ParentCompletedHeader/);
    assert.match(recap, /Worked on/);
    assert.match(recap, /Guide note/);
    assert.match(recap, /label="Focus"/);
    assert.match(recap, /label="Redirection"/);
    assert.match(recap, /report\.children && report\.children\.length > 1/);
    assert.doesNotMatch(recap, /focus_level|redirection_count|report status/);
    assert.equal(parentFocusLabel("good_focus"), "Good");
    assert.equal(parentFocusLabel("great_focus"), "Great");
  });

  it("does not invent work details beyond what the Guide entered", () => {
    const recap = read("src/components/dashboard/parent-session-recap.tsx");
    assert.match(recap, /child\.work_summary|report\.work_summary/);
    assert.doesNotMatch(recap, /algebra questions|Completed 17|generate|openai|invent/i);
  });

  it("recording states stay parent-facing", () => {
    const recap = read("src/components/dashboard/parent-session-recap.tsx");
    assert.match(recap, /Recording processing/);
    assert.match(recap, /Recording unavailable/);
    assert.match(recap, /WatchRecordingButton/);
    assert.doesNotMatch(recap, /daily_recording|webhook|S3/);
    assert.equal(parentRecordingHomeLabel({ status: "processing" }), "Recording processing");
    assert.equal(parentRecordingHomeLabel({ status: "recording" }), "Recording processing");
    assert.equal(parentRecordingHomeLabel({ status: "completed", deleted_at: null }), "Recording ready");
    assert.equal(parentRecordingHomeLabel({ status: "failed" }), "Recording unavailable");
  });
});

describe("Post-session value — Parent Home", () => {
  it("Last Study Hall shows report ready and recording states with secondary actions", () => {
    const recent = read("src/components/dashboard/parent-recent-activity.tsx");
    assert.match(recent, /Last Study Hall/);
    assert.match(recent, /Report ready/);
    assert.match(recent, /Read report/);
    assert.match(recent, /WatchRecordingButton/);
    assert.match(recent, /variant="outline"/);
    assert.match(recent, /parentRecordingHomeLabel/);
  });

  it("free-session conversion appears only after a completed free Study Hall with a report", () => {
    const freeDone = booking();
    const none = parentPostSessionOffer({ bookings: [freeDone], last: freeDone, report: null, minutes: 0, nowMs: NOW });
    assert.equal(none.kind, "none");

    const ready = parentPostSessionOffer({
      bookings: [freeDone],
      last: freeDone,
      report: { id: "r1" },
      minutes: 0,
      nowMs: NOW,
    });
    assert.equal(ready.kind, "free_convert");
    assert.equal(ready.headline, FREE_CONVERT_HEADLINE);
    assert.equal(ready.body, FREE_CONVERT_BODY);
    assert.equal(ready.bookLabel, BOOK_ANOTHER_LABEL);
    assert.equal(ready.showBuyHours, true);

    const before = parentPostSessionOffer({
      bookings: [],
      last: null,
      report: null,
      minutes: 0,
      nowMs: NOW,
    });
    assert.equal(before.kind, "free_available");

    const upcoming = parentPostSessionOffer({
      bookings: [
        freeDone,
        booking({
          id: "up",
          status: "confirmed",
          is_free_trial: false,
          scheduled_start: "2026-09-02T17:00:00Z",
          scheduled_end: "2026-09-02T18:00:00Z",
        }),
      ],
      last: freeDone,
      report: { id: "r1" },
      minutes: 0,
      nowMs: NOW,
    });
    assert.equal(upcoming.kind, "none");
  });

  it("paid parents do not see free-conversion language", () => {
    const usedFree = booking({ id: "free" });
    const paid = booking({
      is_free_trial: false,
      id: "paid",
      scheduled_start: "2026-08-26T17:00:00Z",
      scheduled_end: "2026-08-26T18:00:00Z",
    });
    const offer = parentPostSessionOffer({
      bookings: [usedFree, paid],
      last: paid,
      report: { id: "r1" },
      minutes: 60,
      nowMs: NOW,
    });
    assert.equal(offer.kind, "repeat");
    assert.equal(offer.headline, null);
    assert.equal(offer.bookLabel, BOOK_ANOTHER_LABEL);

    const home = read("src/app/dashboard/student/page.tsx");
    const step = read("src/components/dashboard/parent-next-step.tsx");
    assert.match(home, /parentPostSessionOffer/);
    assert.match(step, /FREE_CONVERT_HEADLINE/);
    assert.match(step, /kind === "free_convert"/);
    assert.match(read("src/lib/parent-next-step.mjs"), /Keep the routine going/);
    assert.doesNotMatch(step, /limited time|don't miss|only today|scarcity/i);
  });
});

describe("Post-session value — notifications", () => {
  it("report-ready email points to the Parent report and does not send a recording", () => {
    const withId = T.sessionReportReady({
      studentName: "Jordan",
      whenISO: "2026-08-27T17:00:00.000Z",
      tz: "America/Chicago",
      appUrl: "https://app.example.test",
      bookingId: "bk-1",
    });
    assert.match(withId.subject, /Study Hall report is ready/);
    assert.match(withId.text, /Read report/);
    assert.match(withId.html, /Read report/);
    assert.match(withId.text, /study-halls\/bk-1/);
    assert.doesNotMatch(withId.html + withId.text, /attached|recording is attached|we emailed the recording/i);
    assert.doesNotMatch(withId.html + withId.text, /daily\.co|token=/i);

    const fallback = T.sessionReportReady({
      studentName: "Amara",
      whenISO: "2026-08-24T23:00:00.000Z",
      tz: "America/Chicago",
      appUrl: "https://app.example.test",
    });
    assert.match(fallback.text, /#reports/);
  });
});
