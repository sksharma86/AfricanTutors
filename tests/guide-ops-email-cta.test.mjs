import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  absoluteAppHref,
  guideAttendanceRequest,
  guideOpenCoverageOffer,
} from "../src/lib/email/templates.mjs";
import { t30DeadlineIso } from "../src/lib/guide-attendance.mjs";

const START = "2026-08-30T23:00:00.000Z";
const END = "2026-08-31T00:00:00.000Z";
const APP = "https://studyhall.example";
const BID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const T30_HREF = `${APP}/dashboard/tutor`;
const EMERGENCY_HREF = `${APP}/dashboard/tutor/open-coverage/${BID}`;

function anchors(html) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((m) => ({
    tag: m[0],
    attrs: m[1],
    text: m[2].replace(/<[^>]+>/g, "").trim(),
    href: (m[1].match(/href="([^"]*)"/) || [])[1] || "",
  }));
}

describe("Ops email CTAs are real absolute HTML anchors", () => {
  it("builds only http(s) absolute hrefs", () => {
    assert.equal(absoluteAppHref(APP, "/dashboard/tutor"), T30_HREF);
    assert.equal(absoluteAppHref(`${APP}/`, "/dashboard/tutor"), T30_HREF);
    assert.equal(absoluteAppHref("", "/dashboard/tutor"), "");
    assert.equal(absoluteAppHref("/app", "/dashboard/tutor"), "");
    assert.equal(absoluteAppHref("studyhall.example", "/dashboard/tutor"), "");
  });

  it("T-30 CONFIRM I WILL BE THERE is an <a> with an absolute Guide portal href", () => {
    const mail = guideAttendanceRequest({
      whenISO: START,
      deadlineISO: t30DeadlineIso(START),
      tz: "America/Chicago",
      durationMinutes: 60,
      appUrl: APP,
    });
    const links = anchors(mail.html);
    assert.ok(links.length >= 2, "primary button plus fallback text link");
    assert.ok(links.every((a) => a.href === T30_HREF));
    assert.ok(links.some((a) => a.text === "CONFIRM I WILL BE THERE"));
    assert.ok(links.some((a) => a.text === T30_HREF));
    assert.match(mail.html, /<a href="https:\/\/studyhall\.example\/dashboard\/tutor"/);
    assert.doesNotMatch(mail.html, /href="\/dashboard/);
    assert.doesNotMatch(mail.html, /onclick=|javascript:/i);
  });

  it("emergency ACCEPT THIS STUDY HALL is an <a> with an absolute open-coverage href", () => {
    const mail = guideOpenCoverageOffer({
      whenISO: START,
      endISO: END,
      tz: "America/Chicago",
      durationMinutes: 60,
      appUrl: APP,
      bookingId: BID,
    });
    const links = anchors(mail.html);
    assert.ok(links.length >= 2);
    assert.ok(links.every((a) => a.href === EMERGENCY_HREF));
    assert.ok(links.some((a) => a.text === "ACCEPT THIS STUDY HALL"));
    assert.ok(links.some((a) => a.text === EMERGENCY_HREF));
    assert.ok(mail.html.includes(`<a href="${EMERGENCY_HREF}"`));
    assert.doesNotMatch(mail.html, /href="\/dashboard/);
    assert.doesNotMatch(mail.html, /onclick=|javascript:/i);
  });

  it("does not emit a relative CTA when NEXT_PUBLIC_APP_URL / appUrl is missing", () => {
    const t30 = guideAttendanceRequest({
      whenISO: START,
      tz: "America/Chicago",
      durationMinutes: 60,
      appUrl: "",
    });
    const emergency = guideOpenCoverageOffer({
      whenISO: START,
      bookingId: BID,
      appUrl: "",
    });
    assert.equal(anchors(t30.html).length, 0);
    assert.equal(anchors(emergency.html).length, 0);
    assert.doesNotMatch(t30.html, /href="/);
    assert.doesNotMatch(emergency.html, /href="/);
  });
});
