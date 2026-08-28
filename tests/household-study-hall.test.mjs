import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";

import {
  bookingChildCount,
  bookingChildNames,
  childCountLabel,
  formatChildNames,
  missingHouseholdColumns,
  missingStudentIdsRpc,
  possessiveStudyHall,
  uniqueStudentIds,
  wouldExceedChildLimit,
  MAX_CHILDREN_PER_STUDY_HALL,
} from "../src/lib/household-children.mjs";
import {
  FAMILY_VALUE_BODY,
  FAMILY_VALUE_EYEBROW,
  FAMILY_VALUE_RATE,
} from "../src/lib/household-pricing-copy.mjs";
import * as T from "../src/lib/email/templates.mjs";
import { parentCancellationSms, parentSessionReminderSms } from "../src/lib/notifications/sms-copy.mjs";
import { PACKAGE_14H_MINUTES, PACKAGE_14H_PRICE_CENTS, PACKAGE_28H_MINUTES, PACKAGE_28H_PRICE_CENTS } from "../src/lib/packages.mjs";
import { adminClient, cleanupAll, createUser, hasSupabaseEnv, signIn } from "./helpers.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const ISO = "2026-08-28T18:30:00Z";
const APP = "https://example.test";

describe("Household Study Hall — name helpers", () => {
  it("formats 1/2/3 children with natural language", () => {
    assert.equal(formatChildNames(["Jordan"]), "Jordan");
    assert.equal(formatChildNames(["Jordan", "Maya"]), "Jordan & Maya");
    assert.equal(formatChildNames(["Jordan", "Maya", "Noah"]), "Jordan, Maya & Noah");
    assert.equal(formatChildNames(["Jordan Lee", "Maya Ann"]), "Jordan & Maya");
  });

  it("builds possessive Study Hall labels", () => {
    assert.equal(possessiveStudyHall(["Jordan"]), "Jordan's Study Hall");
    assert.equal(possessiveStudyHall(["Jordan", "Maya"]), "Jordan and Maya's Study Hall");
    assert.equal(possessiveStudyHall(["Jordan", "Maya", "Noah"]), "Jordan, Maya, and Noah's Study Hall");
  });

  it("caps selection at three and does not silently drop another child", () => {
    assert.equal(MAX_CHILDREN_PER_STUDY_HALL, 3);
    assert.equal(wouldExceedChildLimit(["a", "b", "c"], "d"), true);
    assert.equal(wouldExceedChildLimit(["a", "b"], "c"), false);
    assert.equal(wouldExceedChildLimit(["a", "b", "c"], "a"), false);
    assert.deepEqual(uniqueStudentIds(["a", "a", "b"]), ["a", "b"]);
  });

  it("reads child names from booking fields with one-child fallback", () => {
    assert.equal(bookingChildNames({ student_first_names: ["Jordan", "Maya"] }), "Jordan & Maya");
    assert.equal(bookingChildNames({ student_first_name: "Jordan" }), "Jordan");
    assert.equal(bookingChildNames({ students: { full_name: "Jordan Lee" } }), "Jordan");
    assert.equal(bookingChildCount({ student_first_names: ["A", "B", "C"] }), 3);
    assert.equal(bookingChildCount({ child_count: 1 }), 1);
    assert.equal(childCountLabel(1), "1 child");
    assert.equal(childCountLabel(3), "3 children");
  });

  it("detects missing household schema so portals can fall back before migration 0031", () => {
    assert.equal(missingHouseholdColumns({ message: "column bookings.student_first_names does not exist" }), true);
    assert.equal(missingHouseholdColumns({ message: "column child_count does not exist" }), true);
    assert.equal(missingHouseholdColumns({ message: "permission denied" }), false);
    assert.equal(missingStudentIdsRpc({ message: "Could not find the function public.book_session(..., p_student_ids)" }), true);
    assert.equal(missingStudentIdsRpc({ message: "Not authorized to book for this student" }), false);
  });
});

