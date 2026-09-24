import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { GUIDE_HANDBOOK_HREF, GUIDE_HANDBOOK_LABEL } from "../src/lib/guide-handbook.mjs";
import { normalizeGuidePhone } from "../src/lib/guide-phone.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Guide application funnel", () => {
  it("normalizes a country-aware WhatsApp number to E.164", () => {
    assert.equal(normalizeGuidePhone("+254712345678", "+1"), "+254712345678");
    assert.equal(normalizeGuidePhone("0712345678", "+254"), "+254712345678");
    assert.equal(normalizeGuidePhone("00 44 7700 900123", null), "+447700900123");
    assert.equal(normalizeGuidePhone("555", "+1"), null);
    assert.equal(normalizeGuidePhone("", "+254"), null);
  });

  it("apply form requires name, email, and phone and does not approve on submit", () => {
    const form = read("src/components/auth/guide-application-form.tsx");
    const api = read("src/app/api/auth/signup/route.ts");
    const page = read("src/app/(marketing)/apply-to-tutor/page.tsx");
    assert.match(page, /GuideApplicationForm/);
    assert.match(form, /Full name/);
    assert.match(form, /name="email"/);
    assert.match(form, /WhatsApp number/);
    assert.match(form, /name="phone"/);
    assert.match(form, /Application received/);
    assert.match(form, /GuideHandbookDownload/);
    assert.doesNotMatch(form, /quiz|availability|set your hours/i);
    assert.match(api, /requestedRole === "tutor"/);
    assert.match(api, /normalizeGuidePhone/);
    assert.match(api, /phone_e164: phone/);
    assert.match(api, /status: "pending"|\/dashboard\/applicant/);
    assert.doesNotMatch(api, /approve_tutor|status:\s*"approved"/);
  });

  it("success copy offers the handbook and keeps hours closed", () => {
    const handbook = read("public/downloads/study-hall-guide-handbook.md");
    const panel = read("src/components/dashboard/guide-applicant-panel.tsx");
    assert.match(handbook, /You are not tutoring/);
    assert.match(handbook, /cannot set hours until a manager approves/);
    assert.equal(GUIDE_HANDBOOK_LABEL, "Download the Guide handbook");
    assert.match(read("src/components/auth/guide-handbook-download.tsx"), /GUIDE_HANDBOOK_HREF/);
    assert.match(read("src/lib/guide-handbook.mjs"), /study-hall-guide-handbook\.md/);
    assert.match(panel, /GuideHandbookDownload/);
    assert.match(panel, /does not open a quiz or a schedule/);
    assert.doesNotMatch(panel, /href=.*availability|Set your hours|Take the quiz/i);
  });

  it("admin pending list shows contact and the existing Approve action", () => {
    const page = read("src/app/dashboard/admin/guides/page.tsx");
    const directory = read("src/components/dashboard/admin-guides-directory.tsx");
    assert.match(page, /phone_e164/);
    assert.match(page, /lookupEmail/);
    assert.match(directory, /Approve as Guide/);
    assert.match(directory, /g\.email/);
    assert.match(directory, /g\.phone/);
    assert.match(directory, /No WhatsApp number/);
    assert.match(read("src/app/dashboard/admin/actions.ts"), /approve_tutor/);
  });

  it("availability writes require an approved Guide", () => {
    const sql = read("supabase/migrations/0049_guide_application_phone.sql");
    assert.match(sql, /status\)\s*\n\s*values \(new\.id, 'pending'\)/);
    assert.match(sql, /phone_e164/);
    assert.match(sql, /is_approved_guide/);
    assert.match(sql, /tutor_availability_write/);
    assert.match(sql, /tutor_exceptions_write/);
    assert.match(read("src/app/dashboard/tutor/availability/page.tsx"), /requireRole\("tutor"/);
    assert.match(read("src/lib/guide-host.mjs"), /guides\.studyhallathome\.com/);
  });
});
