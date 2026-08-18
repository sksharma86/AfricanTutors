# African Tutors — Database Design (Preliminary)

**Status:** Planning document only. No production tables have been created
in this phase. This describes the intended shape of the schema so future
prompts can implement it incrementally without redesigning it each time.

Database: Supabase PostgreSQL. Authentication data (email, password hash,
etc.) lives in Supabase's own `auth.users` table and is treated as
**separate** from platform-visible profile data below — the tables here only
ever reference `auth.users` by ID, never by copying the auth email into
tables that other roles can read.

## Design Principles

- **Separate identity from profile.** `auth.users` (managed by Supabase) is
  never directly exposed to other users. `student_profiles` /
  `tutor_profiles` hold the profile data that's actually safe to show other
  roles (display name, bio, subjects), decoupled from login credentials.
- **No unnecessary cross-role visibility.** A tutor assigned to a booking
  should be able to identify *which* student they're tutoring (via a display
  name / booking reference) without being able to look up that student's
  authentication email or phone number anywhere in the schema.
- **Bookings are the hub.** Payments, video sessions, and recordings all
  hang off a `booking`, not off a direct student↔tutor relationship, so
  every interaction has an auditable, on-platform record.
- **Earnings ≠ payments.** Tracking what a tutor is owed is a distinct
  concern from tracking what/how a student paid.
- **Don't expose raw IDs unnecessarily.** Where users need a reference to
  show in the UI, prefer a short platform-generated public identifier or
  display name over a raw UUID.

## Proposed Entities

### `users` (conceptual — implemented as `auth.users` + a `public.profiles` row)

A thin `public.profiles` table, one row per `auth.users.id`, holding only
data every role is allowed to see about any account: platform role,
display name/public handle, avatar, created_at. Notably **does not**
duplicate the auth email.

| column | notes |
| --- | --- |
| `id` | PK, references `auth.users.id` |
| `role` | `student` \| `tutor` \| `admin`. Set by trusted server logic only. |
| `display_name` | Shown to other users instead of an email address. |
| `avatar_url` | Optional. |
| `created_at` | |

### `student_profiles`

Extra data specific to students. One row per student `profiles.id`.

| column | notes |
| --- | --- |
| `id` / `profile_id` | FK → `profiles.id` |
| `grade_level` | Optional, free-form or enum later. |
| `notes` | Student-visible-only notes/preferences. |

Deliberately does **not** include phone number, billing address, or payment
method — those either don't need to be stored by us (Stripe holds them) or
belong in a table tutors and other students can never query.

### `tutor_profiles`

Extra data specific to tutors. One row per tutor `profiles.id`.

| column | notes |
| --- | --- |
| `id` / `profile_id` | FK → `profiles.id` |
| `status` | `pending` \| `approved` \| `suspended`. Controls whether `role = 'tutor'` actually grants tutor access. Set by an admin. |
| `bio` | Public-facing bio. |
| `credentials` | Free-form for now (e.g. degrees, certifications). |
| `approved_by` | FK → admin `profiles.id`, nullable. |
| `approved_at` | Nullable. |

### `subjects`

Catalog of subjects tutors can teach and students can request.

| column | notes |
| --- | --- |
| `id` | PK |
| `name` | e.g. "Algebra II" |
| `category` | e.g. "Mathematics" |
| `is_active` | Admin-managed. |

### `tutor_subjects`

Join table: which tutors teach which subjects.

| column | notes |
| --- | --- |
| `tutor_id` | FK → `tutor_profiles.id` |
| `subject_id` | FK → `subjects.id` |

### `tutor_availability`

Tutor-declared availability windows, used for future booking/matching.

| column | notes |
| --- | --- |
| `id` | PK |
| `tutor_id` | FK → `tutor_profiles.id` |
| `day_of_week` / `start_time` / `end_time` | Recurring-availability shape (subject to revision once booking logic is designed). |
| `timezone` | |

### `bookings`

The central hub entity.

