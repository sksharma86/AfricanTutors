import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { parentHomeVisualFixture } from "../src/lib/parent-home-visual-fixture.mjs";
import {
  parentLaterStudyHalls,
  parentStudyHallLists,
  parentUpcomingEmptyCopy,
} from "../src/lib/parent-portal.mjs";
import {
  adminRecordingViewerPath,
  parentRecordingViewerPath,
  recordingViewerErrorCopy,
} from "../src/lib/recording-viewer.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const NOW = Date.parse("2026-09-03T17:50:00Z");

function booking(overrides = {}) {
  return {
    id: "next-1",
    status: "confirmed",
    payment_status: "paid",
    scheduled_start: "2026-09-03T18:00:00Z",
    scheduled_end: "2026-09-03T19:00:00Z",
    tutor_display_name: "James",
    students: { full_name: "Jordan", timezone: "America/Chicago" },
    ...overrides,
  };
}

describe("Parent Home — Next vs additional Upcoming Study Halls", () => {
  it("one next and no additional sessions uses additional empty copy", () => {
    const lists = parentStudyHallLists([booking()], NOW);
    const later = parentLaterStudyHalls(lists.upcoming, lists.next);
    assert.equal(lists.next?.id, "next-1");
    assert.deepEqual(later.map((b) => b.id), []);
    assert.equal(parentUpcomingEmptyCopy(true), "No additional Study Halls scheduled.");
    const upcoming = read("src/components/dashboard/parent-upcoming-list.tsx");
    const board = read("src/components/dashboard/parent-home-board.tsx");
    assert.match(upcoming, /parentUpcomingEmptyCopy\(hasNext\)/);
    assert.match(board, /hasNext=\{Boolean\(next\)\}/);
    assert.doesNotMatch(upcoming, /I have nothing scheduled/);
  });

  it("does not duplicate Next Study Hall in the additional list", () => {
    const laterHall = booking({
      id: "later-1",
      scheduled_start: "2026-09-04T18:00:00Z",
      scheduled_end: "2026-09-04T19:00:00Z",
    });
    const lists = parentStudyHallLists([booking(), laterHall], NOW);
    const later = parentLaterStudyHalls(lists.upcoming, lists.next);
    assert.equal(lists.next?.id, "next-1");
    assert.deepEqual(later.map((b) => b.id), ["later-1"]);
    assert.equal(later.some((b) => b.id === lists.next.id), false);
  });

  it("later sessions still render after Next", () => {
    const halls = [
      booking(),
      booking({
        id: "later-1",
        scheduled_start: "2026-09-04T18:00:00Z",
        scheduled_end: "2026-09-04T19:00:00Z",
      }),
      booking({
        id: "later-2",
        scheduled_start: "2026-09-05T16:00:00Z",
        scheduled_end: "2026-09-05T17:00:00Z",
      }),
    ];
    const lists = parentStudyHallLists(halls, NOW);
    const later = parentLaterStudyHalls(lists.upcoming, lists.next);
    assert.equal(lists.next?.id, "next-1");
    assert.deepEqual(later.map((b) => b.id), ["later-1", "later-2"]);
  });

  it("no-session empty state remains the original nothing-scheduled copy", () => {
    const lists = parentStudyHallLists([], NOW);
    const later = parentLaterStudyHalls(lists.upcoming, lists.next);
    assert.equal(lists.next, null);
    assert.deepEqual(later, []);
    assert.equal(parentUpcomingEmptyCopy(false), "Nothing scheduled yet.");
    const next = read("src/components/dashboard/parent-next-study-hall.tsx");
    const upcoming = read("src/components/dashboard/parent-upcoming-list.tsx");
    assert.match(next, /Nothing scheduled yet/);
    assert.match(upcoming, /Book one →/);
  });

  it("join-window and live confirmed halls stay Next; cancelled halls stay out of upcoming", () => {
    const joinable = booking({
      id: "join-now",
      scheduled_start: "2026-09-03T17:52:00Z",
      scheduled_end: "2026-09-03T18:52:00Z",
    });
    const live = booking({
      id: "live-now",
      scheduled_start: "2026-09-03T17:40:00Z",
      scheduled_end: "2026-09-03T18:40:00Z",
    });
    const cancelled = booking({
      id: "cx",
      status: "cancelled",
      scheduled_start: "2026-09-03T20:00:00Z",
      scheduled_end: "2026-09-03T21:00:00Z",
    });
    const extra = booking({
      id: "later-1",
      scheduled_start: "2026-09-06T18:00:00Z",
      scheduled_end: "2026-09-06T19:00:00Z",
    });
    const lists = parentStudyHallLists([cancelled, extra, live, joinable], NOW);
    const later = parentLaterStudyHalls(lists.upcoming, lists.next);
    assert.ok(lists.next?.id === "join-now" || lists.next?.id === "live-now");
    assert.equal(lists.upcoming.some((b) => b.id === "cx"), false);
    assert.equal(later.some((b) => b.id === "cx"), false);
    assert.equal(later.some((b) => b.id === extra.id), true);
    assert.equal(later.some((b) => b.id === lists.next.id), false);
  });

  it("visual fixtures cover one-next, next+later, and empty homes", () => {
    const now = new Date("2026-08-30T18:00:00-05:00");
    const one = parentHomeVisualFixture(now, { scene: "one-next" });
    const both = parentHomeVisualFixture(now);
    const empty = parentHomeVisualFixture(now, { scene: "empty" });
    assert.ok(one.next);
    assert.equal(one.later.length, 0);
    assert.ok(both.next);
    assert.equal(both.later.length, 2);
    assert.equal(empty.next, null);
    assert.deepEqual(empty.later, []);
  });
});

