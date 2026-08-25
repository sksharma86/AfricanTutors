import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  durationOptionPriceLabel,
  isFullyPrepaidQuote,
  prepaidCoversDuration,
  remainingBalanceMinutes,
} from "../src/lib/booking-prepaid-display.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("PR10E — email confirmation + role routing (source)", () => {
  const callback = read("src/app/auth/callback/route.ts");
  const confirmed = read("src/app/auth/confirmed/page.tsx");
  const redirectLib = read("src/lib/auth-redirect.ts");
  const signup = read("src/components/auth/signup-form.tsx");
  const login = read("src/components/auth/login-form.tsx");
  const resend = read("src/components/auth/resend-confirmation-form.tsx");
  const forgot = read("src/components/auth/forgot-password-form.tsx");
  const dashIndex = read("src/app/dashboard/page.tsx");

  it("callback exchanges code/OTP and never dumps to homepage on error", () => {
    assert.match(callback, /exchangeCodeForSession/);
    assert.match(callback, /verifyOtp/);
    assert.match(callback, /\/auth\/confirmed\?status=error/);
    assert.match(callback, /resolvePostAuthHome/);
    assert.doesNotMatch(callback, /redirect\(new URL\("\/"/);
    assert.doesNotMatch(callback, /origin \+ "\/"/);
  });

  it("invalid/expired confirmation shows recovery with resend + sign in", () => {
    assert.match(confirmed, /This confirmation link is no longer valid/);
    assert.match(confirmed, /This confirmation link has expired/);
    assert.match(confirmed, /ResendConfirmationForm/);
    assert.match(confirmed, /Email confirmed/);
    assert.match(confirmed, /Sign in/);
  });

  it("sanitizeNextPath blocks open redirects", () => {
    assert.match(redirectLib, /sanitizeNextPath/);
    assert.match(redirectLib, /startsWith\("\/\/"\)/);
    assert.match(redirectLib, /includes\(":\/\/"\)/);
  });

  it("post-auth home routes pending applicants separately from parents", () => {
    assert.match(redirectLib, /\/dashboard\/applicant/);
    assert.match(redirectLib, /status === "pending"/);
    assert.match(dashIndex, /getGuideApplicantInfo/);
    assert.match(dashIndex, /redirect\("\/dashboard\/applicant"\)/);
  });

  it("signup sets emailRedirectTo via auth callback", () => {
    assert.match(signup, /emailRedirectTo:\s*authCallbackUrl/);
    assert.match(signup, /\/dashboard\/applicant/);
    assert.match(resend, /emailRedirectTo:\s*authCallbackUrl/);
    assert.match(forgot, /\/auth\/callback\?next=/);
  });

  it("login sanitizes redirectTo and surfaces unconfirmed recovery", () => {
    assert.match(login, /sanitizeNextPath/);
    assert.match(login, /needsConfirm/);
    assert.match(login, /ResendConfirmationForm/);
    assert.doesNotMatch(login, /error\.message\}/);
  });
});

