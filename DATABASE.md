# African Tutors — Database Design

**Status:** `profiles`, `student_profiles`, `tutor_profiles`, `subjects`,
and `tutor_profile_subjects` are implemented as real migrations in
`supabase/migrations/`, with Row Level Security enabled and tested (see
"Row Level Security Policies (Implemented)" below). `bookings`, `payments`,
`video_sessions`, `recordings`, `tutor_earnings`, `reviews`,
`admin_settings`, `internal_messages`, and `circumvention_flags` remain
planning-only — not yet built, deliberately, until the features that need
them (booking, payments, video) are actually being built.

Database: Supabase PostgreSQL. Authentication data (email, password hash,
etc.) lives in Supabase's own `auth.users` table and is treated as
**separate** from platform-visible profile data below — the tables here only
ever reference `auth.users` by ID, never by copying the auth email into
tables that other roles can read. `authenticated` and `anon` are never
granted any privilege on `auth.users` itself, so there is no query path —
even a misconfigured one — from a tutor to a student's authentication email
or vice versa. This has been verified with an automated test; see below.

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

## Implemented Entities

The tables below exist for real (see `supabase/migrations/`) and have Row
Level Security enabled with the policies described in "Row Level Security
Policies (Implemented)" further down.

### `profiles` (implemented)

A thin table, one row per `auth.users.id`, holding only data every role is
allowed to see about any account: platform role, display name, avatar,
timestamps. Notably **does not** duplicate the auth email or any other
private contact info.

| column | notes |
| --- | --- |
| `id` | PK, references `auth.users.id` |
| `role` | `student` \| `tutor` \| `admin`. Set only by the `handle_new_user()` trigger at signup, or directly by the project owner via SQL for the very first admin (see `SETUP.md`). Never grantable to `authenticated` for UPDATE — no client request can change it. |
| `display_name` | Shown to other users instead of an email address. |
| `avatar_url` | Optional. |
| `created_at` / `updated_at` | Maintained automatically. |

### `student_profiles` (implemented)

Extra data specific to students. One row per student `profiles.id`, created
automatically by the same signup trigger.

| column | notes |
| --- | --- |
| `id` | PK, FK → `profiles.id` |
| `grade_level` | Optional, free-form for now. |
| `notes` | Student-visible-only notes/preferences. |
| `created_at` / `updated_at` | Maintained automatically. |

Deliberately does **not** include phone number, billing address, or payment
method — those either don't need to be stored by us (Stripe will hold them
once payments ship) or belong in a table tutors and other students can
never query. Nothing here is collected until there's a real feature that
needs it.

### `tutor_profiles` (implemented)

Extra data specific to tutors. One row per tutor `profiles.id`, created
automatically (with `status = 'pending'`) the moment someone signs up
requesting the tutor path — signing up never grants approved access by
itself.

| column | notes |
| --- | --- |
| `id` | PK, FK → `profiles.id` |
| `status` | `pending` \| `approved` \| `rejected` \| `suspended`. Controls whether this account actually has approved tutor access. The only way this column changes is the `admin_set_tutor_status(...)` function, which itself checks the caller is an admin. |
| `headline`, `bio`, `education`, `years_experience`, `application_notes`, `submitted_at` | Tutor-editable "application" fields — the tutor can update these themselves at any time (column-level grant), regardless of status. |
| `admin_notes` | Private administrative notes about the applicant. **Never** granted to `authenticated` for UPDATE, and never shown to the tutor or to students in the UI — admin-only. |
| `approved_by`, `approved_at`, `status_updated_at` | Set automatically by `admin_set_tutor_status(...)`; never directly writable by any client. |
| `created_at` / `updated_at` | Maintained automatically. |

### `subjects` (implemented)

Small preliminary catalog of subjects, seeded with common subjects so the
tutor application form has real choices. Public read-only data — not
sensitive.

| column | notes |
| --- | --- |
| `id` | PK |
| `name` | e.g. "Mathematics" (unique) |
| `category` | e.g. "STEM" |
| `is_active` | Admin-managed (no admin UI for this yet — direct SQL for now). |

### `tutor_profile_subjects` (implemented)

Join table: which subjects a tutor applied to teach. A tutor can only
insert/delete rows for their own `tutor_id`.

| column | notes |
| --- | --- |
| `tutor_id` | FK → `tutor_profiles.id` |
| `subject_id` | FK → `subjects.id` |
| `created_at` | |

## Planned Entities (not yet built)

Everything below is still just a plan, to be implemented when the feature
that needs it is actually being built (booking, payments, video). Nothing
here exists as a real table yet.

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
auth.users 1—1 profiles 1—1 student_profiles                [implemented]
                        1—1 tutor_profiles 1—N tutor_profile_subjects N—1 subjects  [implemented]
                                          1—N tutor_availability             [planned]

