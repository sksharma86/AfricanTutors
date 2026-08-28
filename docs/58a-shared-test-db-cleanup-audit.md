# 58A — Shared test/demo database cleanup audit

**Status:** AUDIT ONLY. No rows, auth users, roles, emails, balances, bookings, or external objects were created, updated, deleted, truncated, or reset.

**Generated:** 2026-08-28T21:51:51Z via service-role `SELECT` / `auth.admin.listUsers` / `storage.listBuckets` only. Direct Postgres (`SUPABASE_DB_URL`) was unreachable from this environment (IPv6). PostgREST + Auth Admin API succeeded.

**Do not run cleanup from this PR.** Proposed 58B work is a plan, not a script to execute.

Live snapshot: `docs/58a-audit-snapshot/compact-inventory.json` and `docs/58a-audit-snapshot/user-roster.json`.

---

## 1. Confirmation: no data was mutated

- No `INSERT` / `UPDATE` / `DELETE` / `TRUNCATE` / `ALTER` / migrations.
- No `auth.admin.createUser`, `updateUserById`, `deleteUser`.
- No RPCs (`book_session`, `approve_tutor`, ledger adjustments, etc.).
- No Stripe / Daily / Resend / Twilio / Storage object changes.
- Application business logic was not changed.

---

## 2. Protected identities (sacred)

Auth UUID and profile ID are the same value (`profiles.id` references `auth.users.id`). There is no separate “account” table: a parent account **is** the `profiles` row (`role = student`) plus `students` children.

| Role | Email | Auth UUID / profile ID | App role | Display name (current) | Notes |
| --- | --- | --- | --- | --- | --- |
| Admin | `1800sumeet@gmail.com` | `ba9ce5a6-c8c4-403d-87ac-333710dee27b` | `admin` | Sumeet Sharma | Email confirmed. Last sign-in 2026-08-28. No phone. No Stripe customer. No tutor profile. |
| Parent | `sksharma86@gmail.com` | `a60dfd6f-3705-457d-8ccc-799fbd010099` | `student` | Test Student 2 | Email confirmed. Last sign-in 2026-08-28. No phone. Stripe customer `cus_V6qbjS0UCeC97j`. |
| Guide | `halfoffwebhosting@gmail.com` | `a99ec117-3f1d-4c37-8a88-19ff7a057edd` | `tutor` | Test Tutor 1 | Email confirmed. Last sign-in 2026-08-28. `tutor_profiles.status = approved` (2026-08-21, approved_by the protected admin). Rate `30000` cents/hour, currency `KES`, timezone `Africa/Lagos`. |

`StudyHallAtHome@gmail.com` does **not** currently exist as an auth user. Safe to use later as the admin email rename target.

RLS and admin checks use **`profiles.id` / `auth.uid()`**, never email. `public.is_admin(uid)` is:

```sql
select exists (select 1 from public.profiles p where p.id = uid and p.role = 'admin');
```

`profiles` has **no email column**. Login email is read from `auth.users` via `auth.admin.getUserById` (`src/lib/admin-service.ts`, `src/lib/notify.ts`).

---

## 3. Total user / account inventory

| Metric | Count |
| --- | ---: |
| Auth users | 273 |
| Profiles | 273 |
| Auth without profile / profile without auth | 0 / 0 |
| `role = student` (parent-capable) | 242 |
| `role = tutor` | 12 |
| `role = admin` | **19** (1 protected + 18 leftover test/demo admins) |
| `student_profiles` | 253 |
| `tutor_profiles` | 20 |
| Pending Guides | 4 |
| Approved Guides | 12 |
| Suspended (had approval) | 2 |
| Rejected (suspended + `approved_at` null) | 2 |
| Children (`students`) | 81 |
| Orphaned tutor/student profile rows | 0 |

Classification of the **270 non-protected** auth users:

| Class | Count | Meaning |
| --- | ---: | --- |
| test/fake | 266 | `@example.com`, `phase2-*`, `affordance-*`, `mgmt-ux-*` created by live integration tests (`tests/helpers.mjs` `createUser` + `makeAdmin`) |
| unknown → actually demo/test | 4 | See below. Not real customers. |
| potentially real | 0 | None found |
| system-required users | 0 | Catalog data is tables, not users |

The four “unknown” emails (classify as **test/demo — REQUIRES DEPENDENT CLEANUP FIRST**, not real):

