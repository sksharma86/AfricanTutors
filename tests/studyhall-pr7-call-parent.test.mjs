import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";

import {
  PACKAGE_14H_MINUTES,
  PACKAGE_14H_PRICE_CENTS,
  PACKAGE_28H_MINUTES,
  PACKAGE_28H_PRICE_CENTS,
} from "../src/lib/packages.mjs";
import {
  CALL_PARENT_SMS_MESSAGE,
  CALL_PARENT_VOICE_MESSAGE,
  ESCALATION_COOLDOWN_MS,
  ESCALATION_NOTE_MAX,
  ESCALATION_REASON_LABELS,
  ESCALATION_REASONS,
  isEscalationReason,
} from "../src/lib/call-parent.mjs";
import { JOIN_OPEN_LEAD_MIN } from "../src/lib/session-window.mjs";
import {
  adminClient,
  anonClient,
  cleanupAll,
  createUser,
  hasSupabaseEnv,
  makeAdmin,
  signIn,
} from "./helpers.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Study Hall PR7 — Call Parent (source)", () => {
  it("migration 0024 defines escalations, async statuses, SMS claim, and RLS", () => {
    const m = read("supabase/migrations/0024_studyhall_pr7_call_parent.sql");
    assert.match(m, /create table if not exists public\.parent_escalation_requests/);
    assert.match(m, /phone_e164/);
    assert.match(m, /request_parent_escalation/);
    assert.match(m, /mark_parent_escalation_contacting/);
    assert.match(m, /finalize_parent_escalation_call_answered/);
    assert.match(m, /claim_parent_escalation_sms_fallback/);
    assert.match(m, /'contacting'/);
    assert.match(m, /'call_answered'/);
    assert.match(m, /sms_status = 'claiming'/);
    assert.match(m, /set_my_phone/);
    assert.match(m, /interval '5 minutes'/);
    assert.match(m, /wait before requesting parent attention again/);
    assert.match(m, /status is distinct from 'confirmed'/);
    assert.match(m, /child_unwell|refusing_to_work|needs_parent_assistance|behavior_issue/);
    assert.match(m, /enable row level security/);
    assert.match(m, /tutor_id = auth\.uid\(\)/);
    assert.match(m, /account_id = auth\.uid\(\)/);
    assert.match(m, /is_admin\(auth\.uid\(\)\)/);
    assert.doesNotMatch(m, /grant insert on public\.parent_escalation_requests to authenticated/i);
    assert.doesNotMatch(m, /comp_rate|PAYG|package_products|session_reports/);
  });

  it("reason labels and messages match product copy", () => {
    assert.equal(ESCALATION_REASON_LABELS.child_unwell, "Child feels unwell");
    assert.equal(ESCALATION_REASON_LABELS.refusing_to_work, "Repeatedly refusing to work");
    assert.equal(ESCALATION_NOTE_MAX, 200);
    assert.equal(ESCALATION_COOLDOWN_MS, 5 * 60 * 1000);
    assert.match(CALL_PARENT_VOICE_MESSAGE, /check on your child now/i);
    assert.match(CALL_PARENT_SMS_MESSAGE, /check on your child/i);
    assert.doesNotMatch(CALL_PARENT_VOICE_MESSAGE, /http|join|dashboard/i);
    assert.equal(isEscalationReason("behavior_issue"), true);
    assert.equal(isEscalationReason("panic"), false);
    assert.equal(ESCALATION_REASONS.length, 5);
  });

  it("Guide UI confirms, shows Contacting parent…, polls; never exposes phone", () => {
    const ctrl = read("src/components/session/call-parent-control.tsx");
    const room = read("src/components/session/session-room.tsx");
    const api = read("src/app/api/tutor/call-parent/route.ts");
    const poll = read("src/app/api/tutor/call-parent/[id]/route.ts");
    assert.match(room, /CallParentControl/);
    assert.match(ctrl, /Call Parent/);
    assert.match(ctrl, /Request parent attention/);
    assert.match(ctrl, /will not see[\s\S]*their number|You will not see their number/i);
    assert.match(ctrl, /Contacting parent/);
    assert.match(ctrl, /setInterval|\/api\/tutor\/call-parent\//);
    assert.match(ctrl, /Parent contacted|Parent alerted by text|Unable to contact parent/);
    assert.doesNotMatch(ctrl, /phone_e164|TWILIO|toE164/);
    assert.match(api, /request_parent_escalation/);
    assert.match(api, /fulfillParentEscalation/);
    assert.match(api, /Never include phone/i);
    assert.match(poll, /guideStatusFromDb|final/);
  });

  it("queued call is contacting not success; StatusCallback + signature webhook", () => {
    const client = read("src/lib/telephony/client.ts");
    const svc = read("src/lib/call-parent-service.ts");
    const hook = read("src/app/api/twilio/voice-status/route.ts");
    assert.match(client, /StatusCallback/);
    assert.match(client, /StatusCallbackEvent/);
    assert.match(client, /voice-status/);
    assert.match(svc, /contacting/);
    assert.match(svc, /mark_parent_escalation_contacting/);
    assert.match(svc, /handleTwilioVoiceStatus/);
    assert.match(svc, /claim_parent_escalation_sms_fallback/);
    assert.match(svc, /finalize_parent_escalation_call_answered/);
    // Queued must not map to Parent contacted
    assert.match(svc, /guideStatus: "contacting"|return resultOf\(escalationId, "contacting"\)/);
    assert.match(hook, /validateTwilioSignature/);
    assert.match(hook, /Invalid signature/);
    assert.match(hook, /x-twilio-signature/i);
  });

  it("Twilio is behind a server-only abstraction with safe failure", () => {
    const cfg = read("src/lib/telephony/config.ts");
    const client = read("src/lib/telephony/client.ts");
    const svc = read("src/lib/call-parent-service.ts");
    assert.match(cfg, /TWILIO_ACCOUNT_SID/);
    assert.match(cfg, /TWILIO_AUTH_TOKEN/);
    assert.match(cfg, /TWILIO_PHONE_NUMBER/);
    assert.match(cfg, /isTwilioConfigured/);
    assert.doesNotMatch(cfg, /NEXT_PUBLIC_TWILIO/);
    assert.match(client, /placeParentAttentionCall/);
    assert.match(client, /sendParentAttentionSms/);
    assert.match(client, /server-only/);
    assert.match(svc, /Parent contacted|Parent alerted by text|Unable to contact parent|Contacting parent/);
    assert.match(svc, /not_configured|no_phone/);
  });

  it("parent phone form + Terms/Privacy disclose transactional contact", () => {
    assert.match(read("src/components/dashboard/parent-phone-form.tsx"), /Phone for Study Hall alerts/);
    assert.match(read("src/app/dashboard/student/page.tsx"), /ParentPhoneForm/);
    assert.match(read("src/app/(marketing)/privacy/page.tsx"), /call or text you/i);
    assert.match(read("src/app/(marketing)/terms/page.tsx"), /automated phone call or SMS/i);
    assert.match(read("src/app/(marketing)/privacy/page.tsx"), /attorney review/i);
  });

  it("admin can see escalations; PR6 reports lightly note escalation", () => {
    assert.match(read("src/app/dashboard/admin/page.tsx"), /Call Parent escalations/);
    assert.match(read("src/components/dashboard/session-reports-list.tsx"), /had_parent_escalation/);
    assert.match(
      read("src/components/dashboard/session-reports-list.tsx"),
      /parent attention request was sent/i,
    );
  });

  it("PR2–PR6 invariants remain intact", () => {
    const pricing = read("src/lib/pricing.ts");
    assert.match(pricing, /PAYG_PRICE_USD = 12/);
    assert.match(pricing, /FREE_TRIAL_MINUTES = 60/);
    assert.match(pricing, /minutes:\s*60,\s*priceUsd:\s*12/);
    assert.match(pricing, /minutes:\s*120,\s*priceUsd:\s*24/);
    assert.match(pricing, /minutes:\s*180,\s*priceUsd:\s*36/);
    assert.equal(PACKAGE_14H_MINUTES, 840);
    assert.equal(PACKAGE_14H_PRICE_CENTS, 14000);
    assert.equal(PACKAGE_28H_MINUTES, 1680);
    assert.equal(PACKAGE_28H_PRICE_CENTS, 25200);
    assert.equal(JOIN_OPEN_LEAD_MIN, 5);
    assert.match(read("supabase/migrations/0023_studyhall_pr6_session_reports.sql"), /session_reports/);
    assert.match(read("src/app/api/tutor/session-report/route.ts"), /submit_session_report/);
    const m24 = read("supabase/migrations/0024_studyhall_pr7_call_parent.sql");
    assert.doesNotMatch(m24, /comp_rate_cents|record_tutor_earning|booking_quote/);
  });
});

