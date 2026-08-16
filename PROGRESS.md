# African Tutors Development Progress

## Prompt 3 — Booking, scheduling, availability, matching, free trial (complete)

- Managed booking system live on Supabase: `students` (parent-first learners),
  `subjects` + `tutor_subjects` (admin-controlled), `tutor_availability` +
  `tutor_availability_exceptions`, and `bookings`
  (`supabase/migrations/0002_prompt3_booking.sql`).
- Timezone-safe scheduling (UTC authoritative; availability in tutor local tz;
  UI renders in each viewer's tz).
- DB-enforced double-booking prevention (gist exclusion) and one-free-30min-trial
  per student (partial unique index + server check).
- Automatic managed matching (`create_booking`): approved + subject-approved +
  available + not-double-booked; repeat-tutor preference then least workload.
- Polished multi-step booking flow, and upgraded student / tutor / admin
  dashboards (bookings, availability management, subject & tutor-subject admin,
  booking oversight/cancel). Mobile-first.
- 32/32 live Supabase tests pass (13 Phase 2 + 19 Prompt 3). No Stripe/Twilio yet
  (documented attachment points).

## Completed

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 project initialized
  with a sensible `src/` structure.
- Core documentation created: `PROJECT_SPEC.md`, `ARCHITECTURE.md`,
  `DATABASE.md`, `SETUP.md`, `DECISIONS.md`, `TODO.md`, this file, and an
  updated `README.md`.
- `.env.example` created with placeholders for Supabase, Stripe, Twilio,
  app URL, and email provider — no real secrets committed. `.gitignore`
  confirmed to exclude `.env*` (except `.env.example`), `.next/`,
  `node_modules/`, and other generated/secret-bearing files.
- Public marketing pages built and styled: Home, How It Works, Pricing,
  About, Contact (with a working contact form that posts to
  `/api/contact`, currently logging server-side rather than sending email).
- Auth pages built: Login and Signup, wired to Supabase Auth
  (`@supabase/ssr`) but rendered in a clearly-labeled, disabled "not
  configured yet" state since no Supabase project is connected in this
  environment. Signup includes a Learn/Teach role request toggle that only
  records a *requested* role — it does not grant tutor/admin access.
- Protected dashboard placeholders built for Student, Tutor, and Admin,
  each with its own header, role badge, sidebar (showing what's available
  vs. "Soon"), and placeholder content cards. These are in a separate
  layout from the public marketing pages (no duplicate nav/footer).
- Responsive navigation: desktop nav with public links only, plus a
  working mobile hamburger menu. No tutor/admin links in public nav.
- Reusable component library: `Container`, `Button`/`LinkButton`, `Badge`,
  marketing sections (`Hero`, `FeatureGrid`, `Steps`, `CtaSection`,
  `PageHeader`), dashboard shell/cards, and auth form components.
- Supabase integration scaffolding: browser client, server client, and a
  `proxy.ts` (Next.js 16's replacement for `middleware.ts`) that refreshes
  the session and is the seam for future server-enforced route protection.
  All of it degrades to a safe no-op today since no Supabase project is
  connected.
- Anti-poaching/anti-circumvention principles documented as first-class
  architecture in `ARCHITECTURE.md`, and reflected in the preliminary
  database design in `DATABASE.md` (e.g. auth identity separated from
  profile data, bookings as the hub for payments/sessions/recordings,
  `internal_messages` + `circumvention_flags` planned as the only sanctioned
  communication channel).
- Pricing & free trial finalized (Prompt 2.7): public site now shows $12 /
  30 min and $20 / 60 min, with a prominent "first 30 minutes free, no credit
  card required" acquisition message across the hero, pricing page, homepage,
  and nav CTAs. Customer-facing pricing is centralized in `src/lib/pricing.ts`;
  tutor compensation/economics stay private in `BUSINESS_MODEL.md`. The obsolete
  $19.50/hour figure is not present anywhere.
- Quality tooling verified: TypeScript (`tsc --noEmit`), ESLint
  (`npm run lint`), and a production build (`npm run build`) all pass with
  zero errors/warnings.
- Manual verification: every route above returns HTTP 200 locally, the
  homepage and inner pages render correctly, the mobile menu opens/closes
  correctly at a 390px viewport, and all three dashboards render their
  correct role-specific shell with no leftover marketing nav/footer.

## Currently Working On

Nothing in progress — Phase 1 (project foundation) is complete and the
codebase is idle, awaiting direction on Phase 2.

## Next

Recommended next step (Phase 2 in `TODO.md`): connect a real Supabase
project, create the `profiles` / `student_profiles` / `tutor_profiles`
tables with Row Level Security, wire up real email/password signup with a
default `student` role, and add real server-enforced role checks to
`src/proxy.ts` so protected dashboards actually require login.

## Blocked

Nothing is currently blocking further development. No owner action is
required to continue into Phase 2 — Supabase/Stripe/Twilio credentials will
only be requested once the corresponding feature is actually being built
(see `SETUP.md`).

## Known Issues

- No Supabase project is connected yet, so login/signup forms are
  intentionally disabled with a "not configured yet" notice, and the
  dashboards are reachable by anyone (there is no real session to check
  yet). This is expected for this phase, not a bug — see `ARCHITECTURE.md`
  → "Role Based Access Strategy".
- The contact form accepts submissions and logs them server-side but does
  not yet send an email anywhere, since no transactional email provider is
  connected yet.
- Pricing is finalized ($12 / 30 min, $20 / 60 min, first 30-minute session
  free with no card). The booking flow that the "Try 30 Minutes Free" CTA will
  eventually lead into is a Prompt 3 item and is intentionally not built yet.
- No automated test suite exists yet. Given how much of the current
  surface is placeholder UI that will change shape once Supabase/Stripe/
  Twilio are wired in, TypeScript + ESLint + a passing production build
  were judged sufficient quality gates for this phase; real tests should be
  added once Phase 2 introduces logic worth testing (e.g. role
  authorization, booking status transitions).

## Last Verified

2026-08-15 — `npm run build` (production build), `npx tsc --noEmit`, and
`npm run lint` all pass with zero errors. Verified via local dev server
(`npm run dev`) and a browser-based check that: the homepage, How It Works,
Pricing, About, Contact, Login, Signup, and all three dashboard routes
(`/dashboard/student`, `/dashboard/tutor`, `/dashboard/admin`) return HTTP
200 and render as intended; the mobile navigation opens/closes correctly at
a 390px width; and the contact form's API route correctly accepts valid
submissions and rejects incomplete ones.