| Email | Role | Why it exists |
| --- | --- | --- |
| `demo.admin.17871839018309n6c@africantutors.dev` | admin | Early demo seed “African Tutors Admin” |
| `demo.student.17871839018309n6c@africantutors.dev` | student | Demo parent “Amara's Parent” (1 child, 7 bookings) |
| `demo.tutor.17871839018309n6c@africantutors.dev` | student + suspended tutor | Demo Guide “Mr. Chidi Okeke” (20 bookings as guide; role later stripped) |
| `pr10c.parent.1787690659499@example.test` | student | PR10C portal test “Priya Parent” |

**Keep (catalog, not users):** `subjects` (19), `package_products` (5: 14h/28h active; 10/20/40h inactive), `compensation_currencies` (5).

---

## 4. Operational table inventory

| Table | Rows | FK / ownership | Test-generated? | On protected accounts? | On others? |
| --- | ---: | --- | --- | --- | --- |
| bookings | 124 | `account_id` → profiles CASCADE; `student_id` → students CASCADE; `tutor_id` → profiles SET NULL | Almost all | Parent 31; Guide 14 as tutor | 86 test parents; 7 demo-parent; 56 test guides; 20 demo guide; 34 unassigned |
| booking_children | 134 | booking CASCADE; `student_id` → students **RESTRICT** | Yes | Yes (parent’s children) | Yes |
| session_reports | 18 | booking **RESTRICT**; tutor **RESTRICT**; account **RESTRICT** | Yes | Parent 2; Guide 3 | Yes |
| session_report_children | 16 | report CASCADE; booking CASCADE; student **RESTRICT** | Yes | Likely | Yes |
| session_recordings | 6 | booking CASCADE | Yes | Inspect in 58B | 5 completed, 1 processing; **0 failed** |
| session_presence | 1 | booking CASCADE (PK) | Yes | — | 1 |
| email_deliveries | 228 | account SET NULL; booking SET NULL | Yes | Admin 17; Parent 43; Guide 15 | Rest test. 66 failed, 106 skipped, 55 sent, 1 pending |
| parent_escalation_requests | 0 | booking/tutor/account **RESTRICT** | — | 0 | 0 |
| tutor_cancellation_requests | 2 | booking CASCADE; tutor CASCADE | Yes | Guide 2 (not open) | 0 open |
| disputes | 1 | booking CASCADE; account **RESTRICT** | Yes | 0 | 1 open/under_review |
| refunds | 0 | payment **RESTRICT**; account **RESTRICT** | — | 0 | 0 |
| payments | 23 | account **RESTRICT**; booking SET NULL | Mixed | Parent 4 | 19 test |
| package_minute_ledger | 8 | account **RESTRICT** | Mixed | Parent 4 rows, **net +1260 min** | Other accounts |
| dollar_credit_ledger | 0 | account **RESTRICT** | — | 0 | 0 |
| tutor_earnings | 11 | tutor **RESTRICT**; booking SET NULL | Yes | Guide 1 row, `earned`, 30000 cents | 10 others. 8 earned / 3 paid. Sum 930000 cents |
| stripe_events | 2 | none (Stripe event ids) | Real test-mode webhooks | Tied to parent 28h package | `payment_intent.succeeded`, `checkout.session.completed` |
| financial_audit_log | 213 | actor SET NULL | Yes | Admin actor 8 | Rest test admins |
| students | 81 | account CASCADE | Yes | Parent: “Newer Test”, “Sam” | Rest test |
| tutor_availability | 65 | tutor CASCADE | Yes | Guide 7 (00:30–23:30 every day) | Rest test |
| tutor_availability_exceptions | 5 | tutor CASCADE | Yes | Guide 1 | Rest |
| tutor_subjects | 8 | tutor CASCADE | Yes | Guide 4 | Rest |
| tutor_profiles | 20 | profile CASCADE; `approved_by` → profiles **RESTRICT** (default) | Yes | 1 approved protected Guide | 19 others |

**Bookings by status (all accounts):**

- confirmed + paid: 47
- completed + paid: 41
- cancelled + paid: 17
- expired + awaiting_payment: 6
- free-trial completed/confirmed mix: 9
- other cancelled/refunded/no_show: 4

