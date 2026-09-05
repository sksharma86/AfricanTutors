import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const ALARMING = /We cannot control|Guides are human|Danger|Warning|Protect your child|misconduct is expected/i;

describe("Parent communication safety + homepage preview", () => {
  it("Account carries the on-platform communication notice", () => {
    const account = read("src/app/dashboard/student/account/page.tsx");
    const notice = read("src/components/dashboard/parent-communication-safety.tsx");
    assert.match(account, /ParentCommunicationSafety/);
    assert.match(notice, /Keeping communication on Study Hall/);
    assert.match(notice, /all communication with your Guide should stay within/);
    assert.match(notice, /Guides are not permitted to request personal contact information/);
    assert.match(notice, /please let us know right away/);
    assert.match(notice, /href="\/contact"/);
    assert.match(notice, /Report a concern/);
    assert.doesNotMatch(notice, ALARMING);
    assert.doesNotMatch(account, ALARMING);
  });

  it("does not invent acknowledgement state or a new reporting workflow", () => {
    const notice = read("src/components/dashboard/parent-communication-safety.tsx");
    const account = read("src/app/dashboard/student/account/page.tsx");
    assert.doesNotMatch(notice + account, /localStorage|acknowledged|safety_ack|modal/i);
    assert.doesNotMatch(notice, /\/api\/admin\/|create\(|\.insert\(/);
  });

  it("homepage preview uses the premium Parent Portal, not the obsolete gray dashboard", () => {
    const portal = read("src/components/marketing/product-showcase.tsx");
    assert.match(portal, /parent-app/);
    assert.match(portal, /#f6f1e8|#161c18/);
    assert.match(portal, /Tonight’s Study Hall|Tonight's Study Hall/);
    assert.match(portal, /Join Study Hall/);
    assert.match(portal, /PARENT_PORTAL_NAV/);
    assert.match(portal, /WeekRhythm/);
    assert.doesNotMatch(portal, /Buy hours/);
    assert.doesNotMatch(portal, /bg-\[#f4f5f7\]/);
    assert.doesNotMatch(portal, /bg-ink-900 px-6/);
    assert.doesNotMatch(portal, /Hi Priya/);
    assert.doesNotMatch(portal, /parentHomeVisualFixture/);
    assert.doesNotMatch(portal, /quota|renewal|GPA|streak|subscription/i);
  });

  it("does not rewrite Parent Home, Guide, or Management business logic", () => {
    const notice = read("src/components/dashboard/parent-communication-safety.tsx");
    assert.doesNotMatch(notice, /book_session|authorize_session_join|admin_mark_earning/);
    assert.doesNotMatch(read("src/app/dashboard/student/page.tsx"), /ParentCommunicationSafety/);
    assert.doesNotMatch(read("src/components/dashboard/guide-shell.tsx"), /ParentCommunicationSafety|Keeping communication/);
    assert.doesNotMatch(read("src/components/dashboard/management-shell.tsx"), /ParentCommunicationSafety|Keeping communication/);
  });
});