describe("Recording playback — in-portal viewer, no popups", () => {
  it("Watch recording is a same-tab viewer link and does not use window.open", () => {
    const button = read("src/components/dashboard/watch-recording-button.tsx");
    const player = read("src/components/dashboard/recording-player.tsx");
    const admin = read("src/components/dashboard/management-recording-access.tsx");
    const finance = read("src/components/dashboard/admin-finance-console.tsx");
    assert.match(button, /parentRecordingViewerPath/);
    assert.match(button, /LinkButton/);
    assert.match(button, /Watch recording/);
    assert.doesNotMatch(button, /window\.open|target=_blank|fetch\("\/api\/recording\/access"/);
    assert.match(player, /playsInline/);
    assert.doesNotMatch(player, /window\.open|target=["']_blank["']/);
    assert.match(admin, /adminRecordingViewerPath/);
    assert.doesNotMatch(admin, /window\.open/);
    assert.doesNotMatch(finance, /window\.open/);
    assert.equal(parentRecordingViewerPath("rec-1"), "/dashboard/student/recordings/rec-1");
    assert.equal(adminRecordingViewerPath("rec-1"), "/dashboard/admin/recordings/rec-1");
  });

  it("parent viewer authorizes household-scoped access server-side", () => {
    const page = read("src/app/dashboard/student/recordings/[recordingId]/page.tsx");
    const access = read("src/lib/recording-access.ts");
    const api = read("src/app/api/recording/access/route.ts");
    assert.match(page, /requireRole\(\s*"student"/);
    assert.match(page, /mintAuthorizedRecordingAccess/);
    assert.match(page, /asAdmin:\s*false/);
    assert.match(access, /account_id !== opts\.userId/);
    assert.match(access, /Recording not found/);
    assert.match(api, /asAdmin: false/);
    assert.doesNotMatch(page, /asAdmin:\s*true/);
  });

  it("viewer handles missing and expired recordings with safe copy", () => {
    const page = read("src/app/dashboard/student/recordings/[recordingId]/page.tsx");
    const frame = read("src/components/dashboard/recording-viewer-frame.tsx");
    assert.match(page, /errorStatus=\{result\.ok \? null : result\.status\}/);
    assert.match(frame, /recordingViewerErrorCopy/);
    assert.equal(recordingViewerErrorCopy(404).title, "Recording not found");
    assert.equal(recordingViewerErrorCopy(410).title, "Recording expired");
    assert.match(recordingViewerErrorCopy(410).body, /no longer available/);
    assert.equal(recordingViewerErrorCopy(409).title, "Recording not ready");
    assert.doesNotMatch(recordingViewerErrorCopy(404).body, /another household|permission|forbidden/i);
  });

  it("viewer keeps Reports and Study Hall back navigation", () => {
    const page = read("src/app/dashboard/student/recordings/[recordingId]/page.tsx");
    assert.match(page, /Back to Reports & Recordings/);
    assert.match(page, /Back to Study Hall/);
  });
});

describe("Authenticated portal contrast tokens", () => {
  it("completed Study Hall hero uses light featured tokens, not ink-on-dark", () => {
    const hero = read("src/components/dashboard/parent-session-recap.tsx");
    assert.match(hero, /text-gold-300/);
    assert.match(hero, /text-white/);
    assert.match(hero, /text-white\/86/);
    assert.doesNotMatch(hero, /ParentSurface featured[\s\S]*text-ink-900/);
    assert.doesNotMatch(hero, /ParentSurface featured[\s\S]*text-gold-700/);
  });

  it("Guide report fields use readable entered text and secondary placeholders", () => {
    const form = read("src/components/dashboard/guide-session-report.tsx");
    const header = read("src/components/dashboard/guide-completed-header.tsx");
    const page = read("src/app/dashboard/tutor/study-halls/[bookingId]/report/page.tsx");
    assert.match(form, /FIELD_CLASS/);
    assert.match(form, /bg-\[var\(--gp-card\)\]/);
    assert.match(form, /text-\[var\(--gp-ink\)\]/);
    assert.match(form, /placeholder:text-\[var\(--gp-muted\)\]/);
    assert.match(form, /caret-\[var\(--gp-ink\)\]/);
    assert.match(form, /disabled:text-ink-400/);
    assert.match(header, /text-white/);
    assert.match(header, /text-gold-300/);
    assert.match(page, /GuideSurface/);
    assert.match(page, /variant="page"/);
  });

  it("authenticated form controls default to card background and ink text", () => {
    const css = read("src/app/globals.css");
    assert.match(css, /\.parent-app input:not\(\[type="checkbox"\]\)[\s\S]*background: var\(--pp-card\);[\s\S]*color: var\(--pp-ink\);/);
    assert.match(css, /\.guide-app input:not\(\[type="checkbox"\]\)[\s\S]*background: var\(--gp-card\);[\s\S]*color: var\(--gp-ink\);/);
    assert.match(css, /\.management-app input:not\(\[type="checkbox"\]\)[\s\S]*background: var\(--mg-card\);[\s\S]*color: var\(--mg-ink\);/);
    assert.match(css, /\.parent-app textarea::placeholder[\s\S]*color: var\(--pp-muted\);/);
    assert.match(css, /\.guide-app textarea::placeholder[\s\S]*color: var\(--gp-muted\);/);
    assert.match(css, /caret-color: var\(--pp-ink\);/);
    assert.match(css, /caret-color: var\(--gp-ink\);/);
    assert.doesNotMatch(css, /\.parent-app textarea \{\s*color:\s*#000/);
    assert.doesNotMatch(css, /\.guide-app textarea \{\s*background:\s*#000/);
  });
});