**Parent Stripe (local only):** one **real Stripe test-mode** 28 Hour Routine purchase (`cs_test_…`, `cus_V6qbjS0UCeC97j`, `$252`, events above). Three other parent payments are local booking rows with `stripe_paid_cents = 0` and no PaymentIntent (package-minute / test fulfillment). **No local `stripe_payment_intent_id` values on any payment.**

Storage: `listBuckets()` returned an empty list. Recordings use Daily (`storage_provider = daily`) — no evidence of app-owned Storage objects that must be deleted first.

---

## 5. Why Management looks dirty

Needs Attention is **computed**, not a table (`src/lib/management-ops.mjs` `collectNeedsAttention` + `currentStudyHallIssues`). Snapshot using that same function:

| Category | Count | Source | Tied to protected? | Verdict |
| --- | ---: | --- | --- | --- |
| Parent wasn't notified | 26 | `email_deliveries.status = failed` on operational/recent bookings. Types: `reminder_1h` (37 raw failures), `guide_report_overdue` (13), `tutor_new_session` (9), plus others | At least 5 notify items on the **protected parent** (test Guides); 1 on the **protected Guide** (test parent) | Test-only contamination. Cron reminders keep re-creating failures against leftover bookings. |
| Guide report missing | 14 | completed Study Halls, no `session_reports` row, ended 24h–14d ago | Sampled items are test/fake | Test leftovers |
| Guide application waiting | 4 | `tutor_profiles.status = pending` | No | Test applicants (PR10D Applicant, Pending Applicant ×2, Jane Wanjiku) |
| Needs a Guide | 1 | open booking with no `tutor_id` — child “Ava”, already started | Not the protected parent in the attention sample | Test leftover |
| Payment / dispute | 1 | `disputes` open/under_review | Not protected parent | Test leftover |
| Guide replacement failed | 0 | no open `tutor_cancellation_requests` | — | Clean |
| Recording unavailable | 0 | no `session_recordings.status = failed` | — | Clean (1 still `processing`) |
| Call Parent / parent not reached | 0 | `parent_escalation_requests` empty | — | Clean |
| Pending payout / earnings noise | not a Needs Attention kind | 11 earnings rows including 3 `paid` | Guide has 1 `earned` 30000¢ | Will still show in Finance / Guide earnings until cleaned |

**Also dirty, but not in that list:** 18 extra **admin** users appear in any admin-user listing; 12 approved test Guides appear on Guides.

Clearing Needs Attention requires removing (or completing) the underlying **bookings / failed emails / pending tutor_profiles / dispute**, then stopping cron from creating new reminder failures during cleanup.

---

## 6. Protected Admin reset plan (`1800sumeet@gmail.com`)

| Data | Action | Why |
| --- | --- | --- |
| Auth UUID, password, sessions | **PRESERVE** | Sacred identity |
| `profiles.role = admin` | **PRESERVE** | Only privilege path |
| `display_name` | **PRESERVE** (or later cosmetic rename) | Real name already |
| Email | **PRESERVE now**; 58B rename separately | See §15 |
| Email delivery history (17 rows) | **DELETE** (optional) | Test/ops noise; not required for login |
| `financial_audit_log` where `actor_id` = admin (8) | **PRESERVE** or **DELETE** | Auditability vs clean demo. Prefer DELETE only if owner accepts losing test-era admin actions |
| `tutor_profiles.approved_by` pointing at this admin | **PRESERVE** on the sacred Guide; retarget/null on disposable Guides before those admins are deleted | Default FK is RESTRICT |

Admin has no children, bookings, payments, phone, or Stripe customer. Low cleanup surface.

---

## 7. Protected Parent reset plan (`sksharma86@gmail.com`)

Current state is **not** a clean demo parent: display name “Test Student 2”, children “Newer Test” / “Sam”, **31 bookings**, free trial **already used**, **1260 prepaid minutes** (~21h leftover from a 28h Stripe test purchase).

