import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";

import {
  RECORDING_RETENTION_DAYS,
  computeRetentionUntil,
  formatAvailableUntil,
  isDueForRetentionDeletion,
  isRecordingPlayable,
  isRetentionExpired,
} from "../src/lib/recording-retention.mjs";
import {
  adminClient,
  cleanupAll,
  createUser,
  hasSupabaseEnv,
  makeAdmin,
  signIn,
} from "./helpers.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Study Hall PR9 — retention policy (pure)", () => {
  it("authoritative retention is exactly 60 days from ready time", () => {
    assert.equal(RECORDING_RETENTION_DAYS, 60);
    const ready = "2026-08-25T12:00:00.000Z";
    const until = computeRetentionUntil(ready);
    assert.equal(until.toISOString(), "2026-10-24T12:00:00.000Z");
  });

  it("playable only when completed, not deleted, not past retention", () => {
    const base = {
      status: "completed",
      daily_recording_id: "rec-1",
      retention_until: "2099-01-01T00:00:00.000Z",
      deleted_at: null,
    };
    assert.equal(isRecordingPlayable(base), true);
    assert.equal(isRecordingPlayable({ ...base, status: "failed" }), false);
    assert.equal(isRecordingPlayable({ ...base, deleted_at: "2026-01-01T00:00:00.000Z" }), false);
    assert.equal(isRecordingPlayable({ ...base, retention_until: "2020-01-01T00:00:00.000Z" }), false);
    assert.equal(isRecordingPlayable({ ...base, daily_recording_id: null }), false);
  });

  it("retention cron selects only expired completed undeleted rows", () => {
    const now = Date.parse("2026-10-25T00:00:00.000Z");
    assert.equal(
      isDueForRetentionDeletion(
        {
          status: "completed",
          daily_recording_id: "x",
          retention_until: "2026-10-24T12:00:00.000Z",
          deleted_at: null,
        },
        now,
      ),
      true,
    );
    assert.equal(
      isDueForRetentionDeletion(
        {
          status: "completed",
          daily_recording_id: "x",
          retention_until: "2026-10-26T12:00:00.000Z",
          deleted_at: null,
        },
        now,
      ),
      false,
      "does not delete before 60 days",
    );
    assert.equal(
      isDueForRetentionDeletion(
        {
          status: "completed",
          daily_recording_id: "x",
          retention_until: "2026-10-24T12:00:00.000Z",
          deleted_at: "2026-10-24T13:00:00.000Z",
        },
        now,
      ),
      false,
    );
  });

  it("formatAvailableUntil is parent-friendly", () => {
    const label = formatAvailableUntil("2026-10-24T12:00:00.000Z", "UTC");
    assert.match(label, /Oct/);
    assert.match(label, /24/);
  });

  it("isRetentionExpired boundary", () => {
    const t = Date.parse("2026-10-24T12:00:00.000Z");
    assert.equal(isRetentionExpired("2026-10-24T12:00:00.000Z", t), true);
    assert.equal(isRetentionExpired("2026-10-24T12:00:01.000Z", t), false);
  });
});