profiles (student) 1—N bookings N—1 profiles (tutor)          [planned]
bookings 1—1 payments                                          [planned]
bookings 1—1 video_sessions 1—N recordings                     [planned]
bookings 1—N tutor_earnings                                    [planned]
bookings 1—N reviews                                           [planned]
bookings 1—N internal_messages                                 [planned]
internal_messages 1—N circumvention_flags                      [planned]
```

## Row Level Security Policies (Implemented)

RLS is enabled on every implemented table
(`supabase/migrations/20260816000000_roles_and_profiles.sql`). Policies are
combined with **column-level `GRANT`s** for defense in depth — RLS decides
which *rows* a role can see/touch; grants decide which *columns* it can
write at all, regardless of RLS.

| Table | Who can SELECT | Who can UPDATE (and which columns) |
| --- | --- | --- |
| `profiles` | The row's own owner, or an admin | Owner: `display_name`, `avatar_url` only. Admin: any column (via RLS; no `authenticated` grant makes `role` writable by anyone, including admins, through the normal client — the very first admin is set directly via SQL, see `SETUP.md`). |
| `student_profiles` | Owner, or admin | Owner: `grade_level`, `notes`. |
| `tutor_profiles` | Owner, or admin | Owner: `headline`, `bio`, `education`, `years_experience`, `application_notes`, `submitted_at` only. `status`, `admin_notes`, `approved_by`, `approved_at`, `status_updated_at` are not grantable to `authenticated` at all — the only way they change is `admin_set_tutor_status(...)`. |
| `subjects` | Everyone (active subjects), admin (all) | Not writable by `authenticated` yet (no subject management UI exists). |
| `tutor_profile_subjects` | Owning tutor, or admin | Owning tutor can insert/delete their own rows. |

Notably, **no policy grants a tutor read access to any student's `profiles`
or `student_profiles` row, or vice versa** — there is no booking
relationship yet that would justify it. When booking ships, a new,
narrowly-scoped policy will be added (e.g. "a tutor may see the display
name of a student they have a confirmed booking with") rather than opening
these tables up broadly.

`public.is_admin(uid uuid default auth.uid())` is a `SECURITY DEFINER`
helper used inside these policies so they can check "is this caller an
admin?" without recursively re-evaluating `profiles`' own RLS.

`public.admin_set_tutor_status(target_tutor_id, new_status, note)` is the
only way `tutor_profiles.status` (and its approval metadata) can change. It
is `SECURITY DEFINER`, checks `is_admin()` internally, and can safely be
`GRANT EXECUTE`'d to every authenticated user — a non-admin calling it
simply gets an authorization error back.

## Anti-Poaching Verification

The core requirement from this phase — *"an approved tutor should NOT be
able to retrieve a student's private authentication email merely because
the tutor has application access, and a student should NOT be able to
retrieve private tutor contact information"* — is verified by an automated
test suite, not just by inspection:

- `supabase/tests/` bootstraps a throwaway local PostgreSQL database to
  behave like a Supabase project (Supabase's `auth.users` table shape, the
  `anon`/`authenticated` roles, and the real `auth.uid()` contract used by
  `request.jwt.claims`), applies the **actual** migration files from
  `supabase/migrations/` unmodified, seeds two students, two tutor
  applicants, and one admin, and then runs 12 assertions as those specific
  users (via `SET ROLE` + `SET request.jwt.claims`, exactly like
  PostgREST/Supabase would for a real request).
- Run it yourself with `npm run test:rls` (requires a local PostgreSQL
  server; see the script for details). All 12 currently pass, including:
  - An approved tutor querying `profiles`/`student_profiles` for either
    student returns **zero rows**.
  - A student querying `tutor_profiles` for either tutor returns **zero
    rows**.
  - Any `authenticated` (or `anon`) request to `auth.users` directly is
    rejected with a permission error — there is no path to another user's
    authentication email even if every policy above were misconfigured.
  - A pending tutor cannot approve themselves, and cannot `UPDATE` their
    own `status` column directly (only `admin_set_tutor_status(...)` can).
  - A student cannot `UPDATE` their own `role` column to `admin`.
  - An admin can see and act on tutor applications; a non-admin cannot.
- This is a local approximation good enough for fast, offline regression
  testing of the actual policy/grant logic — it is **not** a substitute for
  a final smoke test against a real, connected Supabase project (see
  `SETUP.md`).

## Implementation Status

`profiles`, `student_profiles`, `tutor_profiles`, `subjects`, and
`tutor_profile_subjects` exist as real migrations with tested RLS. No
Supabase *project* has been connected yet in this environment — see
`SETUP.md` for what's needed from the owner to apply these migrations to a
live project. Everything under "Planned Entities" above is intentionally
still just a plan, to avoid over-engineering ahead of real requirements
(booking flow specifics, pricing, etc.) from the owner.