| Data | Action | Why |
| --- | --- | --- |
| Auth UUID + `role = student` | **PRESERVE** | Sacred identity; Stripe customer already bound |
| Password / confirmed email | **PRESERVE** | Owner can log in today |
| `display_name` | **RESET** | “Test Student 2” is filming-unsafe |
| `phone_e164` | **RESEED** if Call Parent will be filmed; else leave null | Currently null |
| Children | **DELETE** then **RESEED** up to 3 canonical names | Current names are test leftovers |
| Bookings + booking_children + presence + recordings + reports | **DELETE** (after child FKs) | 31 rows of clutter; 18 still `confirmed` |
| Email deliveries | **DELETE** | 43 rows; several feed Needs Attention |
| Disputes / escalations / refunds | none | Already empty |
| Dollar credits | none | Already 0 |
| Package minute ledger + local payments | **RESET/DELETE** locally | 1260 min will confuse “first hour free” filming. See financial caution |
| Stripe customer `cus_V6qbjS0UCeC97j` | **PRESERVE** externally; optionally update email later | Do **not** delete the Stripe Customer. Local `profiles.stripe_customer_id` should stay unless owner wants a brand-new Stripe customer (then 58B must say so) |
| Free-trial used | **RESET** by removing/cancelling the non-cancelled free-trial booking | `account_has_used_free_trial` is “exists a non-cancelled `is_free_trial` booking”. Unique index `bookings_one_free_trial_per_account` enforces one. |
| Stripe test checkout / PI objects | **PRESERVE** in Stripe | Local payment row can be deleted without deleting Stripe objects. Do not refund/void in Stripe unless owner wants the test dashboard clean too |

**Safer financial path:** delete *local* ledger + payment rows for this account only after dependents are gone; leave the Stripe Customer. Do not “zero” minutes with a compensating ledger insert unless you want an auditable adjustment (`admin_adjust_package_minutes`). For a demo wipe, deleting local ledger rows is cleaner **if** 58B is explicitly approved to discard test financial history.

If local payments are deleted while the Stripe Customer remains, a later real checkout still works (`ensureStripeCustomer` reuses `stripe_customer_id`).

---

## 8. Protected Guide reset plan (`halfoffwebhosting@gmail.com`)

| Data | Action | Why |
| --- | --- | --- |
| Auth UUID + `role = tutor` + `tutor_profiles.status = approved` | **PRESERVE** | Sacred; already approved by protected admin |
| `approved_by` / `approved_at` | **PRESERVE** | Proves approval path |
| `display_name` | **RESET** | “Test Tutor 1” is filming-unsafe |
| `comp_rate_cents_per_hour` / `comp_currency` / `timezone` | **RESET** | 30000¢/hour KES and `Africa/Lagos` look like test defaults, not a filming-ready profile |
| bio / credentials | **RESEED** optional | Currently null |
| Availability | **DELETE** then **RESEED** | 00:30–23:30 every day is test-wide-open |
| Availability exception | **DELETE** | Test leftover |
| tutor_subjects | **PRESERVE** or **RESET** | 4 rows; harmless if subjects stay |
| 14 bookings + reports + emails + 2 cancel requests | **DELETE** | Fake history / Needs Attention |
| 1 earning `earned` 30000¢ | **DELETE** | Fake unpaid earning |
| Paid earnings on *other* test Guides | **DELETE** with those users | Not this identity |

Proposed canonical Guide state (not applied):

- approved, same UUID
- real filming display name
- one hourly rate + correct currency (owner must pick; current 300 KES/hour is probably wrong)
- timezone matching filming (likely `America/Chicago` to match parent children)
- weekday evening windows only
- zero bookings, reports, earnings, payouts, alerts

---

## 9. Other users — deletion classification

| Class | Who | Label |
| --- | --- | --- |
| 266 `@example.com` / phase2 / affordance / mgmt-ux | Live test users, including 17 extra admins and 11 extra approved Guides | **REQUIRES DEPENDENT CLEANUP FIRST** then auth delete |
| 4 `africantutors.dev` / `example.test` demo users | Same | **REQUIRES DEPENDENT CLEANUP FIRST** |
| Catalog tables | subjects, packages, currencies | **SYSTEM REQUIRED — KEEP** |
| Protected 3 | — | **SYSTEM REQUIRED — KEEP** |
| None | — | **SAFE TO DELETE** with zero dependents (almost every disposable user has some child/booking/email/admin-approval edge) |

There is **no** “SAFE TO DELETE” auth user that is guaranteed empty without checking dependents. `cleanupAll()` in tests only calls `auth.admin.deleteUser`, which **fails silently** when RESTRICT FKs remain — that is why 273 users accumulated.

`approved_by` on leftover Guides may point at **test admins**. Those test admins cannot be deleted until `approved_by` is nulled or retargeted (default FK is RESTRICT).

---

## 10. Foreign key / cascade map (practical)

