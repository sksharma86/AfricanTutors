import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Study Hall film capture — isolation", () => {
  it("film routes 404 unless STUDY_HALL_FILM=1 and are blocked in production", () => {
    const guard = read("src/lib/film/guard.ts");
    const page = read("src/app/film/[surface]/page.tsx");
    const layout = read("src/app/film/layout.tsx");
    assert.match(guard, /STUDY_HALL_FILM !== "1"/);
    assert.match(guard, /NODE_ENV === "production"/);
    assert.match(page, /assertFilmCapture/);
    assert.match(layout, /robots: \{ index: false/);
    assert.doesNotMatch(page, /createUser|signInWithPassword|SERVICE_ROLE/);
  });

  it("film booking and session chrome do not call product APIs", () => {
    const book = read("src/components/film/film-booking.tsx");
    const session = read("src/components/film/film-session-chrome.tsx");
    const ops = read("src/components/film/film-ops.tsx");
    assert.match(book, /Does not call booking/);
    assert.doesNotMatch(book, /fetch\(|createSupabase/);
    assert.doesNotMatch(session, /DailyIframe|createFrame|call-parent/);
    assert.doesNotMatch(ops, /approveTutorAction|createSupabase|fetch\(/);
  });

  it("does not alter production booking, Daily, or auth routes", () => {
    const wizard = read("src/components/booking/booking-wizard.tsx");
    const room = read("src/components/session/session-room.tsx");
    assert.match(wizard, /export function BookingWizard/);
    assert.match(room, /createFrame/);
    assert.match(room, /CallParentControl/);
  });

  it("captures scenes in story order rather than object-key order", () => {
    const capture = read("film/capture.mjs");
    assert.match(capture, /const ORDER = \["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15"\]/);
    assert.match(capture, /const ids = only \? \[only\] : ORDER/);
  });
});