describe("PR10E — prepaid display + booking copy", () => {
  const wizard = read("src/components/booking/booking-wizard.tsx");
  const packages = read("src/components/booking/package-store.tsx");
  const dash = read("src/app/dashboard/student/page.tsx");
  const balance = read("src/components/dashboard/balance-cards.tsx");
  const actions = read("src/components/dashboard/customer-booking-actions.tsx");
  const room = read("src/components/session/session-room.tsx");
  const mig = read("supabase/migrations/0027_studyhall_pr10e_launch_harden.sql");

  it("prepaid covers duration is all-or-nothing", () => {
    assert.equal(prepaidCoversDuration(60, 60), true);
    assert.equal(prepaidCoversDuration(59, 60), false);
    assert.equal(prepaidCoversDuration(120, 180), false);
    assert.equal(prepaidCoversDuration(180, 180), true);
    assert.equal(remainingBalanceMinutes(120, 60), 60);
    assert.equal(isFullyPrepaidQuote({ package_minutes_used: 60, stripe_cents_due: 0 }), true);
    assert.equal(isFullyPrepaidQuote({ package_minutes_used: 0, stripe_cents_due: 1200 }), false);
    assert.match(durationOptionPriceLabel(30, 60, "$12"), /\$12/);
    assert.match(durationOptionPriceLabel(90, 60, "$12"), /Uses/);
  });

  it("wizard explains insufficient prepaid without inventing partial hours", () => {
    assert.match(wizard, /prepaidCoversDuration/);
    assert.match(wizard, /doesn.t cover this full/);
    assert.match(wizard, /only when they fully cover/);
    assert.match(wizard, /Confirm with prepaid hours/);
    assert.match(wizard, /No payment required\. Your card will not be charged/);
    assert.match(wizard, /submittingRef/);
  });

  it("first-run favors free session over package purchase pressure", () => {
    assert.match(dash, /preferFreeSession=\{freeTrialAvailable\}/);
    assert.match(balance, /preferFreeSession/);
    assert.match(balance, /Prepaid packages are optional later/);
    assert.match(dash, /Book free session/);
    assert.match(dash, /After your free session/);
  });

  it("package empty state and double-submit guard exist", () => {
    assert.match(packages, /packages\.length === 0/);
    assert.match(packages, /Prepaid packages aren.t listed/);
    assert.match(packages, /submittingRef/);
  });

  it("session room title is Study Hall (not subject)", () => {
    assert.match(room, /const title = "Study Hall"/);
    assert.doesNotMatch(room, /info\.subject\?\.trim\(\) \? info\.subject/);
  });

  it("dispute categories avoid tutoring 'instruction' wording", () => {
    assert.doesNotMatch(actions, /instruction wasn't helpful/i);
    assert.match(actions, /properly supervised|didn.t feel valuable/);
    assert.match(actions, /submittingRef/);
  });

  it("migration 0027 adds student overlap + pending checkout credit restore", () => {
    assert.match(mig, /bookings_no_student_overlap/);
    assert.match(mig, /customer_cancel_booking/);
    assert.match(mig, /reserved credit restored/);
    assert.match(mig, /requires_payment/);
  });
});

describe("PR10E — role isolation + notifications + room access (source)", () => {
  const applicant = read("src/components/dashboard/guide-applicant-panel.tsx");
  const cancelApi = read("src/app/api/tutor/cancellation-request/route.ts");
  const notify = read("src/lib/notify.ts");
  const callParent = read("src/components/session/call-parent-control.tsx");
  const phone = read("src/components/dashboard/parent-phone-form.tsx");
  const studentBook = read("src/app/dashboard/student/book/page.tsx");
  const studentPkgs = read("src/app/dashboard/student/packages/page.tsx");
  const guideCancel = read("src/components/dashboard/tutor-cancel-request.tsx");
  const report = read("src/components/dashboard/guide-session-report.tsx");
  const windowLib = read("src/lib/session-window.mjs");

  it("pending applicants are blocked from parent book/packages routes", () => {
    assert.match(studentBook, /getGuideApplicantInfo/);
    assert.match(studentBook, /redirect\("\/dashboard\/applicant"\)/);
    assert.match(studentPkgs, /redirect\("\/dashboard\/applicant"\)/);
    assert.match(applicant, /Parent booking, prepaid hours/);
  });

  it("successful Guide reassignment stays silent to parent", () => {
    assert.match(cancelApi, /try_auto_reassign/);
    assert.match(cancelApi, /notifyReassignment/);
    assert.match(notify, /notifyReassignment/);
  });

  it("Call Parent never surfaces phone to Guide UI", () => {
    assert.match(callParent, /Never displays a phone number/);
    assert.doesNotMatch(callParent, /phone_e164|parentPhone|\+1/);
    assert.match(phone, /never shared with Guides/i);
    assert.match(phone, /don.t need to keep this portal open/i);
    assert.match(callParent, /submittingRef/);
  });

  it("Guide cancel + report submissions guard double submit", () => {
    assert.match(guideCancel, /submittingRef/);
    assert.match(report, /submittingRef/);
    assert.match(report, /not a grade/i);
  });

  it("T-5 room access helpers remain authoritative", () => {
    assert.match(windowLib, /JOIN_OPEN_LEAD_MIN = 5/);
    assert.match(windowLib, /customerJoinState/);
    assert.match(windowLib, /opens_at/);
  });
});

describe("PR10E — notify idempotency keys present", () => {
  const notify = read("src/lib/notify.ts");
  const cancelApi = read("src/app/api/tutor/cancellation-request/route.ts");
  const keys = [
    "booking-confirmed:",
    "package-purchased:",
    "reminder-",
    "session-report-ready:",
    "guide-report-required:",
    "guide-report-overdue:",
    "tutor-removed:",
    "tutor-new-session:",
  ];
  for (const key of keys) {
    it(`has idempotency key fragment ${key}`, () => {
      assert.match(notify, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    });
  }
  it("coverage failure uses admin alert dedupe key", () => {
    assert.match(cancelApi, /guide-coverage-failed:/);
  });
});