### CASCADE (child dies with parent)

- `auth.users` → `profiles`
- `profiles` → `student_profiles`, `tutor_profiles`, `students`
- `profiles` → `bookings.account_id`, `tutor_availability`, `tutor_availability_exceptions`, `tutor_subjects`, `tutor_cancellation_requests.tutor_id`
- `bookings` → `booking_children`, `session_recordings`, `session_presence`, `disputes`, `tutor_cancellation_requests.booking_id`, `session_report_children.booking_id`

### SET NULL (row remains, link cleared)

- `bookings.tutor_id`
- `payments.booking_id`
- `tutor_earnings.booking_id`
- `email_deliveries.recipient_account_id`, `email_deliveries.booking_id`
- `financial_audit_log.actor_id`
- several `created_by` columns

### RESTRICT / NO ACTION (delete blocked)

| Parent | Child | Risk if ignored |
| --- | --- | --- |
| `profiles` | `payments.account_id` | Auth delete fails; financial rows leftover |
| `profiles` | `package_minute_ledger.account_id` | Same |
| `profiles` | `dollar_credit_ledger.account_id` | Same |
| `profiles` | `tutor_earnings.tutor_id` | Same |
| `profiles` | `session_reports.account_id` / `tutor_id` | Same |
| `bookings` | `session_reports.booking_id` | Cannot delete booking while report exists |
| `students` | `booking_children.student_id` | Cannot delete child while join rows exist |
| `students` | `session_report_children.student_id` | Same |
| `payments` | `refunds.payment_id` | (0 rows now) |
| `profiles` | `refunds.account_id`, `disputes.account_id`, `parent_escalation_requests.*` | Blocks user delete |
| `profiles` | `tutor_profiles.approved_by` | Blocks deleting the approving admin |

**Do not `DELETE … CASCADE` from SQL in 58B without an explicit per-table list.** Auth-user delete already cascades `profiles`, which then tries to cascade bookings, which **hits RESTRICT** on `session_reports` and **RESTRICT** on payments/ledgers/earnings.

### Logical deps (no DB FK)

- Daily `bookings.daily_room_name` — stale room names are harmless locally
- Stripe Customer / Checkout / Event ids — local delete ≠ Stripe delete
- `ADMIN_ALERT_EMAIL` env — not in DB
- Cron (`/api/cron/reminders`, recording retention) — will keep writing if leftover bookings remain

---

## 11. External systems

| System | Coordination? | Notes |
| --- | --- | --- |
| **Stripe** | Coordinate, do not auto-delete | Parent has a real **test-mode** Customer + Checkout Session + 2 webhook events. Deleting local `payments` / `stripe_events` does **not** delete Stripe objects. Do not delete/refund Stripe objects in 58B unless the owner wants the Stripe test dashboard wiped too. |
| **Daily** | No required cleanup | Old `daily_room_name` / recording ids can remain historical. Rooms are created at join time. 6 recording metadata rows; provider is Daily. |
| **Resend** | Local only | `email_deliveries` is the app log. Deleting it does not unsend mail. `RESEND_API_KEY` unset in this Cloud Agent env; production/Vercel may still send. |
| **Twilio** | None | Zero Call Parent rows. |
| **Supabase Storage** | None observed | Empty bucket list; recordings are Daily-hosted. |
| **Supabase Auth** | 58B only, after dependents | `deleteUser` last. Email rename is a separate Auth Admin update. |
| **Vercel** | Config only | After admin email change, set `ADMIN_ALERT_EMAIL` to the new address if used. Currently unset in this environment. |
| **Cron** | Pause during 58B | Reminders created most of the 37 `reminder_1h` failures. Leaving old `confirmed` bookings will refill Needs Attention. |

---

## 12. Can we start from zero?

**Technically yes, but it is harder and riskier than preserving the three UUIDs.**

| Role | Recreate via product? | How |
| --- | --- | --- |
| **Parent** | Yes | Normal `/signup`. Then add children in the Parent Portal. Free trial unused on a new account. |
| **Guide** | Yes | `/guides/apply` (or signup with `requested_role=tutor`) → pending `tutor_profiles` → admin `approve_tutor`. Then set rate, currency, availability in admin/Guide tools. |
| **Admin** | **No product flow** | Signup always inserts `profiles.role = student` (`handle_new_user`). Privilege requires service-role / SQL `UPDATE profiles SET role = 'admin'`. Same as `tests/helpers.mjs` `makeAdmin`. The first admin cannot be born from the UI. |

