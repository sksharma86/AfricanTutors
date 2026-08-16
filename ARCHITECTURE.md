# African Tutors — Architecture

This document describes the technical architecture established during
Phase 1 (project foundation) and Phase 2 (authentication, database, and
role/permission enforcement). It will grow as booking, payments, video, and
messaging are built in later phases.

## Overall Application Architecture

African Tutors is a single Next.js application (App Router) that serves:

- Public marketing pages (home, how it works, pricing, about, contact)
- Authentication pages (login, signup, forgot/reset password, email
  confirmation handling)
- Role-scoped dashboards (student, tutor, admin) under `/dashboard/*`,
  protected by real server-side authorization
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
    (marketing)/login, signup, forgot-password, reset-password  Auth pages
    auth/
      confirm/route.ts     Handles email confirmation + password recovery links
      error/               Friendly "that link didn't work" page
    dashboard/
      student/             Student dashboard (real profile data)
      tutor/                Tutor dashboard: application form, status banner, or
                             approved functionality depending on tutor_profiles.status
        actions.ts           Server Action: tutor submits/updates their own application
      admin/                Admin dashboard: tutor application review queue
        actions.ts           Server Action: admin approves/rejects/suspends a tutor
    api/                  Route handlers (server-only logic)
  components/
    ui/                   Small generic building blocks (Button, Container, Badge)
    layout/                Navbar, Footer, mobile menu
    marketing/             Homepage/marketing sections (Hero, FeatureGrid, Steps, CTA)
    auth/                   Login/signup/forgot/reset forms and auth UI
    dashboard/              Dashboard shell, tutor application form, admin review card
  lib/
    supabase/
      client.ts, server.ts   Supabase client factories (typed with database.types.ts)
      database.types.ts       Hand-written types mirroring supabase/migrations/*.sql
      errors.ts                Friendly Auth error message mapping
    roles.ts                 Role/TutorStatus types and role → dashboard path mapping
    constants.ts              Site-wide constants (nav links, site name)
  proxy.ts                  Session refresh + real server-enforced route protection
scripts/
  promote-admin.mjs         One-off script to grant the admin role (service role key)
supabase/
  migrations/                Real SQL migrations (schema, RLS, triggers, RPCs)
  tests/                     Local RLS test harness (npm run test:rls)
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
  Business rules that must be trustworthy (e.g. "a tutor cannot approve
  their own application" or "a student's identity row is invisible to
  every tutor") are enforced with RLS policies and `SECURITY DEFINER`
  database functions, not just application code — see `DATABASE.md`.

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
- `src/proxy.ts` — Next.js 16's replacement for `middleware.ts`. Refreshes
  the session cookie on every request **and** enforces real, server-side
  route protection for `/dashboard/*` (see "Role Based Access Strategy"
  below) — not just a session refresh anymore.
- `src/app/auth/confirm/route.ts` — handles the links Supabase puts in
  confirmation/recovery emails, using the current recommended `token_hash` +
  `type` pattern (not the older, deprecated implicit hash-fragment flow).
  One route covers both "confirm your email" and "reset your password"
  links.

Implemented auth flows (email/password):

- **Registration** — email + password via `supabase.auth.signUp()`. Signup
  lets a visitor indicate whether they want to learn (student) or apply to
  teach (tutor); this is sent as `requested_role` in Supabase Auth user
  metadata and only ever used by a database trigger (see below) to decide
  the *starting* state — it never grants privileged access by itself. A
  "tutor" signup starts as `tutor_profiles.status = 'pending'`.
- **Tutor application** — once logged in, a pending (or approved) tutor
  fills out a short application form (headline, bio, education, years of
  experience, subjects) via a Server Action
  (`src/app/dashboard/tutor/actions.ts`) that only ever updates their own
  row's application-editable columns (enforced at the database grant
  level, not just by the form).
- **Email verification** — Supabase's built-in email confirmation flow,
  landing on `/auth/confirm` and then the user's dashboard.
- **Password reset** — `/forgot-password` requests a reset email;
  `/auth/confirm` exchanges the recovery link for a session; `/reset-password`
  lets the user set a new password via `supabase.auth.updateUser()`.
- **Session management** — handled by Supabase Auth cookies, refreshed by
  `src/proxy.ts` on every request.
- **Friendly errors** — `src/lib/supabase/errors.ts` maps raw Supabase Auth
  error messages (e.g. `Invalid login credentials`) to short, nontechnical
  copy (e.g. "The email or password you entered is incorrect."). Nothing in
  the UI shows a raw `AuthApiError` or similar.

Until real Supabase credentials are configured (see `SETUP.md`), the app
detects this via `isSupabaseConfigured` and renders login/signup forms in a
disabled "not configured yet" state rather than crashing, and `proxy.ts`
skips auth checks entirely (dashboards stay reachable for local development
without credentials). This keeps the foundation runnable and testable
before a Supabase project exists, and turns on automatically once
credentials are supplied — no code changes needed.

### Why role assignment is not client-controlled

Nothing in the client can set a user's authoritative role. Authoritative
role/authorization data lives in Postgres (see `DATABASE.md`), controlled
by:

- A default `student` role granted by a database trigger
  (`public.handle_new_user()`) the moment someone verifies their signup —
  the same trigger creates their `student_profiles` row.
- `tutor` access gated behind an admin-approved `tutor_profiles.status`
  (`pending` → `approved`/`rejected`/`suspended`), changeable only through
  `public.admin_set_tutor_status(...)`, a `SECURITY DEFINER` Postgres
  function that checks the caller is an admin before doing anything. A
  brand-new tutor signup is always `pending` and gains zero elevated
  access until that function is called by an admin.
- `admin` accounts provisioned directly by the platform owner/engineering
  team by running SQL directly against the database (or the
  `scripts/promote-admin.mjs` helper script, which uses the Supabase
  service role key) — never through public signup, and never via any
  column the `authenticated` role is granted UPDATE on. See `SETUP.md` →
  "Creating the first administrator".

## Database Strategy

Supabase PostgreSQL is the single system of record. See `DATABASE.md` for
the full schema, implemented RLS policies, and the automated test suite
that verifies them. Key principles carried into the schema:

- Supabase Auth's `auth.users` table (which holds login email, password
  hash, etc.) is kept separate from platform-visible profile data. Public,
  cross-role visible information (display name, subjects, etc.) lives in
  `student_profiles` / `tutor_profiles`, not in the auth table. Neither the
  `authenticated` nor `anon` role is ever granted any privilege on
  `auth.users` itself.
- Row Level Security restricts which rows a student, tutor, or admin can
  read/write for every implemented table (`profiles`, `student_profiles`,
  `tutor_profiles`, `subjects`, `tutor_profile_subjects`), combined with
  column-level `GRANT`s so that even a row a user *can* see isn't fully
  writable (e.g. a tutor can see their own `tutor_profiles` row but cannot
  `UPDATE` its `status` column).
- Migrations live in `supabase/migrations/` and are meant to be applied to
  a real Supabase project via the SQL Editor or the Supabase CLI (see
  `SETUP.md`). They have been validated against a local PostgreSQL
  instance bootstrapped to imitate Supabase's `auth` schema and role
  model, via `npm run test:rls` (see `supabase/tests/`), since this
  environment does not have a connected Supabase project to test against
  directly.

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

Three roles: `student`, `tutor`, `admin` (see `PROJECT_SPEC.md`). Route
protection is enforced in two independent layers — either one alone would
be reasonable, having both is deliberate defense in depth:

1. **Routing layer (`src/proxy.ts`).** On every request to `/dashboard/*`,
   the proxy:
   - Redirects to `/login` (with a `redirectTo` back-link) if there is no
     logged-in user at all.
   - Otherwise looks up the user's `role` from `public.profiles` and
     redirects to that role's own dashboard (`/dashboard/student`,
     `/dashboard/tutor`, or `/dashboard/admin`) if the requested path isn't
     already theirs. A student manually typing `/dashboard/admin` into the
     address bar is redirected away — the admin dashboard is never
     rendered for them, regardless of what the UI would or wouldn't have
     linked to.
   - A pending/rejected/suspended tutor *is* allowed onto
     `/dashboard/tutor` (it's their own dashboard) — the page itself, not
     the router, decides whether to show the application/status screen or
     full tutor functionality, based on `tutor_profiles.status`.
2. **Data layer (Postgres RLS + column grants, see `DATABASE.md`).** This is
   the actual, final authority: even if the routing layer were somehow
   bypassed, no query run by a student can return another user's private
   data, and no update from a non-admin can touch `profiles.role` or
   `tutor_profiles.status`.
- **No security-by-hidden-UI.** Hiding a nav link or a button is a UX
  nicety, never the actual access control — everything above is enforced
  server-side/database-side, not by what the client chooses to render.
- Admin actions (approving/rejecting/suspending a tutor application) run
  through `public.admin_set_tutor_status(...)`, which independently checks
  the caller's role in Postgres — a Server Action or API route calling it
  cannot itself grant authority it doesn't have.

## Tutor to Client Circumvention Prevention

This is a first-class architectural concern, established now so it does not
require a rewrite later.

**Status as of Phase 2:** principle 1 (minimize contact exposure) and 2
(platform-generated identifiers over personal ones) are now implemented
and automatically tested for `profiles`/`student_profiles`/`tutor_profiles`
— see `DATABASE.md` → "Anti-Poaching Verification". Principles 3–10 remain
architectural commitments for when messaging, video, payments, and
circumvention detection are actually built (they have no code yet to
verify).

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
