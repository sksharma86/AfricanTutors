import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { guideReportsDue, guideStudyHallLists, unfinishedGuideReport } from "../src/lib/guide-portal.mjs";
import {
  STUDY_HALL_DAILY_THEME,
  counterpartLabel,
  exitCopy,
  opensInLabel,
  presenceLine,
  thresholdCopy,
  thresholdState,
  timeRemaining,
} from "../src/lib/session-threshold.mjs";
import { SESSION_ROOM_SCENES, sessionRoomFixture } from "../src/lib/session-visual-fixture.mjs";
import { JOIN_CLOSE_GRACE_MIN, JOIN_OPEN_LEAD_MIN } from "../src/lib/session-window.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const START = Date.parse("2026-09-23T23:30:00Z");
const END = START + 60 * 60000;
const OPEN = START - JOIN_OPEN_LEAD_MIN * 60000;
const CLOSE = END + JOIN_CLOSE_GRACE_MIN * 60000;
const iso = (ms) => new Date(ms).toISOString();

const info = (join_state) => ({
  join_state,
  join_open_at: iso(OPEN),
  join_close_at: iso(CLOSE),
});

describe("Study Hall threshold — door state mirrors the server window, never widens it", () => {
  it("too_early opens itself exactly at join_open_at (T−5) without a reload", () => {
    assert.equal(thresholdState(info("too_early"), OPEN - 1), "too_early");
    assert.equal(thresholdState(info("too_early"), OPEN), "open");
    assert.equal(thresholdState(info("too_early"), START + 10 * 60000), "open");
  });

  it("open closes itself after join_close_at (end + 15)", () => {
    assert.equal(thresholdState(info("open"), CLOSE), "open");
    assert.equal(thresholdState(info("open"), CLOSE + 1), "too_late");
  });

  it("server verdicts that are not time-based pass through untouched", () => {
    for (const s of ["too_late", "not_joinable", "not_scheduled"]) {
      assert.equal(thresholdState({ ...info(s) }, OPEN + 60000), s);
    }
    assert.equal(thresholdState(null), "not_joinable");
  });

  it("opens-in label counts down and disappears once open", () => {
    assert.equal(opensInLabel(iso(OPEN), OPEN - 17 * 60000), "Opens in 17 minutes");
    assert.equal(opensInLabel(iso(OPEN), OPEN - 30000), "Opens in under a minute");
    assert.equal(opensInLabel(iso(OPEN), OPEN - 90 * 60000), "Opens in 1h 30m");
    assert.equal(opensInLabel(iso(OPEN), OPEN), null);
    assert.equal(opensInLabel(null, OPEN), null);
  });

  it("time remaining reads the booked hour, flags the last five minutes, and notes overrun", () => {
    assert.deepEqual(timeRemaining(iso(START), iso(END), START + 18 * 60000), { label: "42 min left", tone: "normal" });
    assert.deepEqual(timeRemaining(iso(START), iso(END), END - 4 * 60000), { label: "4 min left", tone: "ending" });
    assert.deepEqual(timeRemaining(iso(START), iso(END), END + 1), { label: "Past the scheduled end", tone: "over" });
    assert.deepEqual(timeRemaining(iso(START), iso(END), START - 3 * 60000), { label: "Starts in 3 min", tone: "normal" });
    assert.equal(timeRemaining(null, null, START), null);
  });
});

describe("Study Hall threshold — copy is understandable without support and never tutoring", () => {
  it("doorway copy keeps the T−5 rule and camera policy in plain words", () => {
    const early = thresholdCopy("too_early", "student");
    assert.match(early.headline, /opens soon/i);
    assert.match(early.body, /until the door opens/);
    const open = thresholdCopy("open", "student");
    assert.match(open.body, /Camera is required/);
    assert.match(thresholdCopy("open", "tutor").headline, /door is open/i);
    // The mute / screen-share note is rendered by the room itself next to the join button.
    const room = read("src/components/session/session-room.tsx");
    assert.match(room, /mute your microphone/);
    assert.match(room, /Screen sharing stays available/);
    const late = thresholdCopy("too_late", "tutor");
    assert.match(late.body, /15 minutes after/);
    assert.match(late.body, /report/i);
    assert.match(thresholdCopy("not_joinable", "student", { statusLabel: "Cancelled" }).body, /cancelled/);
  });

  it("presence is real: 'waiting' until the counterpart's role appears in the room, then 'in progress'", () => {
    const parentWait = presenceLine("student", false, "Sarah", ["Jordan"]);
    assert.equal(parentWait.kind, "waiting");
    assert.equal(parentWait.headline, "Waiting for Guide Sarah");
    const parentLive = presenceLine("student", true, "Sarah", ["Jordan"]);
    assert.equal(parentLive.kind, "together");
    assert.equal(parentLive.headline, "Study Hall in progress");
    assert.equal(parentLive.detail, "Guide Sarah is here.");
    const guideWait = presenceLine("tutor", false, "Jordan", ["Jordan"]);
    assert.equal(guideWait.headline, "Waiting for Jordan");
    assert.match(guideWait.detail, /Stay visible on camera/);
    assert.equal(presenceLine("tutor", true, "Jordan", ["Jordan", "Maya"]).detail, "The children are here.");
    assert.equal(counterpartLabel("student", null), "your Guide");
    assert.equal(counterpartLabel("tutor", null), "the child");
  });

  it("no tutoring or generic video-call language in the threshold copy", () => {
    const blob = read("src/lib/session-threshold.mjs") + read("src/components/session/session-room.tsx");
    assert.doesNotMatch(blob, /tutor(ing)? session|lesson|teach|Zoom|meeting room|conference/i);
  });
});

