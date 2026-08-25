import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Study Hall PR10D — Guide workspace + applicant UX + admin cleanup", () => {
  it("removes Subject catalog and Guide subject approvals from active admin UX", () => {
    const consoleSrc = read("src/components/dashboard/admin-console.tsx");
    assert.doesNotMatch(consoleSrc, /Subject catalog/);
    assert.doesNotMatch(consoleSrc, /Guide subject approvals/);
    assert.doesNotMatch(consoleSrc, /may teach/);
    assert.doesNotMatch(consoleSrc, /Approve Guide for subject/);
    assert.doesNotMatch(consoleSrc, /from\("subjects"\)/);
    assert.doesNotMatch(consoleSrc, /from\("tutor_subjects"\)/);
    assert.doesNotMatch(consoleSrc, /Add subject/);

    const adminPage = read("src/app/dashboard/admin/page.tsx");
    assert.doesNotMatch(adminPage, /label:\s*"Subjects"/);
    assert.doesNotMatch(adminPage, /from\("subjects"\)/);
    assert.doesNotMatch(adminPage, /from\("tutor_subjects"\)/);
    assert.doesNotMatch(adminPage, /Applied to teach/);
    assert.match(adminPage, /Approve as Guide|Guide application/);
  });

  it("admin Guide detail no longer shows Approved subjects / may teach UI", () => {
    const detail = read("src/app/dashboard/admin/tutors/[tutorId]/page.tsx");
    assert.doesNotMatch(detail, /Approved subjects/);
    assert.doesNotMatch(detail, /tutor_subjects/);
    assert.doesNotMatch(detail, /may teach/);
    assert.match(detail, /Compensation|TutorRateForm/);
    assert.match(detail, /not assigned by academic subject/i);
  });

  it("admin sessions table uses Study Hall ops display (not subject matching)", () => {
    const consoleSrc = read("src/components/dashboard/admin-console.tsx");
    assert.match(consoleSrc, />Study Hall</);
    assert.match(consoleSrc, /Child/);
    assert.doesNotMatch(consoleSrc, />Subject</);
    // Reassign for scheduled Study Halls even when subject_id is null
    assert.match(consoleSrc, /b\.scheduled_start \?/);
    assert.doesNotMatch(consoleSrc, /b\.subject_id && b\.scheduled_start/);
    assert.match(consoleSrc, /not subject expertise|availability\/ops-based/i);
  });

  it("Study Hall booking/matching remains availability-only (null subject)", () => {
    const wizard = read("src/components/booking/booking-wizard.tsx");
    assert.match(wizard, /p_subject_id:\s*null/);
    const m22 = read("supabase/migrations/0022_studyhall_pr4_supervision_booking.sql");
    assert.match(m22, /p_subject_id IS NULL/);
    assert.match(m22, /any approved Guide/);
  });

  it("pending Guide applicant gets dedicated applicant view (not parent portal)", () => {
    const applicantPage = read("src/app/dashboard/applicant/page.tsx");
    assert.match(applicantPage, /GuideApplicantPanel|Application status/);
    assert.match(applicantPage, /getGuideApplicantInfo/);
    assert.doesNotMatch(applicantPage, /BalanceCards|Buy hours|Book a Study Hall|free.?session offer/i);

    const panel = read("src/components/dashboard/guide-applicant-panel.tsx");
    assert.match(panel, /Application received|under review/i);
    assert.match(panel, /not guaranteed/i);
    assert.doesNotMatch(panel, /Buy hours|Prepaid|Book a Study Hall|free session/i);

    const helper = read("src/lib/guide-applicant.ts");
    assert.match(helper, /pending|suspended/);
    assert.match(helper, /profiles\.role = 'student'/);
  });

  it("parent routes redirect pending applicants away from customer features", () => {
    for (const path of [
      "src/app/dashboard/student/page.tsx",
      "src/app/dashboard/student/book/page.tsx",
      "src/app/dashboard/student/packages/page.tsx",
    ]) {
      const src = read(path);
      assert.match(src, /getGuideApplicantInfo/);
      assert.match(src, /redirect\("\/dashboard\/applicant"\)/);
    }
    const index = read("src/app/dashboard/page.tsx");
    assert.match(index, /\/dashboard\/applicant/);
  });

  it("signup sends Guide applicants to applicant experience (not /dashboard/tutor)", () => {
    const signup = read("src/components/auth/signup-form.tsx");
    assert.match(signup, /\/dashboard\/applicant/);
    assert.doesNotMatch(signup, /role === "tutor" \? "\/dashboard\/tutor"/);
  });

  it("navbar hides parent Book CTA for Guide applicants", () => {
    const nav = read("src/components/layout/navbar.tsx");
    assert.match(nav, /getGuideApplicantInfo/);
    assert.match(nav, /showParentBookCta/);
    assert.match(nav, /\/dashboard\/applicant/);
  });

  it("approved Guide workspace stays distinct from parent financial/booking UI", () => {
    const page = read("src/app/dashboard/tutor/page.tsx");
    assert.match(page, /Guide workspace/);
    assert.match(page, /Today'?s Study Halls|Upcoming assignments/);
    assert.match(page, /Availability|Outstanding|Earned/);
    assert.match(page, /Call Parent/);
    assert.doesNotMatch(page, /Buy hours|Prepaid Hours|Book a Study Hall|account credit|free-session offer/i);
    assert.doesNotMatch(page, /Parent escalation tools are coming/);
    assert.match(page, /Ready to join 5 minutes before start/);
  });

  it("Guide cancellation / unavailability action remains clear", () => {
    const cancel = read("src/components/dashboard/tutor-cancel-request.tsx");
    assert.match(cancel, /Unavailable for this session|Cancellation requested/);
    assert.match(cancel, /\/api\/tutor\/cancellation-request/);
  });

  it("legacy route aliases exist without renaming internal canonical paths", () => {
    assert.match(read("src/app/guides/apply/page.tsx"), /redirect\("\/apply-to-tutor"\)/);
    assert.match(read("src/app/dashboard/guide/page.tsx"), /redirect\("\/dashboard\/tutor"\)/);
    assert.match(read("src/app/(marketing)/subjects/page.tsx"), /redirect\("\/how-it-works"\)/);
  });

  it("preserves PR8 successful-reassignment-invisible-to-parent policy language", () => {
    const admin = read("src/app/dashboard/admin/page.tsx");
    assert.match(admin, /Successful reassignment stays invisible to the parent/);
    const pr8 = read("tests/studyhall-pr8-notifications.test.mjs");
    assert.match(pr8, /reassign|invisible|parent/i);
  });

  it("preserves Call Parent without exposing parent phone on Guide UI", () => {
    const control = read("src/components/session/call-parent-control.tsx");
    assert.match(control, /Call Parent|request_parent_escalation|call-parent/i);
    assert.doesNotMatch(control, /parent_phone|phone_number|tel:/i);
    const guidePage = read("src/app/dashboard/tutor/page.tsx");
    assert.doesNotMatch(guidePage, /parent_phone|phone number/i);
  });

  it("preserves Guide rate / earnings / external payout surfaces", () => {
    const detail = read("src/app/dashboard/admin/tutors/[tutorId]/page.tsx");
    assert.match(detail, /TutorRateForm/);
    const finance = read("src/components/dashboard/admin-finance-console.tsx");
    assert.match(finance, /paid|outstanding|earned/i);
    const guide = read("src/app/dashboard/tutor/page.tsx");
    assert.match(guide, /Outstanding|Paid|Earned|comp_rate_cents_per_hour/);
  });

  it("PR10C parent portal markers remain intact", () => {
    const parent = read("src/app/dashboard/student/page.tsx");
    assert.match(parent, /Prepaid Hours|Buy hours|Book a Study Hall|BalanceCards/);
    const pr10c = read("tests/studyhall-pr10c-parent-portal.test.mjs");
    assert.match(pr10c, /Prepaid Hours|Buy hours/);
  });
});