describe("Study Hall PR7 — Twilio signature + status classification", () => {
  it("validateTwilioSignature accepts valid HMAC and rejects forged", async () => {
    const {
      validateTwilioSignature,
      classifyTwilioCallStatus,
      TWILIO_CALL_FAILURE_STATUSES,
    } = await import("../src/lib/telephony/twilio-signature.mjs");
    const { createHmac } = await import("node:crypto");

    const token = "test_auth_token";
    const url = "https://app.example.test/api/twilio/voice-status";
    const params = { CallSid: "CAabc", CallStatus: "completed" };
    const keys = Object.keys(params).sort();
    let data = url;
    for (const k of keys) data += k + params[k];
    const good = createHmac("sha1", token).update(Buffer.from(data, "utf8")).digest("base64");

    assert.equal(validateTwilioSignature(token, url, params, good), true);
    assert.equal(validateTwilioSignature(token, url, params, "forged"), false);
    assert.equal(validateTwilioSignature(token, url, params, null), false);
    assert.equal(validateTwilioSignature("", url, params, good), false);

    assert.equal(classifyTwilioCallStatus("completed"), "answered");
    assert.equal(classifyTwilioCallStatus("queued"), "intermediate");
    assert.equal(classifyTwilioCallStatus("ringing"), "intermediate");
    assert.equal(classifyTwilioCallStatus("in-progress"), "intermediate");
    for (const s of TWILIO_CALL_FAILURE_STATUSES) {
      assert.equal(classifyTwilioCallStatus(s), "failed", s);
    }
  });

  it("webhook route rejects invalid signatures and does not expose secrets", () => {
    const hook = read("src/app/api/twilio/voice-status/route.ts");
    assert.match(hook, /status: 401/);
    assert.match(hook, /Invalid signature/);
    assert.doesNotMatch(hook, /phone_e164|TWILIO_AUTH_TOKEN!/);
    assert.match(hook, /handleTwilioVoiceStatus/);
  });
});