| column | notes |
| --- | --- |
| `id` | PK |
| `public_reference` | Short platform-generated identifier shown to users instead of the raw `id`. |
| `student_id` | FK → `profiles.id` (role = student) |
| `tutor_id` | FK → `profiles.id` (role = tutor) |
| `subject_id` | FK → `subjects.id` |
| `scheduled_start` | timestamptz |
| `scheduled_end` | timestamptz |
| `duration_minutes` | `30` \| `60`. Booking must support both finalized session lengths. |
| `is_free_trial` | boolean. True for a new student's free 30-minute introductory session. |
| `status` | `requested` \| `confirmed` \| `completed` \| `cancelled` \| `no_show` etc. |
| `payment_id` | FK → `payments.id`, nullable until paid. |
| `video_session_id` | FK → `video_sessions.id`, nullable until a session is created. |
| `created_at` | |

A booking never stores the student's or tutor's contact info directly — it
only references their `profiles.id`.

### `payments`

Payment records tied to a booking, mirroring Stripe objects.

| column | notes |
| --- | --- |
| `id` | PK |
| `booking_id` | FK → `bookings.id` |
| `student_id` | FK → `profiles.id` (for query convenience; still not billing data) |
| `stripe_payment_intent_id` | External reference. |
| `amount` | |
| `currency` | |
| `status` | `pending` \| `succeeded` \| `refunded` \| `failed` |
| `created_at` | |

Tutors are not granted read access to this table beyond, at most, a
derived "paid / not paid" flag on the booking they're assigned to.

### `video_sessions`

One row per live tutoring session tied to a booking.

| column | notes |
| --- | --- |
| `id` | PK |
| `booking_id` | FK → `bookings.id` |
| `twilio_room_sid` | External reference, server-only concern. |
| `started_at` / `ended_at` | |
| `status` | `scheduled` \| `in_progress` \| `ended` |

### `recordings`

| column | notes |
| --- | --- |
| `id` | PK |
| `video_session_id` | FK → `video_sessions.id` |
| `booking_id` | FK → `bookings.id` (denormalized for simpler access-control queries) |
| `storage_path` | Never a public URL by default — access mediated by the app. |
| `duration_seconds` | |
| `created_at` | |

### `tutor_earnings`

| column | notes |
| --- | --- |
| `id` | PK |
| `tutor_id` | FK → `profiles.id` |
| `booking_id` | FK → `bookings.id` |
| `amount` | What the tutor is owed/paid for this booking. |
| `status` | `pending` \| `paid` |
| `paid_at` | Nullable. |

Intentionally separate from `payments` — a tutor's earnings view never needs
to join against student billing data.

### `reviews`

| column | notes |
| --- | --- |
| `id` | PK |
| `booking_id` | FK → `bookings.id` |
| `student_id` | FK → `profiles.id` |
| `tutor_id` | FK → `profiles.id` |
| `rating` | 1–5 |
| `comment` | |
| `created_at` | |

### `admin_settings`

Simple key/value or narrow-column table for platform-wide settings
(feature flags, default session length, etc.), writable only by admins.

### `internal_messages`

On-platform messaging tied to a booking (or a pre-booking conversation), so
students and tutors never need an external channel.

| column | notes |
| --- | --- |
| `id` | PK |
| `booking_id` | FK → `bookings.id`, nullable if pre-booking messaging is later allowed. |
| `sender_id` | FK → `profiles.id` |
| `recipient_id` | FK → `profiles.id` |
| `body` | |
| `created_at` | |
| `flagged` | Boolean, set by future circumvention detection. |

### `circumvention_flags`

Evidence trail for suspected off-platform circumvention attempts, visible
only to admins.

| column | notes |
| --- | --- |
| `id` | PK |
| `message_id` | FK → `internal_messages.id`, nullable (could originate elsewhere later). |
| `booking_id` | FK → `bookings.id`, nullable. |
| `flagged_user_id` | FK → `profiles.id` |
| `reason` | e.g. `phone_number_detected`, `email_detected`, `social_handle_detected`, `payment_handle_detected` |
| `status` | `open` \| `reviewed` \| `dismissed` \| `actioned` |
| `reviewed_by` | FK → admin `profiles.id`, nullable. |
| `created_at` | |