describe("Household Study Hall — booking UX & API", () => {
  it("wizard uses parent language, checkboxes, and a hard three-child cap", () => {
    const wiz = read("src/components/booking/booking-wizard.tsx");
    assert.match(wiz, /Who is joining Study Hall\?/);
    assert.match(wiz, /Select up to \{MAX_CHILDREN_PER_STUDY_HALL\} children/);
    assert.match(wiz, /type="checkbox"/);
    assert.match(wiz, /Up to 3 children can join the same Study Hall/);
    assert.match(wiz, /wouldExceedChildLimit/);
    assert.doesNotMatch(wiz, /silently deselect|setStudentId\(students\[0\]/);
    assert.match(wiz, /All children joining the Study Hall should remain visible on camera/);
    assert.match(wiz, /studentIds/);
    assert.doesNotMatch(wiz, /participants|booking entities|student IDs|multi-seat/i);
  });

  it("camera note is gated on two or more selected children", () => {
    const wiz = read("src/components/booking/booking-wizard.tsx");
    assert.match(wiz, /const multiChild = selectedStudents\.length >= 2/);
    assert.match(wiz, /\{multiChild \? \(/);
  });

  it("checkout route accepts studentIds and rejects a fourth child", () => {
    const route = read("src/app/api/checkout/booking/route.ts");
    assert.match(route, /studentIds/);
    assert.match(route, /MAX_CHILDREN_PER_STUDY_HALL/);
    assert.match(route, /Up to 3 children can join the same Study Hall/);
    assert.match(route, /studentId: studentIds\[0\]/);
  });

  it("book_session and create_booking pass p_student_ids without changing price inputs", () => {
    const checkout = read("src/lib/checkout-service.ts");
    const booking = read("src/lib/booking-service.ts");
    assert.match(checkout, /p_student_ids: studentIds/);
    assert.match(booking, /p_student_ids: studentIds/);
    assert.match(checkout, /Price is duration-only/);
    assert.match(checkout, /missingStudentIdsRpc/);
    assert.match(booking, /missingStudentIdsRpc/);
  });
});

describe("Household Study Hall — marketing & FAQ", () => {
  it("pricing callout qualifies the $3 claim and does not advertise a bare $3/hour", () => {
    const pricing = read("src/components/marketing/pricing-section.tsx");
    assert.match(pricing, /FAMILY_VALUE_EYEBROW/);
    assert.match(pricing, /FAMILY_VALUE_BODY/);
    assert.match(pricing, /FAMILY_VALUE_RATE/);
    assert.equal(FAMILY_VALUE_EYEBROW, "One price. Up to three siblings.");
    assert.match(FAMILY_VALUE_BODY, /no additional cost per child/);
    assert.match(FAMILY_VALUE_BODY, /You pay for the Study Hall, not per child/);
    assert.equal(
      FAMILY_VALUE_RATE,
      "With three siblings in the same Study Hall, our 28-hour package works out to $3 per child/hour.",
    );
    assert.doesNotMatch(pricing, /\$3\/hour(?! when)/);
    assert.doesNotMatch(read("src/components/marketing/site-hero.tsx"), /\$3 per child|From \$3/i);
  });

  it("FAQ no longer says siblings book separate Study Halls", () => {
    const faq = read("src/lib/faq.ts");
    assert.match(faq, /Up to three children from the same household can join one Study Hall/);
    assert.doesNotMatch(faq, /book separate Study Halls for siblings/);
    assert.doesNotMatch(faq, /Each session is one child with one Guide/);
  });

  it("package prices are unchanged", () => {
    assert.equal(PACKAGE_14H_MINUTES, 840);
    assert.equal(PACKAGE_14H_PRICE_CENTS, 14000);
    assert.equal(PACKAGE_28H_MINUTES, 1680);
    assert.equal(PACKAGE_28H_PRICE_CENTS, 25200);
  });
});

describe("Household Study Hall — notifications", () => {
  it("email templates use natural possessive language for 1–3 children", () => {
    const one = T.bookingConfirmed({
      studentName: "Jordan",
      studentNames: ["Jordan"],
      whenISO: ISO,
      tz: "UTC",
      durationMinutes: 60,
      appUrl: APP,
      bookingId: "b1",
    });
    const two = T.bookingConfirmed({
      studentNames: ["Jordan", "Maya"],
      whenISO: ISO,
      tz: "UTC",
      durationMinutes: 60,
      appUrl: APP,
      bookingId: "b1",
    });
    const three = T.bookingConfirmed({
      studentNames: ["Jordan", "Maya", "Noah"],
      whenISO: ISO,
      tz: "UTC",
      durationMinutes: 60,
      appUrl: APP,
      bookingId: "b1",
    });
    assert.match(one.text, /Jordan's Study Hall is confirmed/);
    assert.match(two.text, /Jordan and Maya's Study Hall is confirmed/);
    assert.match(three.text, /Jordan, Maya, and Noah's Study Hall is confirmed/);
  });

  it("single-name callers still render Child: Amara", () => {
    const rt = T.reminder({
      role: "tutor",
      kind: "1h",
      studentName: "Amara",
      durationMinutes: 60,
      whenISO: ISO,
      tz: "UTC",
      appUrl: APP,
      bookingId: "b1",
    });
    assert.match(rt.text, /Child: Amara/);
    const sms = parentSessionReminderSms({ studentName: "Maya", whenISO: ISO, tz: "UTC" });
    assert.match(sms, /Maya's Study Hall starts at/);
    const cancel = parentCancellationSms({
      studentNames: ["Jordan", "Maya"],
      whenISO: ISO,
      tz: "UTC",
    });
    assert.match(cancel, /Jordan and Maya's Study Hall/);
  });
});

describe("Household Study Hall — reports & portals", () => {
  it("Guide report supports a per-child section in one workflow", () => {
    const form = read("src/components/dashboard/guide-session-report.tsx");
    assert.match(form, /How did Study Hall go for each child\?/);
    assert.match(form, /childReports/);
    assert.match(form, /30–60 seconds/);
    assert.match(form, /Note for parent \(optional\)/);
    const api = read("src/app/api/tutor/session-report/route.ts");
    assert.match(api, /submit_household_session_report/);
    assert.match(api, /submit_session_report/);
    const reportPage = read("src/app/dashboard/tutor/study-halls/[bookingId]/report/page.tsx");
    assert.match(reportPage, /students!student_id\(full_name\)/);
    assert.match(reportPage, /childList=\{reportChildren\}/);
  });

  it("parent detail organizes multi-child reports and lists children", () => {
    const page = read("src/app/dashboard/student/study-halls/[bookingId]/page.tsx");
    const recap = read("src/components/dashboard/parent-session-recap.tsx");
    assert.match(page, /Children/);
    assert.match(page, /ParentSessionRecap/);
    assert.match(page, /bookingChildNames/);
    assert.match(recap, /report\.children/);
    assert.match(recap, /Worked on/);
    assert.match(recap, /Guide note/);
    const parentData = read("src/lib/parent-portal-data.ts");
    assert.match(parentData, /students!student_id\(full_name, timezone\)/);
    const mgmt = read("src/lib/management-data.ts");
    assert.match(mgmt, /students!student_id\(full_name, timezone\)/);
  });

  it("Guide home shows child count for multi-child Study Halls", () => {
    const next = read("src/components/dashboard/guide-next-study-hall.tsx");
    assert.match(next, /guideChildrenCaption/);
    const helper = read("src/lib/guide-portal.mjs");
    assert.match(helper, /bookingChildNames/);
    assert.match(helper, /childCountLabel/);
  });

  it("management still treats one booking as one Study Hall", () => {
    const list = read("src/components/dashboard/management-study-halls.tsx");
    assert.match(list, /bookingChildNames/);
    const detail = read("src/app/dashboard/admin/study-halls/[bookingId]/page.tsx");
    assert.match(detail, /bookingChildNames/);
    const mgmt = read("src/lib/management-data.ts");
    assert.match(mgmt, /missingHouseholdColumns/);
  });
});

describe("Household Study Hall — migration safety", () => {
  it("0031 is additive and keeps student_id as the primary child", () => {
    const m = read("supabase/migrations/0031_household_study_hall_children.sql");
    assert.match(m, /create table if not exists public\.booking_children/);
    assert.match(m, /create table if not exists public\.session_report_children/);
    assert.match(m, /student_first_names/);
    assert.match(m, /child_count/);
    assert.match(m, /bookings_child_count_range/);
    assert.match(m, /p_student_ids uuid\[\] default null/);
    assert.match(m, /account_has_used_free_trial/);
    assert.match(m, /session_list_price_cents/);
    assert.doesNotMatch(m, /drop column student_id/i);
    assert.doesNotMatch(m, /drop table public\.bookings/i);
    assert.doesNotMatch(m, /drop table public\.session_reports/i);
    const sqlBody = m.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
    assert.doesNotMatch(sqlBody, /comp_rate|auto_?refill/i);
  });
});

describe("Household Study Hall — live RPCs", { skip: !hasSupabaseEnv }, () => {
  const svc = adminClient();
  const accounts = [];
  let parent;
  let other;
  let guide;
  let schemaReady = false;

  async function approveGuide(id) {
    await svc.from("profiles").update({ role: "tutor" }).eq("id", id);
    await svc.from("tutor_profiles").update({ status: "approved", timezone: "UTC" }).eq("profile_id", id);
    await svc.from("tutor_availability").delete().eq("tutor_id", id);
    for (let dow = 0; dow < 7; dow += 1) {
      await svc.from("tutor_availability").insert({
        tutor_id: id,
        day_of_week: dow,
        start_time: "00:00",
        end_time: "23:59",
      });
    }
  }

  async function newStudent(accountId, name) {
    const { data, error } = await svc
      .from("students")
      .insert({ account_id: accountId, full_name: name, grade_level: "7", timezone: "UTC" })
      .select("id")
      .single();
    assert.equal(error, null, error?.message);
    return data.id;
  }

  function futureStart(hoursAhead = 48) {
    const d = new Date(Date.now() + hoursAhead * 3600000);
    d.setUTCMinutes(0, 0, 0);
    return d.toISOString();
  }

  before(async () => {
    const probe = await svc.from("booking_children").select("booking_id").limit(1);
    schemaReady = !probe.error;
    if (!schemaReady) return;
    parent = await createUser({ requestedRole: "student", displayName: "Household Parent" });
    other = await createUser({ requestedRole: "student", displayName: "Other Household" });
    guide = await createUser({ requestedRole: "tutor", displayName: "Household Guide" });
    accounts.push(parent.id, other.id, guide.id);
    await approveGuide(guide.id);
  });

  after(async () => {
    if (accounts.length) {
      const { data: bks } = await svc.from("bookings").select("id").in("account_id", accounts);
      const ids = (bks ?? []).map((b) => b.id);
      if (ids.length) {
        await svc.from("session_report_children").delete().in("booking_id", ids);
        await svc.from("session_reports").delete().in("booking_id", ids);
        await svc.from("tutor_earnings").delete().in("booking_id", ids);
        await svc.from("payments").delete().in("booking_id", ids);
        await svc.from("bookings").delete().in("id", ids);
      }
      await svc.from("package_minute_ledger").delete().in("account_id", accounts);
      await svc.from("students").delete().in("account_id", accounts);
      await svc.from("tutor_availability").delete().eq("tutor_id", guide?.id ?? "00000000-0000-0000-0000-000000000000");
    }
    await cleanupAll();
  });

  it("one booking with three children charges duration only (free trial)", async (t) => {
    if (!schemaReady) {
      t.skip("migration 0031 not applied");
      return;
    }
    const client = await signIn(parent.email, parent.password);
    const jordan = await newStudent(parent.id, "Jordan H");
    const maya = await newStudent(parent.id, "Maya H");
    const noah = await newStudent(parent.id, "Noah H");
    const start = futureStart(50);
    const { data, error } = await client.rpc("book_session", {
      p_student_id: jordan,
      p_subject_id: null,
      p_other_subject: null,
      p_request_note: null,
      p_duration: 60,
      p_start: start,
      p_is_free_trial: true,
      p_student_ids: [jordan, maya, noah],
    });
    assert.equal(error, null, error?.message);
    assert.equal(data.funding, "free_trial");
    assert.equal(data.session_price_cents, 0);
    assert.equal(data.package_minutes_used, 0);
    const { data: bk } = await svc
      .from("bookings")
      .select("id, child_count, price_cents, is_free_trial, student_first_names")
      .eq("id", data.booking_id)
      .single();
    assert.equal(bk.child_count, 3);
    assert.equal(bk.price_cents, 0);
    assert.equal(bk.is_free_trial, true);
    assert.deepEqual(bk.student_first_names, ["Jordan", "Maya", "Noah"]);
    const { data: kids } = await svc.from("booking_children").select("student_id").eq("booking_id", bk.id);
    assert.equal(kids.length, 3);
  });

  it("a second free Study Hall is blocked after a three-child free session", async (t) => {
    if (!schemaReady) {
      t.skip("migration 0031 not applied");
      return;
    }
    const client = await signIn(parent.email, parent.password);
    const fourth = await newStudent(parent.id, "Avery H");
    const { error } = await client.rpc("book_session", {
      p_student_id: fourth,
      p_subject_id: null,
      p_other_subject: null,
      p_request_note: null,
      p_duration: 60,
      p_start: futureStart(56),
      p_is_free_trial: true,
      p_student_ids: [fourth],
    });
    assert.ok(error, "second free session must be rejected");
    assert.match(error.message, /already used/i);
  });

  it("rejects a child from another household", async (t) => {
    if (!schemaReady) {
      t.skip("migration 0031 not applied");
      return;
    }
    const client = await signIn(parent.email, parent.password);
    const own = await newStudent(parent.id, "Sam H");
    const foreign = await newStudent(other.id, "Riley Other");
    const { error } = await client.rpc("book_session", {
      p_student_id: own,
      p_subject_id: null,
      p_other_subject: null,
      p_request_note: null,
      p_duration: 60,
      p_start: futureStart(62),
      p_is_free_trial: false,
      p_student_ids: [own, foreign],
    });
    assert.ok(error, "foreign child must be rejected");
  });

  it("rejects more than three children", async (t) => {
    if (!schemaReady) {
      t.skip("migration 0031 not applied");
      return;
    }
    const client = await signIn(parent.email, parent.password);
    const ids = [];
    for (const name of ["One H", "Two H", "Three H", "Four H"]) {
      ids.push(await newStudent(parent.id, name));
    }
    const { error } = await client.rpc("book_session", {
      p_student_id: ids[0],
      p_subject_id: null,
      p_other_subject: null,
      p_request_note: null,
      p_duration: 60,
      p_start: futureStart(68),
      p_is_free_trial: false,
      p_student_ids: ids,
    });
    assert.ok(error, "four children must be rejected");
  });

  it("PAYG quote stays duration-only regardless of child count", async (t) => {
    if (!schemaReady) {
      t.skip("migration 0031 not applied");
      return;
    }
    const q = await svc.rpc("booking_quote", { p_account: parent.id, p_duration: 60, p_is_free_trial: false });
    assert.equal(q.error, null, q.error?.message);
    assert.equal(q.data.session_price_cents, 1200);
  });

  it("prepaid 3-child Study Hall deducts one hour, not three", async (t) => {
    if (!schemaReady) {
      t.skip("migration 0031 not applied");
      return;
    }
    const acct = await createUser({ requestedRole: "student", displayName: "Prepaid Household" });
    accounts.push(acct.id);
    const client = await signIn(acct.email, acct.password);
    const ids = [];
    for (const name of ["Jordan P", "Maya P", "Noah P"]) ids.push(await newStudent(acct.id, name));
    await svc.from("package_minute_ledger").insert({
      account_id: acct.id,
      minutes_delta: 120,
      entry_type: "purchase",
      reason: "household prepaid grant",
      reference: `hh-prepaid-${acct.id}`,
    });
    const { data, error } = await client.rpc("book_session", {
      p_student_id: ids[0],
      p_subject_id: null,
      p_other_subject: null,
      p_request_note: null,
      p_duration: 60,
      p_start: futureStart(74),
      p_is_free_trial: false,
      p_student_ids: ids,
    });
    assert.equal(error, null, error?.message);
    assert.equal(data.funding, "package");
    assert.equal(data.package_minutes_used, 60);
    assert.equal(data.session_price_cents, 1200);
    const bal = await svc.rpc("get_customer_balances", { p_account: acct.id });
    assert.equal(bal.error, null, bal.error?.message);
    assert.equal(Number(bal.data.package_minutes), 60);
    const { data: kids } = await svc.from("booking_children").select("student_id").eq("booking_id", data.booking_id);
    assert.equal(kids.length, 3);
  });

  it("cancelling a 3-child prepaid Study Hall restores one hour once", async (t) => {
    if (!schemaReady) {
      t.skip("migration 0031 not applied");
      return;
    }
    const acct = await createUser({ requestedRole: "student", displayName: "Cancel Household" });
    accounts.push(acct.id);
    const client = await signIn(acct.email, acct.password);
    const ids = [];
    for (const name of ["Jordan C", "Maya C", "Noah C"]) ids.push(await newStudent(acct.id, name));
    await svc.from("package_minute_ledger").insert({
      account_id: acct.id,
      minutes_delta: 180,
      entry_type: "purchase",
      reason: "household cancel grant",
      reference: `hh-cancel-${acct.id}`,
    });
    const booked = await client.rpc("book_session", {
      p_student_id: ids[0],
      p_subject_id: null,
      p_other_subject: null,
      p_request_note: null,
      p_duration: 60,
      p_start: futureStart(80),
      p_is_free_trial: false,
      p_student_ids: ids,
    });
    assert.equal(booked.error, null, booked.error?.message);
    const cancel = await client.rpc("customer_cancel_booking", { p_booking: booked.data.booking_id });
    assert.equal(cancel.error, null, cancel.error?.message);
    assert.equal(cancel.data.early, true);
    assert.equal(Number(cancel.data.restored_minutes), 60);
    const bal = await svc.rpc("get_customer_balances", { p_account: acct.id });
    assert.equal(Number(bal.data.package_minutes), 180);
    const { data: bk } = await svc.from("bookings").select("status, child_count").eq("id", booked.data.booking_id).single();
    assert.equal(bk.status, "cancelled");
    assert.equal(bk.child_count, 3);
  });

  it("Guide compensation for a 3-child hour is rate times duration, not children", async (t) => {
    if (!schemaReady) {
      t.skip("migration 0031 not applied");
      return;
    }
    await svc.from("tutor_profiles").update({ comp_rate_cents_per_hour: 1500 }).eq("profile_id", guide.id);
    const ids = [];
    for (const name of ["Jordan E", "Maya E", "Noah E"]) ids.push(await newStudent(parent.id, name));
    const start = new Date(Date.now() - 3 * 86400000);
    start.setUTCMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60000);
    const { data: bk, error } = await svc
      .from("bookings")
      .insert({
        student_id: ids[0],
        account_id: parent.id,
        tutor_id: guide.id,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        duration_minutes: 60,
        status: "completed",
        payment_status: "paid",
        price_cents: 1200,
        is_free_trial: false,
        student_first_name: "Jordan",
        tutor_display_name: "Household Guide",
        completed_at: end.toISOString(),
      })
      .select("id")
      .single();
    assert.equal(error, null, error?.message);
    const attached = await svc.rpc("attach_booking_children", { p_booking: bk.id, p_student_ids: ids });
    assert.equal(attached.error, null, attached.error?.message);
    const earn = await svc.rpc("record_tutor_earning", {
      p_booking: bk.id,
      p_reason: "household compensation check",
    });
    assert.equal(earn.error, null, earn.error?.message);
    const { data: row } = await svc
      .from("tutor_earnings")
      .select("amount_cents, duration_minutes, rate_cents_per_hour")
      .eq("booking_id", bk.id)
      .single();
    assert.equal(row.duration_minutes, 60);
    assert.equal(row.rate_cents_per_hour, 1500);
    assert.equal(row.amount_cents, 1500);
  });

  it("household report writes one session report with a section per child", async (t) => {
    if (!schemaReady) {
      t.skip("migration 0031 not applied");
      return;
    }
    const ids = [];
    for (const name of ["Jordan R", "Maya R", "Noah R"]) ids.push(await newStudent(parent.id, name));
    const start = new Date(Date.now() - 2 * 86400000);
    start.setUTCMinutes(30, 0, 0);
    const end = new Date(start.getTime() + 60 * 60000);
    const { data: bk, error } = await svc
      .from("bookings")
      .insert({
        student_id: ids[0],
        account_id: parent.id,
        tutor_id: guide.id,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        duration_minutes: 60,
        status: "completed",
        payment_status: "paid",
        price_cents: 0,
        is_free_trial: false,
        student_first_name: "Jordan",
        tutor_display_name: "Household Guide",
        completed_at: end.toISOString(),
      })
      .select("id")
      .single();
    assert.equal(error, null, error?.message);
    const attached = await svc.rpc("attach_booking_children", { p_booking: bk.id, p_student_ids: ids });
    assert.equal(attached.error, null, attached.error?.message);
    const guideClient = await signIn(guide.email, guide.password);
    const reports = [
      { student_id: ids[0], focus: "good_focus", work_summary: "Math worksheet and reading", redirection: "a_little", guide_note: "Started slowly" },
      { student_id: ids[1], focus: "great_focus", work_summary: "Science review", redirection: "none", guide_note: null },
      { student_id: ids[2], focus: "good_focus", work_summary: "History notes", redirection: "none", guide_note: null },
    ];
    const sub = await guideClient.rpc("submit_household_session_report", {
      p_booking: bk.id,
      p_child_reports: reports,
    });
    assert.equal(sub.error, null, sub.error?.message);
    const { data: header } = await svc.from("session_reports").select("id, booking_id").eq("booking_id", bk.id);
    assert.equal(header.length, 1);
    const { data: kids } = await svc.from("session_report_children").select("student_first_name, work_summary").eq("booking_id", bk.id);
    assert.equal(kids.length, 3);
    assert.ok(kids.some((k) => k.work_summary === "Science review"));
  });
});
