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

## Not Built Yet

No migrations, RLS policies, or Supabase project have been created in this
phase — this document is the plan those will be built from once a Supabase
project is connected (see `SETUP.md`). We are intentionally not creating
every table now to avoid over-engineering ahead of real requirements
(pricing, booking flow specifics, etc.) from the owner.
