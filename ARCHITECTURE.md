# African Tutors — Architecture

This document describes the technical architecture established during
Phase 1 (project foundation). It will grow as booking, payments, video, and
messaging are built in later phases.

## Overall Application Architecture

African Tutors is a single Next.js application (App Router) that serves:

- Public marketing pages (home, how it works, pricing, about, contact)
- Authentication pages (login, signup)
- Role-scoped dashboards (student, tutor, admin) under `/dashboard/*`
- Server-side API routes (`/api/*`) for logic that must not run in the
  browser (e.g. anything touching secrets, or future Stripe/Twilio calls)

It talks to:

- **Supabase** for authentication and PostgreSQL data storage
- **Stripe** (future) for payments
- **Twilio Video** (future) for live tutoring sessions
- A transactional email provider (future) for verification, password reset,
  and notification emails

It is deployed on **Vercel** as a responsive web app that targets desktop,
laptop, tablet, and mobile browsers (iOS Safari, Android Chrome) — there is
no native mobile app.

## Frontend Structure

```
src/
  app/                    App Router routes (pages, layouts, API routes)
    (marketing pages)     /, /how-it-works, /pricing, /about, /contact
    login/, signup/       Auth pages
    dashboard/
      student/, tutor/, admin/   Role-scoped dashboard placeholders
    api/                  Route handlers (server-only logic)
  components/
    ui/                   Small generic building blocks (Button, Container, Badge)
    layout/                Navbar, Footer, mobile menu
    marketing/             Homepage/marketing sections (Hero, FeatureGrid, Steps, CTA)
    auth/                   Login/signup forms and auth UI
    dashboard/              Dashboard shell and widgets
  lib/
    supabase/               Supabase client/server factories + config
    roles.ts                 Role types and role → dashboard path mapping
    constants.ts              Site-wide constants (nav links, site name)
  middleware.ts              Session refresh + future route protection
```

Components are intentionally split into small, reusable pieces (e.g.
`FeatureGrid`, `Steps`, `CtaSection`, `DashboardShell`) so future pages can be
assembled from existing building blocks instead of duplicating markup.

## Backend Strategy

There is no separate backend service in this phase. Server-side logic lives
in:

- **Next.js Route Handlers** (`src/app/api/**/route.ts`) for server-only
  operations (e.g. the contact form handler today; Stripe webhooks and
  Twilio token minting in later phases).
- **Supabase** (PostgreSQL + Row Level Security) as the system of record.
  Business rules that must be trustworthy (e.g. "a tutor can only see
  bookings assigned to them") will be enforced with RLS policies and/or
  `SECURITY DEFINER` database functions, not just application code.

This keeps the architecture simple while still giving us a clear place to
enforce authorization on the server, which is required by the anti-poaching
requirement (tutors and students should never be able to bypass access rules
just because the UI hides a button).

## Authentication Strategy

Authentication uses **Supabase Auth** with the `@supabase/ssr` package,
which is the current recommended pattern for Next.js App Router:

- `src/lib/supabase/client.ts` — browser client for Client Components
- `src/lib/supabase/server.ts` — server client for Server Components, Route
  Handlers, and Server Actions (reads/writes the session via cookies)
- `src/middleware.ts` — refreshes the session cookie on every request and is
  the seam where future server-enforced route protection will be added

Planned auth flows (email/password to start):

- **Registration** — email + password. Signup lets a visitor indicate
  whether they want to learn (student) or apply to teach (tutor), but this
  is only a *request*, stored as `requested_role` in Supabase Auth user
  metadata. It does not itself grant any privileged access.
- **Email verification** — required before full access, using Supabase's
  built-in email confirmation flow.
- **Password reset** — via Supabase's password recovery flow.
- **Session management** — handled by Supabase Auth cookies, refreshed by
  the middleware above.

Until real Supabase credentials are configured (see `SETUP.md`), the app
detects this via `isSupabaseConfigured` and renders login/signup forms in a
disabled "not configured yet" state rather than crashing, and the middleware
skips auth checks entirely. This keeps the foundation runnable and testable
before a Supabase project exists, and turns on automatically once
credentials are supplied — no code changes needed.

### Why role assignment is not client-controlled

Nothing in the client can set a user's authoritative role. Authoritative
role/authorization data will live in Postgres (see `DATABASE.md`), controlled
by:

- A default `student` role granted on verified signup.
- `tutor` access gated behind an admin-approved `tutor_profiles.status`
  (e.g. `pending` → `approved`), set only by an administrator action running
  with elevated (server-side) privileges.
- `admin` accounts provisioned directly by the platform owner/engineering
  team (e.g. via the Supabase dashboard or a trusted internal script), never
  through public signup.

## Database Strategy

Supabase PostgreSQL is the single system of record. See `DATABASE.md` for
the preliminary schema. Key principles carried into the schema design:

- Supabase Auth's `auth.users` table (which holds login email, password
  hash, etc.) is kept separate from platform-visible profile data. Public,
  cross-role visible information (display name, subjects, etc.) lives in
  `student_profiles` / `tutor_profiles`, not in the auth table.
