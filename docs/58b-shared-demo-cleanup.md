# 58B — Controlled shared demo/test environment cleanup

Authorized destructive cleanup of the **shared development/testing** Supabase project identified in 58A (`giozoutlnbiqxlvixkho`). Not production. Not live Stripe.

**STOP FOR OWNER REVIEW. DO NOT MERGE.**

## How to run

```bash
CONFIRM=58B-DEMO-CLEANUP node scripts/58b-shared-demo-cleanup.mjs
```

The script refuses unless `CONFIRM=58B-DEMO-CLEANUP` and `NEXT_PUBLIC_SUPABASE_URL` contains the 58A demo project ref. It does not call Stripe, Daily, Resend, or Twilio.

## Environment cleaned

| Item | Value |
| --- | --- |
| Supabase project | `giozoutlnbiqxlvixkho` (shared demo/test) |
| Production database | not touched |
| Live Stripe objects | not deleted, not refunded, not mutated |
| Daily / Resend / Twilio / Vercel | not touched |

## Protected identities

| Role | UUID | Email before | Email after | Role / status |
| --- | --- | --- | --- | --- |
| Admin | `ba9ce5a6-c8c4-403d-87ac-333710dee27b` | `1800sumeet@gmail.com` | `studyhallathome@gmail.com` | admin, same profile, confirmed |
| Parent | `a60dfd6f-3705-457d-8ccc-799fbd010099` | `sksharma86@gmail.com` | unchanged | student, Stripe customer preserved |
| Guide | `a99ec117-3f1d-4c37-8a88-19ff7a057edd` | `halfoffwebhosting@gmail.com` | unchanged | tutor, approved by protected admin |

Admin rename used `auth.admin.updateUserById(uuid, { email, email_confirm: true })`. UUID, profile id, and role were not changed. Auth stores the address lowercase.

`ADMIN_ALERT_EMAIL` is unset in this Cloud environment. Do not change Vercel production env from here.

## Counts

| Metric | Before (58A) | After |
| --- | ---: | ---: |
| Auth users | 273 | **3** |
| profiles | 273 | **3** |
| admins | 19 | **1** |
| student-role profiles | 242 | **1** |
| tutor-role profiles | 12 | **1** |
| tutor_profiles | 20 | **1** (approved) |
| children (`students`) | 81 | **0** |
| bookings | 124 | **0** |
| booking_children | 134 | **0** |
| session_reports | 18 | **0** |
| session_report_children | 16 | **0** |
| recordings | 6 | **0** |
| payments | 23 | **0** |
| minute ledger | 8 | **0** |
| credits | 0 | **0** |
| earnings | 11 | **0** |
| payouts (paid earnings) | 3 | **0** |
| email deliveries | 228 | **0** |
| disputes | 1 | **0** |
| cancel requests | 2 | **0** |
| availability | 65 | **0** |
| availability exceptions | 5 | **0** |
| financial audit | 213 | **0** |
| pending Guide applicants | 4 | **0** |

Disposable Auth users deleted: **270**. One demo admin (`demo.admin…@africantutors.dev`) failed once with “Database error deleting user” and succeeded on retry. No unexpected non-test emails were found.

## Remaining non-zero rows (not operational history)

- `student_profiles` = 2 — leftover signup-trigger rows for the protected Parent and Admin. These are not children.
- `tutor_subjects` = 4 — subject links on the protected Guide profile.
- Catalog: `subjects` 19, `package_products` 5, `compensation_currencies` 5.

## Parent reset

- Children Newer Test and Sam deleted. Zero children remain.
- Local payments, ledgers, bookings, reports, recordings, cancellations, disputes, notification history: **0**
- Prepaid minutes: **0** (`get_customer_balances`)
- Account credit: **0**
- Free trial unused: `account_has_used_free_trial` = **false**
- Stripe Customer `cus_V6qbjS0UCeC97j` preserved on the profile. No refund, no Stripe object delete.
- Display name remains **Test Student 2** (polish later via product UX).

## Guide reset

- Identity and approved tutor profile preserved (`approved_by` = protected Admin).
- Availability option **A**: zero weekly blocks, zero exceptions. Management/Guide UX supports adding hours later (“No weekly hours” / every day Unavailable).
- Earnings / payouts / bookings / reports / cancel history: **0**
- Rate / currency / timezone left as structurally valid values: **30000¢/hour, KES, Africa/Lagos**, display name **Test Tutor 1**.

## Admin / Needs Attention

All zero: Parent wasn't notified, Guide report missing, Pending applicants, Needs a Guide, Open dispute, Recording unavailable, Call Parent failure, Open Guide cancel / coverage.

Management Home shows “Everything is running normally.” Need attention = 0.

## Cron

Vercel crons (`reminders` */15, `release-expired` */5, `recording-retention` daily) still point at this shared project. They were **not** permanently disabled. With zero bookings they no-op. This Cloud env has `CRON_SECRET` unset, so local cron routes return 503. After portal verification, counts stayed at the clean baseline.

## Test-contamination fix

`cleanupAll()` now:

1. Purges RESTRICT dependents for **created test users only**
2. Deletes those Auth users
3. **Throws** with blocker details if Auth delete fails

`createUser` refuses on the canonical demo project unless `ALLOW_DEMO_DB_WRITES=1`. `DEMO_DB_LOCK=1` still refuses even when that opt-in is set.

Do **not** run the full live integration suite against this demo project after cleanup. Dedicated CI Supabase remains the longer-term fix.

## No E2E booking was created

No children added, no booking, no hours purchase, no free-trial consumption, no report, no recording, no Guide earnings.

## Owner next steps

1. Log in as Parent `sksharma86@gmail.com`
2. Add the canonical demo children through the Parent Portal booking “Add a child” path
3. Book the first household Study Hall through the real product UX
4. Optionally polish Guide display name / rate / currency / timezone / availability through Management or Guide UX
5. Optionally set Vercel `ADMIN_ALERT_EMAIL` to `StudyHallAtHome@gmail.com` (do not change production blindly from this PR)