describe("Study Hall exit — 'here's what happened' is one click away", () => {
  it("Guide who leaves after the hour is sent to the report; leaving early offers rejoin while the window is open", () => {
    const done = exitCopy("tutor", "bk1", { ended: true, windowOpen: true });
    assert.equal(done.primary.href, "/dashboard/tutor/study-halls/bk1/report");
    assert.equal(done.primary.label, "Finish report");
    assert.equal(done.canRejoin, false);
    const early = exitCopy("tutor", "bk1", { ended: false, windowOpen: true });
    assert.equal(early.canRejoin, true);
    assert.equal(early.primary, null);
    assert.equal(exitCopy("tutor", "bk1", { ended: false, windowOpen: false }).canRejoin, false);
  });

  it("parent/child who leaves after the hour is pointed at the report + recording page", () => {
    const done = exitCopy("student", "bk1", { ended: true });
    assert.equal(done.primary.href, "/dashboard/student/study-halls/bk1");
    assert.equal(done.primary.label, "See what happened");
    assert.match(done.body, /report/);
    assert.match(done.body, /recording/);
    const early = exitCopy("student", "bk1", { ended: false, windowOpen: true });
    assert.equal(early.canRejoin, true);
    assert.equal(early.primary, null);
    const closed = exitCopy("student", "bk1", { ended: false, windowOpen: false });
    assert.equal(closed.canRejoin, false);
    assert.equal(closed.primary.href, "/dashboard/student/study-halls/bk1");
  });

  it("room wiring: presence from Daily participants, brand theme, rejoin + hand-off links, single stable mount", () => {
    const room = read("src/components/session/session-room.tsx");
    assert.match(room, /participant-joined/);
    assert.match(room, /participant-left/);
    assert.match(room, /user_id === want/);
    assert.match(room, /theme: STUDY_HALL_DAILY_THEME/);
    assert.match(room, /showLeaveButton: true/);
    assert.match(room, /Rejoin Study Hall/);
    assert.match(room, /See what happened/);
    assert.match(room, /Finish report/);
    assert.match(room, /\/dashboard\/student\/study-halls\/\$\{bookingId\}/);
    assert.match(room, /data-kind="presence"/);
    assert.match(room, /StudyHallDoor/);
    assert.equal((room.match(/data-daily-mount="true"/g) ?? []).length, 1);
    assert.equal((room.match(/ref=\{containerRef\}/g) ?? []).length, 1);
    // Recording pill only once actually in the call — no "Recording" badge on a closed door.
    assert.match(room, /\{inCall \? \([\s\S]{0,300}Recording/);
    // Daily capabilities untouched: no chat/whiteboard/breakout invented, no audio forced off.
    assert.doesNotMatch(room, /enable_chat|whiteboard|breakout|setLocalAudio\(/);
  });

  it("brand theme is colors-only and gold-accented", () => {
    assert.deepEqual(Object.keys(STUDY_HALL_DAILY_THEME), ["colors"]);
    assert.equal(STUDY_HALL_DAILY_THEME.colors.accent, "#c9a227");
    assert.equal(STUDY_HALL_DAILY_THEME.colors.accentText, "#1c1915");
    for (const v of Object.values(STUDY_HALL_DAILY_THEME.colors)) assert.match(v, /^#[0-9a-f]{6}$/);
  });

  it("session page is a full-height dark canvas with a role-aware way back", () => {
    const page = read("src/app/dashboard/session/[bookingId]/page.tsx");
    assert.match(page, /min-h-svh/);
    assert.match(page, /Back to Home/);
    assert.match(page, /Back to Management/);
    assert.doesNotMatch(page, /Back to dashboard/);
  });
});

describe("Study Hall exit — Guide completed work is not hidden behind Today / Upcoming", () => {
  const tzs = ["UTC", "America/Chicago", "Asia/Kolkata", "Pacific/Auckland"];
  const now = Date.parse("2026-09-24T02:00:00Z"); // 9 PM Chicago on the 23rd, 7:30 AM Kolkata on the 24th
  const bookings = [
    { id: "done-1", status: "completed", scheduled_start: iso(now - 3 * 3600000), scheduled_end: iso(now - 2 * 3600000) },
    { id: "ended-2", status: "confirmed", scheduled_start: iso(now - 80 * 60000), scheduled_end: iso(now - 20 * 60000) },
    { id: "grace-3", status: "confirmed", scheduled_start: iso(now - 65 * 60000), scheduled_end: iso(now - 5 * 60000) },
    { id: "later-4", status: "confirmed", scheduled_start: iso(now + 3 * 3600000), scheduled_end: iso(now + 4 * 3600000) },
    { id: "cancel-5", status: "cancelled", scheduled_start: iso(now - 5 * 3600000), scheduled_end: iso(now - 4 * 3600000) },
  ];

  it("Completed shows finished sessions identically in every Guide timezone", () => {
    for (const tz of tzs) {
      const lists = guideStudyHallLists(bookings, now, tz);
      assert.deepEqual(
        lists.completed.map((b) => b.id).sort(),
        ["done-1", "ended-2"],
        `completed in ${tz}`,
      );
      assert.ok(!lists.completed.some((b) => b.id === "cancel-5"), `cancelled never counts as completed (${tz})`);
      assert.ok(lists.upcoming.some((b) => b.id === "grace-3"), `still inside end+15 grace stays joinable (${tz})`);
    }
  });

  it("reports due are computed from UTC instants (ms), most recent first, and skip cancelled/reported", () => {
    for (const tz of tzs) {
      void tz;
      const due = guideReportsDue(bookings, ["done-1"], now);
      assert.deepEqual(
        due.map((b) => b.id),
        ["grace-3", "ended-2"],
      );
      assert.equal(unfinishedGuideReport(bookings, ["done-1"], now).id, "grace-3");
    }
    assert.deepEqual(guideReportsDue(bookings, ["done-1", "ended-2", "grace-3"], now), []);
  });

  it("Guide list surfaces reports due on every tab and links Completed rows onward to earnings", () => {
    const halls = read("src/components/dashboard/guide-study-halls.tsx");
    assert.match(halls, /guideReportsDue/);
    assert.match(halls, /data-kind="reports-due"/);
    assert.match(halls, /view !== "completed" && due\.length > 0/);
    assert.match(halls, /Finish report/);
    assert.match(halls, /See completed/);
    assert.match(halls, /\/dashboard\/tutor\/earnings/);
    assert.match(halls, /View earnings/);
    assert.match(halls, /No completed Study Halls yet/);
    assert.doesNotMatch(halls, /None yet\./);
    // Still the same list logic; no booking/pay mutation crept in.
    assert.match(halls, /guideStudyHallLists/);
    assert.doesNotMatch(halls, /rpc\(|stripe|comp_rate_cents_per_hour/);
  });

  it("parent recap explains the wait for report and recording instead of a bare 'No report yet.'", () => {
    const recap = read("src/components/dashboard/parent-session-recap.tsx");
    assert.match(recap, /Guide report/);
    assert.match(recap, /No report yet\./);
    assert.match(recap, /right after the Study Hall/);
    assert.match(recap, /Recording processing/);
    assert.match(recap, /Available for 60 days after the Study Hall/);
  });
});

describe("Study Hall room — fixtures and scope", () => {
  it("visual review stays gated and renders every scene from fixture data", () => {
    const review = read("src/app/dashboard/session/visual-review/page.tsx");
    assert.match(review, /SESSION_VISUAL_REVIEW/);
    assert.match(review, /notFound/);
    assert.match(review, /sessionRoomFixture/);
    assert.match(review, /CameraRequiredBanner/);
    for (const scene of SESSION_ROOM_SCENES) {
      const fx = sessionRoomFixture(scene, START);
      assert.ok(fx, scene);
      assert.equal(fx.info.authorized, true);
      assert.equal(fx.info.room_name, "fixture-room");
      assert.ok(["student", "tutor"].includes(fx.info.role));
    }
    assert.equal(sessionRoomFixture("nope"), null);
    assert.equal(sessionRoomFixture("door-early", START).info.join_state, "too_early");
    assert.equal(sessionRoomFixture("ended-guide", START).info.join_state, "too_late");
    assert.equal(sessionRoomFixture("room-live", START).preview, "live");
    assert.equal(sessionRoomFixture("left-early-guide", START).preview, "left-early");
  });

  it("threshold helpers are display-only; join authority, Daily room/token props, and payments are untouched", () => {
    const threshold = read("src/lib/session-threshold.mjs");
    assert.doesNotMatch(threshold, /fetch\(|rpc\(|supabase|stripe|twilio|daily\.co|createMeetingToken/i);
    for (const p of [
      "src/lib/session-service.ts",
      "src/lib/daily/room-props.mjs",
      "src/lib/daily/token-props.mjs",
      "src/lib/daily/access-window.mjs",
      "src/app/api/session/[bookingId]/join/route.ts",
    ]) {
      assert.doesNotMatch(read(p), /session-threshold/, `${p} must not depend on display helpers`);
    }
    // Live route never passes fixture-only props.
    const page = read("src/app/dashboard/session/[bookingId]/page.tsx");
    assert.doesNotMatch(page, /preview=|nowMs=/);
  });
});