- Row Level Security will restrict which rows a student, tutor, or admin can
  read/write once real tables are created.

## Planned Stripe Integration

Not implemented yet (Phase 1 explicitly excludes checkout). Architectural
intent for later phases:

- All payments are initiated and completed through African Tutors — never
  off-platform.
- Stripe secret keys and webhook secrets are server-only (see
  `.env.example`); the browser only ever sees a publishable key.
- Payment records (`payments`) are linked to a `booking`, not directly
  exposed to the tutor beyond confirmation that a session is paid for.
- Tutor compensation (`tutor_earnings`) is tracked as a separate concept
  from student payment records, so a tutor's view of "what I earned" never
  requires access to a student's payment method or billing details.

## Planned Twilio Integration

Not implemented yet. Architectural intent:

- Twilio credentials (Account SID, API key/secret) are server-only and are
  used to mint short-lived video access tokens tied to a specific booking's
  `video_session`.
- Neither party's phone number or personal contact info is ever required to
  join a session — access is granted purely through the platform's booking
  and token system.
- Recordings, when enabled, will be linked back to the originating booking
  for quality control and dispute investigation, and access to a recording
  will be authorized the same way session access is (via the booking), not
  by sharing a raw file link.

## Role Based Access Strategy

Three roles: `student`, `tutor`, `admin` (see `PROJECT_SPEC.md`).

- **No security-by-hidden-UI.** Hiding a nav link or a button is a UX nicety,
  never the actual access control. Every sensitive read/write must be
  enforced server-side (Route Handler checks, Server Component checks, and
  ultimately Postgres RLS policies once real tables exist).
- Route protection seam already exists in `src/middleware.ts`: paths under
  `/dashboard/*` are treated as protected. Today, with no Supabase project
  connected, the middleware is a pass-through so the placeholder dashboards
  remain reachable for development and testing. Once Supabase is connected,
  it will redirect unauthenticated visitors to `/login`, and a follow-up
  change will add role-specific checks (e.g. a student hitting
  `/dashboard/tutor` gets redirected, not just visually blocked).
- Admin-only server actions (approving tutors, viewing payments, reviewing
  circumvention flags, etc.) will run with checks against the authoritative
  role stored in Postgres, not against client-supplied data.

## Tutor to Client Circumvention Prevention

This is a first-class architectural concern, established now so it does not
require a rewrite later.

1. **Minimize contact exposure by default.** Student and tutor personal
   contact information (auth email, phone number, etc.) is not
   unnecessarily exposed to the other party anywhere in the current or
   planned data model. Profile data shown to the other party is limited to
   what's needed to tutor/be tutored (display name, subjects, etc.).
2. **Platform-generated identifiers over personal ones.** Wherever a user
   needs to be referenced (in a booking, a message, a session), the
   reference will be an internal ID or a platform display name — never a
   personal email address exposed to the other party.
3. **Messaging stays inside African Tutors.** Future internal messaging
   (`internal_messages`) will be the only supported way for a student and
   tutor to communicate about a booking. No feature will hand out an
   external messaging handle in its place.
4. **Video access without phone numbers.** Future Twilio video rooms are
   joined via tokens minted by our server and tied to a booking — never by
   sharing a personal phone number or an unmanaged meeting link.
5. **Payments always on-platform.** All payments flow through Stripe via
   African Tutors; there is no code path that reveals a way to pay a tutor
   directly.
6. **Earnings tracked separately from payment data.** `tutor_earnings`
   records what a tutor is owed/paid without requiring access to the
   student's payment instrument or billing information.