describe("Study Hall PR7 — telephony client (mocked fetch, no real calls)", () => {
  it("Twilio client posts Calls/Messages with TTS/SMS copy (mocked via .mjs helper)", async () => {
    const clientSrc = read("src/lib/telephony/client.ts");
    assert.match(clientSrc, /Accounts\/\$\{accountSid\}\/Calls\.json/);
    assert.match(clientSrc, /Accounts\/\$\{accountSid\}\/Messages\.json/);
    assert.match(clientSrc, /Twiml/);
    assert.match(clientSrc, /To: opts\.toE164/);
    assert.match(clientSrc, /StatusCallback/);
    assert.match(clientSrc, /StatusCallbackEvent/);

    // Runtime mock without importing .ts (node --test has no TS loader).
    const prev = {
      sid: process.env.TWILIO_ACCOUNT_SID,
      token: process.env.TWILIO_AUTH_TOKEN,
      from: process.env.TWILIO_PHONE_NUMBER,
    };
    process.env.TWILIO_ACCOUNT_SID = "ACtestsid000000000000000000000000";
    process.env.TWILIO_AUTH_TOKEN = "testtoken";
    process.env.TWILIO_PHONE_NUMBER = "+15550001111";

    const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), body: String(init?.body ?? "") });
      if (String(url).includes("Calls.json")) {
        return new Response(JSON.stringify({ sid: "CAtest123", status: "queued" }), { status: 201 });
      }
      return new Response(JSON.stringify({ sid: "SMtest456" }), { status: 201 });
    };

    try {
      assert.equal(
        Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER),
        true,
      );

      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const auth = Buffer.from(`${accountSid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
      const twiml = `<Response><Say>${CALL_PARENT_VOICE_MESSAGE}</Say></Response>`;
      const callBody = new URLSearchParams({
        To: "+15559876543",
        From: process.env.TWILIO_PHONE_NUMBER,
        Twiml: twiml,
      });
      const callRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: callBody,
      });
      assert.equal(callRes.status, 201);
      const callJson = await callRes.json();
      assert.equal(callJson.sid, "CAtest123");
      assert.match(calls[0].body, /15559876543/);
      const decoded = decodeURIComponent(calls[0].body.replace(/\+/g, " "));
      assert.match(decoded, /Study Hall at Home needs your attention/);
      assert.doesNotMatch(decoded, /dashboard\/session|https?:\/\/app\./i);

      const smsBody = new URLSearchParams({
        To: "+15559876543",
        From: process.env.TWILIO_PHONE_NUMBER,
        Body: CALL_PARENT_SMS_MESSAGE,
      });
      const smsRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: smsBody,
      });
      assert.equal(smsRes.status, 201);
      assert.ok(calls.some((c) => /Messages\.json/.test(c.url)));
    } finally {
      globalThis.fetch = originalFetch;
      if (prev.sid === undefined) delete process.env.TWILIO_ACCOUNT_SID;
      else process.env.TWILIO_ACCOUNT_SID = prev.sid;
      if (prev.token === undefined) delete process.env.TWILIO_AUTH_TOKEN;
      else process.env.TWILIO_AUTH_TOKEN = prev.token;
      if (prev.from === undefined) delete process.env.TWILIO_PHONE_NUMBER;
      else process.env.TWILIO_PHONE_NUMBER = prev.from;
    }
  });

  it("API route never returns phone or Twilio secrets", () => {
    const api = read("src/app/api/tutor/call-parent/route.ts");
    assert.match(api, /guideStatus|status: result\.guideStatus/);
    assert.doesNotMatch(api, /phone_e164|toE164|TWILIO_AUTH/);
    assert.match(api, /status: 429/);
  });

  it("unconfigured Twilio does not claim success in service outcomes", () => {
    const svc = read("src/lib/call-parent-service.ts");
    assert.match(svc, /not_configured/);
    assert.match(svc, /Unable to contact parent — notify manager/);
    const notConfiguredBlock = svc.slice(
      svc.indexOf("if (!isTwilioConfigured())"),
      svc.indexOf("const { data: profile }"),
    );
    assert.match(notConfiguredBlock, /status:\s*"not_configured"|p_status:\s*"not_configured"/);
    assert.match(notConfiguredBlock, /"not_configured"/);
    assert.doesNotMatch(notConfiguredBlock, /parent_contacted|"Parent contacted"/);
  });

  it("SMS fallback claim is idempotent; answered skips SMS; failure statuses listed", () => {
    const svc = read("src/lib/call-parent-service.ts");
    const mig = read("supabase/migrations/0024_studyhall_pr7_call_parent.sql");
    const sig = read("src/lib/telephony/twilio-signature.mjs");
    assert.match(mig, /sms_status = 'claiming'/);
    assert.match(mig, /and sms_status is null/);
    assert.match(svc, /sms_already_claimed_or_final/);
    assert.match(svc, /finalize_parent_escalation_call_answered/);
    assert.doesNotMatch(
      svc.slice(svc.indexOf("if (kind === \"answered\")"), svc.indexOf("claim_parent_escalation_sms_fallback")),
      /sendParentAttentionSms/,
    );
    for (const s of ["busy", "failed", "no-answer", "canceled", "rejected"]) {
      assert.match(sig, new RegExp(`"${s}"`));
    }
    assert.match(sig, /"completed"/);
    assert.match(sig, /"queued"/);
  });
});

describe("Study Hall PR7 — live escalations (requires migration 0024)", { skip: !hasSupabaseEnv }, () => {
  const svc = adminClient();
  const accounts = [];
  let parent;
  let otherParent;
  let guideA;
  let guideB;
  let admin;
  let pr7Applied = false;

  async function approveGuide(id) {
    await svc.from("profiles").update({ role: "tutor" }).eq("id", id);
    await svc
      .from("tutor_profiles")
      .update({ status: "approved", timezone: "UTC", comp_rate_cents_per_hour: 1000 })
      .eq("profile_id", id);
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

  async function detectPr7() {
    const { error } = await svc.from("parent_escalation_requests").select("id").limit(1);
    if (error) return false;
    const { error: pe } = await svc.from("profiles").select("phone_e164").limit(1);
    return !pe;
  }

  async function insertActiveBooking({ accountId, tutorId, studentId, status = "confirmed", offsetMin = -10 }) {
    const start = new Date(Date.now() + offsetMin * 60000);
    const end = new Date(start.getTime() + 60 * 60000);
    const { data, error } = await svc
      .from("bookings")
      .insert({
        student_id: studentId,
        account_id: accountId,
        tutor_id: tutorId,
        subject_id: null,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        duration_minutes: 60,
        status,
        payment_status: "paid",
        price_cents: 1200,
        is_free_trial: false,
        student_first_name: "Kid",
        tutor_display_name: "Guide",
      })
      .select("id")
      .single();
    assert.equal(error, null, error?.message);
    return data.id;
  }

  before(async () => {
    parent = await createUser({ requestedRole: "student", displayName: "PR7 Parent" });
    otherParent = await createUser({ requestedRole: "student", displayName: "PR7 Other" });
    guideA = await createUser({ requestedRole: "tutor", displayName: "PR7 Guide A" });
    guideB = await createUser({ requestedRole: "tutor", displayName: "PR7 Guide B" });
    admin = await createUser({ requestedRole: "student", displayName: "PR7 Admin" });
    accounts.push(parent.id, otherParent.id, guideA.id, guideB.id, admin.id);
    await makeAdmin(admin.id);
    await approveGuide(guideA.id);
    await approveGuide(guideB.id);
    pr7Applied = await detectPr7();
  });

  after(async () => {
    for (const acc of accounts) {
      const { data: bks } = await svc.from("bookings").select("id").eq("account_id", acc);
      const ids = (bks ?? []).map((b) => b.id);
      if (ids.length) {
        await svc.from("parent_escalation_requests").delete().in("booking_id", ids);
        await svc.from("session_reports").delete().in("booking_id", ids);
        await svc.from("bookings").delete().in("id", ids);
      }
      await svc.from("students").delete().eq("account_id", acc);
    }
    await cleanupAll();
  });

  it("PR2 pricing + PR3 free session + PR6 report table remain intact", async () => {
    const q = await svc.rpc("booking_quote", {
      p_account: parent.id,
      p_duration: 60,
      p_is_free_trial: false,
    });
    assert.equal(q.error, null, q.error?.message);
    assert.equal(q.data.session_price_cents, 1200);
    const free = await svc.rpc("booking_quote", {
      p_account: parent.id,
      p_duration: 60,
      p_is_free_trial: true,
    });
    assert.equal(free.data.session_price_cents, 0);
    const { error } = await svc.from("session_reports").select("id").limit(1);
    assert.equal(error, null, error?.message);
  });

  it("assigned Guide can create escalation for active session; parent phone never in row", async (t) => {
    if (!pr7Applied) {
      t.skip("migration 0024 not applied to this environment yet");
      return;
    }
    await svc.from("profiles").update({ phone_e164: "+15551230001" }).eq("id", parent.id);
    const stu = await newStudent(parent.id, "Active Kid");
    const bookingId = await insertActiveBooking({
      accountId: parent.id,
      tutorId: guideA.id,
      studentId: stu,
    });
    const guideClient = await signIn(guideA.email, guideA.password);
    const r = await guideClient.rpc("request_parent_escalation", {
      p_booking: bookingId,
      p_reason: "needs_parent_assistance",
      p_note: "Needs a quick check-in",
    });
    assert.equal(r.error, null, r.error?.message);
    assert.ok(r.data);

    const { data: row } = await svc.from("parent_escalation_requests").select("*").eq("id", r.data).single();
    assert.equal(row.tutor_id, guideA.id);
    assert.equal(row.account_id, parent.id);
    assert.equal(row.reason, "needs_parent_assistance");
    assert.equal(row.status, "pending");

    const peek = await guideClient.from("profiles").select("phone_e164").eq("id", parent.id).maybeSingle();
    assert.equal(peek.data, null);
  });

  it("unrelated Guide and parent cannot trigger Call Parent", async (t) => {
    if (!pr7Applied) {
      t.skip("migration 0024 not applied to this environment yet");
      return;
    }
    const stu = await newStudent(parent.id, "Authz Kid");
    const bookingId = await insertActiveBooking({
      accountId: parent.id,
      tutorId: guideA.id,
      studentId: stu,
      offsetMin: -8,
    });
    const otherGuide = await signIn(guideB.email, guideB.password);
    const badGuide = await otherGuide.rpc("request_parent_escalation", {
      p_booking: bookingId,
      p_reason: "behavior_issue",
      p_note: null,
    });
    assert.ok(badGuide.error);
    assert.match(badGuide.error.message, /Not authorized/i);

    const parentClient = await signIn(parent.email, parent.password);
    const badParent = await parentClient.rpc("request_parent_escalation", {
      p_booking: bookingId,
      p_reason: "behavior_issue",
      p_note: null,
    });
    assert.ok(badParent.error);
    assert.match(badParent.error.message, /Not authorized/i);
  });

  it("cancelled / non-active booking cannot escalate; cooldown enforced", async (t) => {
    if (!pr7Applied) {
      t.skip("migration 0024 not applied to this environment yet");
      return;
    }
    const stu = await newStudent(parent.id, "Cancel Kid");
    const cancelled = await insertActiveBooking({
      accountId: parent.id,
      tutorId: guideA.id,
      studentId: stu,
      status: "cancelled",
    });
    const guideClient = await signIn(guideA.email, guideA.password);
    const bad = await guideClient.rpc("request_parent_escalation", {
      p_booking: cancelled,
      p_reason: "child_unwell",
      p_note: null,
    });
    assert.ok(bad.error);
    assert.match(bad.error.message, /active confirmed/i);

    const active = await insertActiveBooking({
      accountId: parent.id,
      tutorId: guideA.id,
      studentId: stu,
      offsetMin: -5,
    });
    const first = await guideClient.rpc("request_parent_escalation", {
      p_booking: active,
      p_reason: "other",
      p_note: null,
    });
    assert.equal(first.error, null, first.error?.message);
    const second = await guideClient.rpc("request_parent_escalation", {
      p_booking: active,
      p_reason: "other",
      p_note: null,
    });
    assert.ok(second.error);
    assert.match(second.error.message, /wait before requesting/i);
  });

  it("required reason + note length enforced; unrelated parent cannot view; admin can", async (t) => {
    if (!pr7Applied) {
      t.skip("migration 0024 not applied to this environment yet");
      return;
    }
    const stu = await newStudent(parent.id, "Fields Kid");
    const bookingId = await insertActiveBooking({
      accountId: parent.id,
      tutorId: guideA.id,
      studentId: stu,
      offsetMin: -12,
    });
    const guideClient = await signIn(guideA.email, guideA.password);
    const badReason = await guideClient.rpc("request_parent_escalation", {
      p_booking: bookingId,
      p_reason: "invalid",
      p_note: null,
    });
    assert.ok(badReason.error);

    const longNote = "x".repeat(201);
    const badNote = await guideClient.rpc("request_parent_escalation", {
      p_booking: bookingId,
      p_reason: "child_unwell",
      p_note: longNote,
    });
    assert.ok(badNote.error);

    const ok = await guideClient.rpc("request_parent_escalation", {
      p_booking: bookingId,
      p_reason: "child_unwell",
      p_note: "Short note",
    });
    assert.equal(ok.error, null, ok.error?.message);

    const other = await signIn(otherParent.email, otherParent.password);
    const leaked = await other.from("parent_escalation_requests").select("id").eq("booking_id", bookingId);
    assert.equal((leaked.data ?? []).length, 0);

    const adminClientSigned = await signIn(admin.email, admin.password);
    const seen = await adminClientSigned.from("parent_escalation_requests").select("id").eq("booking_id", bookingId);
    assert.equal((seen.data ?? []).length, 1);
  });

  it("unauthenticated cannot escalate; parent can set own phone; Guide cannot", async (t) => {
    if (!pr7Applied) {
      t.skip("migration 0024 not applied to this environment yet");
      return;
    }
    const anon = anonClient();
    const r = await anon.rpc("request_parent_escalation", {
      p_booking: "00000000-0000-0000-0000-000000000001",
      p_reason: "other",
      p_note: null,
    });
    assert.ok(r.error);

    const parentClient = await signIn(parent.email, parent.password);
    const set = await parentClient.rpc("set_my_phone", { p_phone: "+15551239999" });
    assert.equal(set.error, null, set.error?.message);
    assert.equal(set.data, "+15551239999");

    const guideClient = await signIn(guideA.email, guideA.password);
    const guidePhone = await guideClient.rpc("set_my_phone", { p_phone: "+15551238888" });
    assert.ok(guidePhone.error);
  });
});