Why preserving the three identities is safer:

1. Parent already has a Stripe Customer and a known password.
2. Guide is already approved by the real admin (`approved_by` = sacred admin UUID).
3. Admin role already exists; a wipe would require an out-of-band privilege grant before anyone can approve a Guide.
4. Email rename keeps the same UUID, so RLS, `approved_by`, and historical FKs that you choose to keep stay valid.
5. A full wipe still requires the same RESTRICT-aware delete order — it is more work, not less, plus losing the only known-good admin login.

---

## 13. Safest method to change Admin email (do not do this in 58A)

**Goal:** same UUID, same `role = admin`, new login email, no duplicate user.

**Pre-checks**

1. Confirm `StudyHallAtHome@gmail.com` still does not exist (`auth.users.email` unique).
2. Confirm no code hardcodes `1800sumeet@gmail.com` (repo grep: none except this audit).
3. Note `ADMIN_ALERT_EMAIL` is env-only; update Vercel after cutover if it still points at the old inbox.

**Recommended method (service role / Supabase Dashboard Admin API)**

```js
await service.auth.admin.updateUserById("ba9ce5a6-c8c4-403d-87ac-333710dee27b", {
  email: "StudyHallAtHome@gmail.com",
  email_confirm: true, // mark confirmed; do not create a second user
});
```

- `email_confirm: true` tells GoTrue to treat the new address as already confirmed and avoids a pending dual-email state.
- If the project has **Secure email change** enabled, a *user-initiated* change from the client would email **both** old and new addresses. The **Admin API** path above is the one that keeps a single UUID without a self-service confirmation dance.
- Do **not** `inviteUserByEmail` / `createUser` for the new address (that creates a duplicate UUID).
- Do **not** change `profiles.id` or `role`.
- Optional: `auth.admin.listUsers` / Dashboard → confirm `email` updated and `email_confirmed_at` set.
- Owner should sign out/in once with the new email.
- Historical `email_deliveries.to_email` may still show the old address; delete those rows if the inbox history should look clean. They do not affect login or RLS.

**Do not** update email by writing `auth.users` with raw SQL unless Supabase support documents it for this project version; the Admin API updates identities + email fields together.

---

## 14. Recommended canonical demo dataset (not seeded)

**Users (preserve UUIDs)**

- 1 admin — `1800sumeet@gmail.com` now; later `StudyHallAtHome@gmail.com`
- 1 parent — `sksharma86@gmail.com`
- 1 approved Guide — `halfoffwebhosting@gmail.com`

**Children (reseed, up to 3)**

Owner should pick real filming first names. Placeholders if none specified:

1. Ava (grade 5–7)
2. Sam (already exists as a child name — reuse only if that is a real child)
3. Jordan

Timezone: `America/Chicago` (matches current children).

**Guide**

- Display name: owner filming name (replace “Test Tutor 1”)
- Rate/currency: owner must set; do not keep 30000¢ KES / Africa/Lagos unless that is real
- Availability: e.g. Mon–Thu 16:00–20:00 in the filming timezone — not 23-hour test windows
- Zero bookings / earnings / reports

**Parent**

- Display name: owner’s real parent name (replace “Test Student 2”)
- Phone: reseed E.164 if Call Parent will be filmed
- **Free trial unused** (so Dumbo Drop can show “first hour free”)
- **Prepaid:** 0 minutes for a clean “buy hours” story, **or** keep/reseed one unused 14h package if filming must skip Stripe. Current 21h leftover is the wrong middle ground.
- Zero historical Study Halls for the clean Management view
- **Optional later:** one completed canonical household Study Hall (3 children, one report with three sections, one recording) — seed only after E2E succeeds, not in 58B wipe

**Admin Management** after cleanup should show: 0 Needs Attention, 0 pending applicants, 0 disputes, 1 approved Guide, 0 leftover test admins.

---

## 15. Exact proposed 58B cleanup sequence

Owner approval required before any step. No CASCADE “delete from profiles”. No TRUNCATE. No migration replay.

