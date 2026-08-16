# African Tutors Development Progress

## Completed

**Phase 1 (project foundation):** Next.js 16 + TypeScript + Tailwind app
shell, public marketing pages, responsive navigation, reusable component
library, and core project documentation. See git history for full detail.

**Phase 2 (authentication, database, roles, anti-poaching foundation):**

- Real database schema implemented as migrations
  (`supabase/migrations/`): `profiles`, `student_profiles`,
  `tutor_profiles`, `subjects`, `tutor_profile_subjects` — with Row Level
  Security enabled on every table, column-level `GRANT`s restricting which
  fields each role can write, a signup trigger (`handle_new_user`) that
  creates the right profile rows automatically, and an
  `admin_set_tutor_status(...)` function that is the only way a tutor
  application can be approved/rejected/suspended.
- **Anti-poaching requirement verified with an automated test suite**, not
  just documentation: `npm run test:rls` applies the real migrations to a
  local PostgreSQL database bootstrapped to imitate Supabase's `auth`
  schema and role model, then runs 12 assertions proving (among other
  things) that an approved tutor cannot read a student's identity/profile
  data, a student cannot read a tutor's private application data, nobody
  but the internal service role can query `auth.users` directly, and no
  non-admin can self-promote or self-approve. All 12 currently pass. See
  `DATABASE.md` → "Anti-Poaching Verification".
- Real Supabase Auth wired up for login and signup (client-side, via
  `@supabase/ssr`), with friendly, nontechnical error messages
  (`src/lib/supabase/errors.ts`) instead of raw error codes.
- Signup lets a visitor choose "Learn" (student, immediate access) or
  "Teach" (tutor, starts as `pending` — no elevated access until an admin
  approves it).
- Tutor application flow: a logged-in tutor fills out a short form
  (headline, bio, education, years of experience, subjects) via a Server
  Action that only ever updates their own application-editable columns.
  Pending/rejected/suspended tutors see an appropriate status message
  instead of full tutor functionality.
- Admin dashboard now has its first real functionality: a tutor
  application review queue with Approve/Reject/Suspend actions, calling
  the admin-only database function — verified to reject non-admin callers.
- Real server-enforced route protection in `src/proxy.ts` (Next.js 16's
  middleware): logged-out visitors are redirected to `/login`; logged-in
  users who navigate to a dashboard that isn't theirs (by role, looked up
  from the database) are redirected to their own dashboard instead of
  seeing the wrong one — this works by typing a URL directly, not just by
  what the UI links to.
- Password reset flow: `/forgot-password` → email → `/auth/confirm`
  (Supabase's current recommended `token_hash` pattern, not the deprecated
  implicit-flow) → `/reset-password`.
- `scripts/promote-admin.mjs` plus a documented direct-SQL fallback for
  creating the first administrator account — there is no public "sign up
  as admin" option anywhere, and no column grant exists that would let a
  client set their own role to admin.
- Quality tooling re-verified: TypeScript (`tsc --noEmit`), ESLint
  (`npm run lint`), and a production build (`npm run build`) all pass with
  zero errors. All dashboard routes correctly render as dynamic
  (server-rendered per request), not statically cached, since they show
  private per-user data.
- Manual verification (browser + local dev server, without live Supabase
  credentials — see "Blocked" below): homepage and all marketing pages
  still work, login/signup/forgot-password/reset-password/auth-error pages
  render correctly with disabled forms and a "not configured yet" notice,
  and all three dashboards fall back to sensible placeholder content
  instead of crashing when no Supabase project is connected.

## Currently Working On

Nothing in progress. Phase 2 is code-complete and has been verified as
thoroughly as possible without a live Supabase project. Waiting on the
owner action described below before the next phase can be fully verified
end-to-end.

## Next

Once a Supabase project is connected (see "Blocked"): do a real end-to-end
smoke test against it (sign up as a student, sign up as a tutor, confirm
the tutor starts pending, promote an admin, approve the tutor from the
Admin Dashboard, confirm the tutor then sees full Tutor Dashboard content,
confirm a student can never reach `/dashboard/tutor` or `/dashboard/admin`
by typing the URL). After that, Phase 3 (subjects catalog admin UI, tutor
availability, and the beginning of booking) is the recommended next
development task — see `TODO.md`.

## Blocked

**Needs owner action:** a real Supabase project needs to be created and
connected before this phase's authentication/database work can be tested
end-to-end for real (real signup emails, real login sessions, real admin
approval against a live database). Step-by-step instructions — written for
a nontechnical owner, no coding required — are in `SETUP.md` under
"Supabase (Auth + Database) — action needed now". In short: create a free
Supabase project, copy three values from its dashboard into Cursor's
Secrets (Cloud Agents → Secrets), and either paste two SQL files into
Supabase's SQL Editor or ask the agent to do it for you next session.

Nothing else is blocked — Stripe, Twilio, Vercel, and email provider
credentials are still not needed yet (see `SETUP.md`).

## Known Issues

- **Not yet tested against a real Supabase project.** Everything in this
  phase has been verified either by a local PostgreSQL test harness (for
  the database/RLS logic — see `DATABASE.md`) or by running the Next.js
  app with Supabase deliberately "not configured" (for the UI, which falls
  back gracefully). Neither of those exercises a real, live sign-up email,
  a real browser session cookie round-trip through Supabase's actual
  GoTrue auth server, or PostgREST's exact request handling. This is a
  reasonable gap given no Supabase project exists in this environment, but
  it should be smoke-tested for real as the very first thing once one is
  connected.
- The contact form (from Phase 1) still only logs submissions server-side;
  no email is sent yet, since no transactional email provider is
  connected.
- No public "browse approved tutors" page exists yet, so there is
  currently no way for a student to see any tutor's profile at all (by
  design, until a booking-scoped policy is added in Phase 3 — see
  `DATABASE.md`).
- No admin UI exists yet for managing the `subjects` catalog; it's
  currently seeded once by migration only.
- No automated browser/end-to-end test suite exists yet (`npm run
  test:rls` covers the database authorization layer specifically). Given
  the UI surface is still evolving, this was judged an acceptable trade-off
  for this phase.

## Last Verified

2026-08-16 — `npm run build` (production build), `npx tsc --noEmit`,
`npm run lint`, and `npm run test:rls` (12/12 database RLS/anti-poaching
assertions) all pass with zero errors. Verified via local dev server that
every route (public pages, login, signup, forgot-password, reset-password,
auth/error, and all three dashboards) returns HTTP 200 and renders
correctly in the "Supabase not configured" fallback state — this is the
most that could be verified without a live, connected Supabase project.