## Relationships at a Glance

```
auth.users 1—1 profiles 1—1 student_profiles
                        1—1 tutor_profiles 1—N tutor_subjects N—1 subjects
                                          1—N tutor_availability

profiles (student) 1—N bookings N—1 profiles (tutor)
bookings 1—1 payments
bookings 1—1 video_sessions 1—N recordings
bookings 1—N tutor_earnings
bookings 1—N reviews
bookings 1—N internal_messages
internal_messages 1—N circumvention_flags
```

### Free-trial tracking (planned)

The finalized business model gives each legitimate new student one free
30-minute introductory session (see `PROJECT_SPEC.md` / `BUSINESS_MODEL.md`).
The data model must eventually answer, per student:

- Whether the student has **claimed** the free trial.
- Whether the free session was **booked** (a `bookings` row with
  `is_free_trial = true`).
- Whether it was **completed** (that booking reaching `status = 'completed'`).
- **Which tutor** conducted it (the booking's `tutor_id`).
- Whether the student **subsequently purchased a paid session** (a later
  `bookings` row with `is_free_trial = false` and a succeeded payment).

Intended shape (to be built in Prompt 3, not now):

- `bookings.is_free_trial` and `bookings.duration_minutes` (added above) carry
  most of this; free-trial status per student is derived from the student's
  bookings rather than duplicated.
- Optionally a narrow `student_profiles.free_trial_claimed_at` timestamp for a
  fast "has this student already used the free trial?" check, set the first time
  a free-trial booking is created.

Keep anti-abuse **simple** at launch: a small amount of free-trial abuse is an
accepted acquisition cost. Do **not** add card verification, fingerprinting, or
invasive surveillance. The above is enough to *measure* abuse and free-trial →
paid conversion before deciding whether any friction is warranted.

## Implemented in Prompt 3A (`supabase/migrations/0002_prompt3_booking.sql`)

The managed booking data model + server functions are now built and live (this
is the foundation stage — booking/tutor/admin UI arrives in Prompts 3B–3D). New
tables (all RLS-enabled):

- **`students`** — the learners. `account_id` → `profiles.id` (parent-first: one
  account may own many students). Holds `full_name`, `grade_level`,
  `school_level`, `school_name`, and IANA `timezone`. RLS: account owner + admin.
- **`subjects`** — admin-managed catalog: `name`, `category`
  (`math|science|english_writing|test_prep|college|other`), `is_active`. RLS:
  everyone reads active subjects; only admins write.
- **`tutor_subjects`** — authoritative per-tutor subject approvals
  (`tutor_id`, `subject_id`). RLS: tutor reads own; **only admins write** (a
  tutor cannot self-approve subjects).
- **`tutor_availability`** — recurring weekly blocks (`day_of_week` 0–6,
  `start_time`, `end_time`) in the tutor's local timezone
  (`tutor_profiles.timezone`, added in this migration). RLS: tutor + admin.
  Guards against zero-length/inverted ranges and duplicates.
- **`tutor_availability_exceptions`** — one-off unavailable windows
  (`starts_at`/`ends_at`, UTC). RLS: tutor + admin.
- **`bookings`** — the hub. UTC `scheduled_start`/`scheduled_end`,
  `duration_minutes` (30/60), `is_free_trial`, `price_cents`, `status`
  (`pending|confirmed|completed|cancelled|no_show`), `payment_status`
  (`not_required|awaiting_payment`), and **privacy-safe denormalized** fields
  (`student_first_name`, `student_grade`, `subject_name`, `tutor_display_name`).
  No email/phone/address/billing anywhere. RLS: account owner reads own; assigned
  tutor reads theirs; admin all; writes via SECURITY DEFINER functions (+ admin).

Constraints/functions:
- `bookings_no_tutor_overlap` — gist exclusion constraint preventing overlapping
  tutor sessions (concurrency-safe double-booking prevention).
- `bookings_one_free_trial_per_student` — partial unique index enforcing one
  non-cancelled free trial per student.
- `create_booking()` — auth + free-trial + pricing + matching + insert (SECURITY
  DEFINER). `get_available_slots()`, `tutor_is_available()`,
  `has_used_free_trial()`, `cancel_booking()`, `set_booking_status()`.

Prompt 3B (`supabase/migrations/0003_prompt3b_booking_engine.sql`, functions
only — no schema changes): `get_available_slots()` gains a configurable
`p_slot_minutes` interval (default 30) and requires the whole duration to fit
inside availability; `create_booking()` repeat-tutor preference now requires a
*completed* prior session with the same student **and same subject** (still
approved/qualified/available). Execute on `get_available_slots`,
`tutor_is_available`, and `has_used_free_trial` is revoked from `public` (anon)
and granted only to `authenticated`/`service_role`.

Prompt 3D (`supabase/migrations/0004_prompt3d_booking_lifecycle.sql`): adds
booking_status value `expired` and column `bookings.payment_hold_expires_at`.
Paid bookings are now created `pending` + `awaiting_payment` with a payment hold
(not `confirmed`); free trials remain `confirmed` + `not_required`. New
`release_expired_holds()` flips timed-out unpaid holds to `expired`; availability
functions ignore expired holds so slots free up. See ARCHITECTURE.md for the full
state machine and the Prompt 4 Stripe handoff contract.

Free-trial conversion + tutor-performance analytics are **derivable** from
`bookings` (is_free_trial, status, completed_at, tutor_id, created_at); the
analytics dashboards themselves are intentionally not built yet.

## Implemented in Phase 4A (`supabase/migrations/0005_phase4a_financial.sql`)

Financial foundation (all money in integer cents; RLS on every table):
- `package_products` (seeded: 600/$190, 1200/$360, 2400/$680), `payments`,
  `package_minute_ledger`, `dollar_credit_ledger`, `tutor_earnings`,
  `stripe_events`, `financial_audit_log`.
- Additive: `profiles.stripe_customer_id` (unique), `tutor_profiles.comp_rate_cents_per_hour`
  (admin-only, guarded).
- Functions: `get_package_minutes`, `get_dollar_credit`,
  `issue/consume/restore_package_minutes`, `issue/consume_dollar_credit`,
  `record_tutor_earning` (rate snapshot; 30-min = 50%; one per booking),
  `admin_set_tutor_rate`, `mark_stripe_event_processed`, `is_financial_actor`.
- Ledgers are the source of truth; balances are SUM-derived. Idempotency via
  unique `reference`/`booking_id`/`stripe_events.id`; consumption uses per-account
  advisory locks. `created_by`/`actor_id` FKs are `ON DELETE SET NULL`.
- Customers/tutors cannot mutate ledgers, set prices, or set pay rates (RLS +
  SECURITY DEFINER functions). Phase 3 booking-state model unchanged.

Phase 4A review fixes (`0006_phase4a_review_fixes.sql`):
- `stripe_events` gains `status` (processing/completed/failed), `attempts`,
  `last_error`, `updated_at`, `completed_at`; new `begin/complete/fail_stripe_event`
  lifecycle replaces `mark_stripe_event_processed` (event completed only after
  fulfillment; failed events retryable; concurrent deliveries → one claims).
- Ledger `reference` is now NOT NULL + non-blank (schema + function validation).
- `record_tutor_earning(booking, reason)` derives tutor + duration from the
  booking (rejects missing booking/tutor/duration); rate snapshot + one-per-booking
  preserved.
- `payments.account_id`, `package_minute_ledger.account_id`,
  `dollar_credit_ledger.account_id`, `tutor_earnings.tutor_id` changed from
  CASCADE to `ON DELETE RESTRICT` so financial history is never destroyed by
  profile deletion.

## Not Built Yet

- Stripe checkout/fulfillment (Phase 4B): the webhook verifies + dedupes events,
  but checkout creation and event→ledger fulfillment handlers are not built.
- Admin financial UI / payout tracking UI (4C); disputes/arbitration (4D).
- Live video (Twilio): `video_sessions`/`recordings` attach to a confirmed
  `booking` later.
- Messaging, reviews, analytics dashboards; promo/referral systems (ledger
  entry types exist as hooks).