0. **Announce a freeze** on live integration tests against this project (`createUser` / `makeAdmin`). Pause Vercel cron (`reminders`, `release-expired`, `recording-retention`) for the window.
1. Snapshot again (read-only) and confirm the three UUIDs unchanged.
2. **Retarget `tutor_profiles.approved_by`** from disposable admins → protected admin or null.
3. Delete **session_report_children** for disposable + protected-history reports.
4. Delete **session_reports** (RESTRICT unlocks bookings).
5. Delete **session_recordings**, **session_presence**.
6. Delete **disputes**, **tutor_cancellation_requests**, **parent_escalation_requests** (empty/tiny).
7. Delete **email_deliveries** (or only failed/test).
8. Delete **booking_children**.
9. Delete **bookings** (disposable users + protected history).
10. Delete **students** (disposable + protected children).
11. Delete **refunds** (0), then **payments** (local only; leave Stripe objects).
12. Delete **package_minute_ledger** / **dollar_credit_ledger** for those accounts.
13. Delete **tutor_earnings**.
14. Optionally delete **financial_audit_log** test rows and **stripe_events** local webhook log (Stripe objects remain).
15. Delete **tutor_availability** / exceptions / subjects for disposable Guides; reset protected Guide slots.
16. Delete disposable **tutor_profiles** / **student_profiles** if not cascaded yet.
17. **`auth.admin.deleteUser`** for every non-protected auth UUID (after RESTRICT tables are empty). Confirm 3 auth users remain.
18. **Reset protected Parent:** display name, phone, free-trial state, minutes = 0 (or approved reseed).
19. **Reset protected Guide:** display name, rate/currency/timezone, availability, zero earnings.
20. **Reseed** up to 3 children; optional Guide bio.
21. **Admin email rename** via Auth Admin API (`email_confirm: true`). Update `ADMIN_ALERT_EMAIL` if used.
22. Re-enable cron. Verify Management (0 attention), Parent Portal (empty upcoming, unused free hour), Guide (approved, clean schedule).
23. Manual login on both computers before Dumbo Drop.

---

## 16. Risks requiring owner approval

1. **Discarding the parent’s Stripe test 28h purchase locally** while the Stripe Customer/Checkout remain. Recommended, but money-history loss is a product decision.
2. **Resetting free-trial used** so the first hour can be filmed again.
3. **Deleting financial_audit_log** (213 rows, mostly tests).
4. **Deleting 18 extra admin users** (test privilege leftovers). Required for a clean admin world.
5. **Guide compensation rate/currency** — current values look like test data; owner must supply the real rate.
6. **Child names** — “Sam” / “Newer Test” may or may not be real; do not guess on camera.
7. **Stripe dashboard cleanup** (optional, separate from local DB).
8. **Pausing shared-project tests** — until a dedicated test Supabase exists, any `npm test` against this project will refill garbage.

---

## 17. How this got polluted / how to stop it

**Cause:** almost every live `tests/*.test.mjs` file calls `createUser()` against the **shared** project (`@example.com` / `phase2-<timestamp>`). Many call `makeAdmin()`. `cleanupAll()` only does `auth.admin.deleteUser` and **swallows errors**. RESTRICT FKs (payments, reports, ledgers, earnings, `approved_by`) make those deletes fail, so users and bookings accumulate. Cron then fails reminders against those bookings → Needs Attention.

**Recommendations (do not implement in 58A):**

1. **Dedicated automated-test Supabase project** (throwaway). Point CI `SUPABASE_*` there. Never point default `npm test` at the demo project.
2. Fix `cleanupAll()` to delete in the RESTRICT-safe order **or** fail the test when delete fails (stop swallowing).
3. Prefix + allowlist: only `*@example.com` / `*@africantutors.dev` may be deleted by a janitor script; refuse anything else.
4. Deterministic janitor (58C+): read-only dry-run then approved execute, never TRUNCATE.
5. Transaction rollback is **not** available across Auth + multiple SECURITY DEFINER RPCs; don’t rely on it.
6. Separate **demo** vs **staging** vs **CI** environments. Dumbo Drop uses demo only.
7. After 58B, add a smoke test that `auth user count ≤ 3 + catalog` on the demo project (alert, don’t auto-delete).

---

## 18. What this PR contains

- This report
- Read-only snapshot JSON (`docs/58a-audit-snapshot/`)
- No application/runtime code changes
- No migrations
- No SQL to execute

**STOP FOR OWNER REVIEW. DO NOT DELETE OR MODIFY ANY DATA. DO NOT MERGE until the owner accepts the 58B plan.**