7. **Circumvention detection is a planned, not-yet-built, layer.** Future
   internal messaging will be designed so it *can* be scanned for attempted
   exchange of phone numbers, emails, social handles, payment handles,
   WhatsApp/Telegram info, and similar patterns (`circumvention_flags`).
   Phase 1 intentionally does not implement this detection or any invasive
   surveillance — only the architecture that allows it to be added cleanly
   (e.g. messages already flow through a single on-platform table/service
   that a moderation step can hook into later).
8. **Admins get visibility, not the tutor or student.** When circumvention
   flags exist, only administrators will have access to the flag and its
   supporting evidence — this is not visible to the other party.
9. **Recordings and activity are linked to bookings.** Recordings and
   session activity logs will always reference a `booking_id`, so they can
   be used for quality control and dispute investigation without relying on
   an unmanaged, ad hoc record of what happened.
10. **Reduce, don't just police, off-platform incentive.** By keeping
    scheduling, communication, payment, and session history genuinely
    convenient on-platform, the design aims to reduce the *need* either
    party feels to move the relationship off-platform, rather than relying
    purely on detection after the fact.

No invasive surveillance or complex detection is implemented in Phase 1. This
section exists so later phases can implement these protections correctly
instead of retrofitting them.

## Booking & Scheduling Architecture (Prompt 3A foundation)

African Tutors is a **managed** service, not an open marketplace. Students do
not browse or negotiate with independent tutors; the family tells African
Tutors what help they need and when, and the platform assigns an approved
tutor. All booking-critical rules are enforced in Postgres (RLS + SECURITY
DEFINER functions + constraints), never trusted from the client.

### Data model (see DATABASE.md)
- `students` — the learners. Parent-first: one account (`profiles.id`) can own
  many students; the free trial belongs to the **student**, not the login.
- `subjects` + `tutor_subjects` — admin-managed catalog and the authoritative
  per-tutor subject approvals. Tutors can never self-approve subjects.
- `tutor_availability` — recurring weekly blocks in the tutor's local tz.
- `tutor_availability_exceptions` — one-off unavailable windows (UTC).
- `bookings` — the hub; authoritative times in UTC, privacy-safe denormalized
  display fields (student first name + grade, subject name, tutor display name)
  so tutors never read the learner table.

### Booking lifecycle
`pending` → `confirmed` → `completed`, with `cancelled` and `no_show` branches.
Auto-matched sessions are created `confirmed`; unlisted-subject ("Other")
requests are created `pending` for admin triage. `payment_status` is
`not_required` (free trial) or `awaiting_payment` (paid) — see Stripe below.

### Tutor matching (managed, automatic)
`create_booking()` selects an eligible tutor where the tutor is **approved**,
**approved for the subject**, **available** for the whole slot (recurring
availability minus exceptions), and **not already booked**. Ordering:
1. Repeat-tutor preference (a tutor who previously completed a session with
   this student), then
2. Least upcoming workload, then
3. Deterministic tie-break by id.
This is intentionally simple; the ordering is the seam where future ranking
(performance, conversion, ratings, compatibility) will plug in. No tutor
contact info is ever exposed to the student.

### Double-booking prevention
A gist exclusion constraint (`bookings_no_tutor_overlap`) makes it impossible
for a tutor to hold two overlapping active sessions, even under concurrent
requests — the loser's insert fails and matching falls through to the next
eligible tutor or reports no availability.

### Free-trial enforcement
One free 30-minute session per student, enforced in three layers: a partial
unique index (`bookings_one_free_trial_per_student`), a server check in
`create_booking()`, and a `has_used_free_trial()` predicate the UI reads. Free
trials are 30 minutes only and require no payment method.

### Timezone strategy
Authoritative appointment times are stored in UTC (`timestamptz`). Tutor
availability is stored as weekday + local time and interpreted in the tutor's
IANA timezone; exceptions and bookings are UTC instants. The UI converts to the
tutor's and the student's own timezones for display (`src/lib/timezone.ts`). A
Houston parent booking 7 PM Central and a Lagos tutor both see their own local
time for the same instant.

### Anti-poaching in bookings
`bookings` stores no email, phone, address, or billing. A tutor may read only
bookings assigned to them (RLS), and only the minimum needed to teach (student
first name + grade + subject + request note). A student/parent reads only their
own bookings. Admins manage operational data. Enforced by RLS and verified by
live tests.