describe("Study Hall PR9 — architecture source contracts", () => {
  it("migration 0025 stamps retention, deleted_at, parent RLS, mark deleted RPCs", () => {
    const m = read("supabase/migrations/0025_studyhall_pr9_recording_retention.sql");
    assert.match(m, /deleted_at/);
    assert.match(m, /deletion_error/);
    assert.match(m, /interval '60 days'/);
    assert.match(m, /retention_until = coalesce\(public\.session_recordings\.retention_until/);
    assert.match(m, /mark_recording_deleted/);
    assert.match(m, /mark_recording_deletion_failed/);
    assert.match(m, /session_recordings_select/);
    assert.match(m, /b\.account_id = auth\.uid\(\)/);
    assert.match(m, /share_token/);
    assert.doesNotMatch(m, /0024_studyhall/);
  });

  it("does not edit applied migrations 0024 or earlier recording schema file contents for PR9 columns", () => {
    const old = read("supabase/migrations/0014_phase5b_recording.sql");
    assert.doesNotMatch(old, /deleted_at/);
    assert.doesNotMatch(old, /interval '60 days'/);
  });

  it("Daily client deletes recordings; access links remain short-lived", () => {
    const client = read("src/lib/daily/client.ts");
    assert.match(client, /deleteDailyRecording/);
    assert.match(client, /method: "DELETE"/);
    assert.match(client, /getRecordingAccessLink/);
    assert.match(client, /access-link/);
  });

  it("parent + admin access routes authorize server-side; Guides have no historical access API", () => {
    const parent = read("src/app/api/recording/access/route.ts");
    const admin = read("src/app/api/admin/recording/access/route.ts");
    const access = read("src/lib/recording-access.ts");
    assert.match(parent, /mintAuthorizedRecordingAccess/);
    assert.match(parent, /asAdmin: false/);
    assert.match(admin, /asAdmin: true/);
    assert.match(access, /account_id !== opts\.userId/);
    assert.match(access, /Recording expired/);
    assert.match(access, /isRecordingPlayable/);
    // No guide recording access route
    try {
      read("src/app/api/tutor/recording/access/route.ts");
      assert.fail("Guide recording access must not exist");
    } catch (e) {
      assert.equal(e.code, "ENOENT");
    }
  });

  it("retention cron uses CRON_SECRET and does not disrupt reminders cron", () => {
    const cron = read("src/app/api/cron/recording-retention/route.ts");
    assert.match(cron, /CRON_SECRET/);
    assert.match(cron, /deleteDailyRecording/);
    assert.match(cron, /mark_recording_deleted/);
    assert.match(cron, /notifyRecordingDeletionFailure/);
    assert.match(cron, /isDueForRetentionDeletion/);
    const reminders = read("src/app/api/cron/reminders/route.ts");
    assert.match(reminders, /reminder1hWindow/);
    const v = JSON.parse(read("vercel.json"));
    assert.ok(v.crons.some((c) => c.path === "/api/cron/reminders" && c.schedule === "*/15 * * * *"));
    assert.ok(v.crons.some((c) => c.path === "/api/cron/recording-retention" && c.schedule === "0 9 * * *"));
  });

  it("webhook still verifies HMAC and upserts recording.ready-to-download / recording.error", () => {
    const wh = read("src/app/api/daily/webhook/route.ts");
    assert.match(wh, /x-webhook-signature/);
    assert.match(wh, /recording\.ready-to-download/);
    assert.match(wh, /recording\.error/);
    assert.match(wh, /record_recording_event/);
    assert.match(wh, /roomToBooking/);
    assert.match(wh, /notifyRecordingFailure/);
  });

  it("parent session reports UX includes recording block; legal copy mentions 60 days", () => {
    const list = read("src/components/dashboard/session-reports-list.tsx");
    assert.match(list, /Session recording/);
    assert.match(list, /Available for 60 days/);
    assert.match(list, /WatchRecordingButton/);
    assert.match(list, /Recording expired|Recording unavailable/);
    const privacy = read("src/app/(marketing)/privacy/page.tsx");
    const terms = read("src/app/(marketing)/terms/page.tsx");
    assert.match(privacy, /60 days/);
    assert.match(terms, /60 days/);
    assert.match(privacy, /attorney review/i);
  });

  it("PR8 notification architecture and reminder cron remain intact", () => {
    const notify = read("src/lib/notify.ts");
    assert.match(notify, /shouldSendReminder/);
    assert.match(notify, /reminder-1h-sms:/);
    assert.match(notify, /notifyRecordingDeletionFailure/);
    const reminders = read("src/app/api/cron/reminders/route.ts");
    assert.match(reminders, /\/api\/cron\/reminders|notifyReminder/);
  });

  it("Daily cloud remains default; S3 stays optional", () => {
    const cfg = read("src/lib/daily/config.ts");
    assert.match(cfg, /recordingBucketConfig/);
    assert.match(cfg, /Mode A|Daily-managed|DAILY_S3/);
    const client = read("src/lib/daily/client.ts");
    assert.match(client, /enable_recording: "cloud"/);
  });

  it("pricing / free session / Call Parent / prepaid UX unchanged in spirit", () => {
    const pkg = read("src/lib/packages.mjs");
    assert.match(pkg, /14000|25200|840|1680/);
    assert.match(read("supabase/migrations/0021_studyhall_pr3_one_hour_free_trial.sql"), /is_free_trial/);
    assert.match(read("supabase/migrations/0024_studyhall_pr7_call_parent.sql"), /parent_escalation_requests/);
    assert.match(read("src/lib/booking-prepaid-display.mjs"), /prepaidCoversDuration/);
    assert.match(read("src/lib/notifications/reassignment-policy.mjs"), /successful_internal/);
  });
});

describe("Study Hall PR9 — live recording retention + IDOR (requires migration 0025)", {
  skip: !hasSupabaseEnv,
}, () => {
  const svc = adminClient();
  let parentA;
  let parentB;
  let guide;
  let admin;
  let pr9 = false;
  const accounts = [];

  async function detectPr9() {
    const { error } = await svc.from("session_recordings").select("deleted_at, retention_until").limit(1);
    return !error;
  }

  async function approveGuide(id) {
    await svc.from("tutor_profiles").upsert({
      profile_id: id,
      status: "approved",
      timezone: "UTC",
      bio: "PR9 guide",
    });
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

  // Shared Guide calendar is protected by bookings_no_tutor_overlap. Each
  // insert must use a unique non-overlapping window — do not reuse Date.now()-2h.
  let bookingSeq = 0;
  async function insertBooking({ accountId, tutorId, studentId }) {
    bookingSeq += 1;
    // Deterministic past slots (one calendar day apart) so sequential tests in
    // this suite never collide, independent of wall-clock timing.
    const start = new Date(Date.UTC(2019, 0, bookingSeq, 14, 0, 0));
    const end = new Date(start.getTime() + 3600_000);
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
        status: "completed",
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
    parentA = await createUser({ requestedRole: "student", displayName: "PR9 Parent A" });
    parentB = await createUser({ requestedRole: "student", displayName: "PR9 Parent B" });
    guide = await createUser({ requestedRole: "tutor", displayName: "PR9 Guide" });
    admin = await createUser({ requestedRole: "student", displayName: "PR9 Admin" });
    accounts.push(parentA.id, parentB.id, guide.id, admin.id);
    await makeAdmin(admin.id);
    await approveGuide(guide.id);
    pr9 = await detectPr9();
  });

  after(async () => {
    for (const acc of accounts) {
      const { data: bks } = await svc.from("bookings").select("id").eq("account_id", acc);
      const ids = (bks ?? []).map((b) => b.id);
      if (ids.length) {
        await svc.from("session_recordings").delete().in("booking_id", ids);
        await svc.from("session_reports").delete().in("booking_id", ids);
        await svc.from("bookings").delete().in("id", ids);
      }
      await svc.from("students").delete().eq("account_id", acc);
    }
    await cleanupAll();
  });

  it("webhook-style upsert stamps retention_until and is idempotent", async (t) => {
    if (!pr9) {
      t.skip("migration 0025 not applied");
      return;
    }
    const stu = await newStudent(parentA.id, "Maya A");
    const bookingId = await insertBooking({ accountId: parentA.id, tutorId: guide.id, studentId: stu });
    const dailyId = `pr9-rec-${bookingId.slice(0, 8)}`;
    const completedAt = "2026-08-25T12:00:00.000Z";
    const first = await svc.rpc("record_recording_event", {
      p_booking: bookingId,
      p_status: "completed",
      p_recording_id: dailyId,
      p_room_name: `at-${bookingId.replace(/-/g, "")}`,
      p_completed_at: completedAt,
      p_duration: 3600,
    });
    assert.equal(first.error, null, first.error?.message);
    const second = await svc.rpc("record_recording_event", {
      p_booking: bookingId,
      p_status: "completed",
      p_recording_id: dailyId,
      p_room_name: `at-${bookingId.replace(/-/g, "")}`,
      p_completed_at: "2026-08-26T12:00:00.000Z",
      p_duration: 3600,
    });
    assert.equal(second.error, null, second.error?.message);
    assert.equal(first.data, second.data, "duplicate webhook does not create a second row");

    const { data: rows, count } = await svc
      .from("session_recordings")
      .select("id, retention_until, status", { count: "exact" })
      .eq("daily_recording_id", dailyId);
    assert.equal(count, 1);
    assert.equal(rows[0].status, "completed");
    assert.equal(new Date(rows[0].retention_until).toISOString(), "2026-10-24T12:00:00.000Z");
  });

  it("Parent A can read own recording; Parent B and Guide cannot (IDOR)", async (t) => {
    if (!pr9) {
      t.skip("migration 0025 not applied");
      return;
    }
    const stuA = await newStudent(parentA.id, "Maya IDOR");
    const bookingA = await insertBooking({ accountId: parentA.id, tutorId: guide.id, studentId: stuA });
    const dailyId = `pr9-idor-${bookingA.slice(0, 8)}`;
    const { data: recId } = await svc.rpc("record_recording_event", {
      p_booking: bookingA,
      p_status: "completed",
      p_recording_id: dailyId,
      p_completed_at: new Date().toISOString(),
    });

    const aClient = await signIn(parentA.email, parentA.password);
    const bClient = await signIn(parentB.email, parentB.password);
    const gClient = await signIn(guide.email, guide.password);
    const adminClientSigned = await signIn(admin.email, admin.password);

    const aSee = await aClient.from("session_recordings").select("id, booking_id").eq("id", recId);
    assert.equal((aSee.data ?? []).length, 1, "Parent A sees own recording");

    const bSee = await bClient.from("session_recordings").select("id").eq("id", recId);
    assert.equal((bSee.data ?? []).length, 0, "Parent B cannot see Parent A recording");

    const gSee = await gClient.from("session_recordings").select("id").eq("id", recId);
    assert.equal((gSee.data ?? []).length, 0, "Guide cannot see historical recording via RLS");

    const admSee = await adminClientSigned.from("session_recordings").select("id").eq("id", recId);
    assert.equal((admSee.data ?? []).length, 1, "admin can see recording");

    // Sensitive columns not granted to authenticated
    const leak = await aClient.from("session_recordings").select("share_token, error_message").eq("id", recId);
    assert.ok(leak.error || !leak.data?.[0]?.share_token);
  });

  it("mark_recording_deleted is idempotent; expired/deleted not playable", async (t) => {
    if (!pr9) {
      t.skip("migration 0025 not applied");
      return;
    }
    const stu = await newStudent(parentA.id, "Del Kid");
    const bookingId = await insertBooking({ accountId: parentA.id, tutorId: guide.id, studentId: stu });
    const { data: recId } = await svc.rpc("record_recording_event", {
      p_booking: bookingId,
      p_status: "completed",
      p_recording_id: `pr9-del-${bookingId.slice(0, 8)}`,
      p_completed_at: "2020-01-01T00:00:00.000Z",
    });
    const { data: before } = await svc.from("session_recordings").select("*").eq("id", recId).single();
    assert.equal(isDueForRetentionDeletion(before), true);

    await svc.rpc("mark_recording_deleted", { p_id: recId, p_clear_error: true });
    await svc.rpc("mark_recording_deleted", { p_id: recId, p_clear_error: true });
    const { data: after } = await svc.from("session_recordings").select("deleted_at").eq("id", recId).single();
    assert.ok(after.deleted_at);
    assert.equal(isRecordingPlayable({ ...before, deleted_at: after.deleted_at }), false);
  });

  it("failed provider deletion stays retryable (deleted_at remains null)", async (t) => {
    if (!pr9) {
      t.skip("migration 0025 not applied");
      return;
    }
    const stu = await newStudent(parentA.id, "Retry Kid");
    const bookingId = await insertBooking({ accountId: parentA.id, tutorId: guide.id, studentId: stu });
    const { data: recId } = await svc.rpc("record_recording_event", {
      p_booking: bookingId,
      p_status: "completed",
      p_recording_id: `pr9-retry-${bookingId.slice(0, 8)}`,
      p_completed_at: "2020-01-01T00:00:00.000Z",
    });
    await svc.rpc("mark_recording_deletion_failed", { p_id: recId, p_error: "daily 500 boom" });
    const { data: row } = await svc
      .from("session_recordings")
      .select("deleted_at, deletion_error, retention_until, status, daily_recording_id")
      .eq("id", recId)
      .single();
    assert.equal(row.deleted_at, null);
    assert.match(row.deletion_error, /boom/);
    assert.equal(isDueForRetentionDeletion(row), true, "still selected on next cron");
  });

  it("session report path is independent of recording failure", async (t) => {
    if (!pr9) {
      t.skip("migration 0025 not applied");
      return;
    }
    // Recording failure must not block report presence in schema / product.
    const reports = read("src/app/api/tutor/session-report/route.ts");
    assert.match(reports, /submit_session_report/);
    assert.doesNotMatch(reports, /session_recordings/);
    const list = read("src/components/dashboard/session-reports-list.tsx");
    assert.match(list, /Recording unavailable/);
  });
});
