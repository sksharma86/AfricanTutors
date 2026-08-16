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