### Future Stripe attachment point
Paid bookings are created with `payment_status = 'awaiting_payment'` and no
money is collected, faked, or given an invented transaction id. Stripe will
attach by adding a payments table/columns keyed on `bookings.id`, moving
`awaiting_payment` → `paid` via a verified webhook, and gating `confirmed`
state on payment for paid sessions. Free trials bypass payment entirely.

### Future Twilio attachment point
A confirmed booking is the anchor for a future `video_sessions` row; a Twilio
room/token will be minted per booking at session time. No external meeting
links are stored or exposed.

### Unresolved policy
Cancellation / rescheduling / refund policy is deliberately **not** encoded.
`cancel_booking()` exists (owner of the booking or admin) and admins can cancel,
but no free-cancellation, refund, or reschedule guarantee is implied. This
remains an owner decision before launch.

## Booking Engine (Prompt 3B — server-side hardening)

Prompt 3B hardens the server-side booking engine (no UI). A server-only service
layer (`src/lib/booking-service.ts`, guarded by `import "server-only"`) is the
single entry point the future UI will call; it runs with the authenticated
user's session (RLS enforced) and never uses the service role.

### Slot generation algorithm (`get_available_slots`)
Inputs: subject, duration (30/60), a `[from, to]` UTC window (the caller passes
the configurable horizon from `booking-config.ts`), and a configurable
`p_slot_minutes` interval (default 30). For every approved tutor qualified for
the subject with a valid timezone, it steps candidate starts by the slot
interval from each recurring block's start (in the tutor's local tz), keeps only
candidates where the **whole duration fits** inside the block, then removes any
that overlap an availability exception or an existing active booking, and any
outside `[from, to]`. Returns the distinct set of bookable **UTC** start instants
(authoritative); the UI converts to the student's IANA timezone for display.
Example: a 17:00–19:00 block yields 17:00/17:30/18:00/18:30 for 30-min and
17:00/17:30/18:00 for 60-min (never 18:30, which would overrun). Not callable by
anonymous users (execute revoked from public).

### Matching order (`create_booking`)
Eligible tutor = role `tutor` + status `approved` + admin-qualified for the
subject + valid timezone + available for the whole slot (recurring minus
exceptions) + no booking conflict. Order:
1. **Same-subject repeat-tutor continuity** — a tutor who *completed* a prior
   session with this student **for this subject**, only if still approved,
   still qualified, and actually available (checked in the loop, so continuity
   never overrides scheduling correctness; otherwise it falls back).
2. Fair least-upcoming-workload distribution.
3. Deterministic `profile_id` tie-break (predictable under concurrency).
The gist exclusion constraint remains the final concurrency guard: on a
concurrent collision the insert fails and matching advances to the next tutor.

### Free-trial consumption rule (documented)
One free 30-minute trial per student. Enforced by the partial unique index
`(student_id) where is_free_trial and status <> 'cancelled'` plus a server check.
Chosen rule: **cancelled** (before completion) **restores** eligibility;
**completed** consumes it; **no_show** consumes it (it is not `cancelled`). A
60-minute session can never be free; price snapshot is `$0` / `not_required`.

### Price integrity
Price is derived server-side from duration + free-trial eligibility inside
`create_booking` (30→$12, 60→$20, trial→$0), mirroring `src/lib/pricing.ts`.
Clients cannot pass a price, choose a tutor, mark a booking paid, or flag a
60-min session as free — there are no such parameters, direct booking inserts
are denied by RLS, and booking updates are admin-only.

### Booking horizon
`BOOKING_HORIZON_DAYS` and `MIN_BOOKING_NOTICE_MINUTES` (`booking-config.ts`) are
configurable constants, not hardcoded policy. The current values are development
defaults, not a final public commitment.

### "Other" subject requests
An "Other" request creates a `pending`, tutor-less booking (subject_id null,
`other_subject_text` + private note) for **admin review/assignment** — the engine
never guesses tutor qualification. The admin assignment UI is Prompt 3C.

### Stripe attachment point (Prompt 4)
Paid bookings are created `confirmed` with `payment_status = 'awaiting_payment'`
and no money moved. Prompt 4 will: create a Stripe Checkout/PaymentIntent for the
booking, return the client secret/redirect, confirm payment only via a verified
webhook (moving `awaiting_payment` → `paid`), and handle failure/expiration
(leaving or reverting the booking). Free trials bypass payment.
