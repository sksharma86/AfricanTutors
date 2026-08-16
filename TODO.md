# African Tutors — Development Backlog

Organized by phase. This is a living backlog — check items off (or move
them) as they're completed, and keep `PROGRESS.md` in sync with what's
actually done.

## Phase 1 — Project Foundation (this phase)

- [x] Initialize Next.js + TypeScript project with a sensible structure
- [x] Core documentation files (`PROJECT_SPEC.md`, `ARCHITECTURE.md`,
      `DATABASE.md`, `SETUP.md`, `DECISIONS.md`, `TODO.md`, `PROGRESS.md`)
- [x] `.env.example` with placeholders for all anticipated services
- [x] Public route shells: Home, How It Works, Pricing, About, Contact
- [x] Auth route shells: Login, Signup (Supabase-ready, gracefully disabled
      until credentials exist)
- [x] Protected dashboard placeholders: Student, Tutor, Admin
- [x] Responsive navigation (desktop + mobile) without exposing admin/tutor
      links publicly
- [x] Reusable UI/marketing/dashboard components
- [x] TypeScript, ESLint, and production build passing

## Phase 2 — Supabase Connection & Real Authentication

- [x] Write `profiles`, `student_profiles`, `tutor_profiles`, `subjects`,
      `tutor_profile_subjects` migrations with Row Level Security policies
      and column-level grants (see `DATABASE.md`)
- [x] Database trigger (`handle_new_user`) to create a `profiles` row (and
      `student_profiles`/`tutor_profiles` row) on signup
- [x] `admin_set_tutor_status(...)` function for admin-only tutor approval
- [x] Verify the anti-poaching requirement with an automated local test
      suite (`npm run test:rls`) — see `DATABASE.md` → "Anti-Poaching
      Verification"
- [x] Real Supabase Auth wiring for login/signup (client-side), with
      friendly error messages
- [x] Real server-enforced role checks in `src/proxy.ts` (redirect a
      student away from `/dashboard/tutor`, etc., based on `profiles.role`
      looked up from the database — not from anything client-supplied)
- [x] Tutor application flow (form + Server Action) and pending/rejected/
      suspended status screens
- [x] Admin tooling to review and approve/reject/suspend tutor applications
- [x] Password reset flow (`/forgot-password`, `/auth/confirm`,
      `/reset-password`)
- [x] `scripts/promote-admin.mjs` + documented SQL fallback for creating
      the first administrator
- [ ] **Owner action required:** connect a real Supabase project and add
      credentials as Cursor secrets, then apply the migrations — see
      `SETUP.md`. Once connected, do a real end-to-end smoke test (signup →
      email confirmation → login → tutor application → admin approval →
      tutor dashboard access) against the live project, since this
      environment could only verify the database logic locally, not a real
      connected project or real emails.

## Phase 2.6 — Premium Conversion, Human Connection & Public Website Polish

- [x] Shorten and de-repeat the homepage: consolidate feature-card grids
      into a card-free `ValueList`, replace the full subject grid with a
      compact pill preview linking to `/subjects`, and keep the literal
      price "$19.50" to just the hero + a dedicated pricing section
- [x] Refine hero copy so African Tutors clearly provides the service
      ("gives your student...") rather than sounding like an introduction
      service ("connects your student with...")
- [x] Add human visual storytelling: two photographs connecting an
      American student with a professional African tutor (currently
      AI-generated placeholders — see `public/images/README.md` and the
      "BUSINESS DECISION REQUIRED" item below)
- [x] Consolidate the "real tutor, not a chatbot" idea to one strong,
      well-reasoned expression instead of repeating it
- [x] Remove/neutralize unapproved commercial policy promises ("no
      long-term contract," "no packages," "no hidden fees," "reschedule
      when life happens") from all public copy
- [x] Preserve $19.50/hour, the hero headline, the Global Advantage flow,
      "Academic talent has no borders," the Simple Pricing concept, and
      all Phase 2 auth/database/RLS/anti-circumvention architecture
      (re-verified with `npm run test:rls`, 12/12 passing)

- [ ] **BUSINESS DECISION REQUIRED (pre-launch):** replace the AI-generated
      placeholder photography (`public/images/student-tutoring-session.jpg`,
      `public/images/tutor-portrait.jpg`) with commissioned photography
      (signed model releases) or properly licensed commercial stock
      photography. See `PROJECT_SPEC.md` → "Visual Identity & Photography."
- [ ] **BUSINESS DECISION REQUIRED (pre-launch):** finalize a formal tutor
      vetting standard (what "reviewed and approved" concretely requires).
      Once decided, update public copy to state it specifically — this is
      an important trust/conversion feature once it's real.
- [ ] **BUSINESS DECISION REQUIRED (before Phase 3):** finalize the
      initial student age/grade scope (K–12? middle/high school only?
      K–college? broad academic tutoring?) and the initial launch subject
      list. This directly shapes Phase 3's subject catalog, tutor
      recruiting criteria, and matching logic — do not guess at this.
- [ ] **BUSINESS DECISION REQUIRED (before advertising any of it):**
      session length options beyond the standard hour, and
      cancellation/rescheduling/refund policy. Nothing about this should
      be published in public copy until it's decided — see
      `PROJECT_SPEC.md` → "Public Copy Standards."

## Phase 3 — Subjects, Availability & Booking

*Do not start until the two "before Phase 3" business decisions above are
made.*

- [ ] Admin UI for managing the `subjects` catalog (currently seeded by
      migration only)
- [ ] `tutor_availability` model and a way for tutors to set it
- [ ] Student-facing tutor search/matching flow (will need a new,
      narrowly-scoped RLS policy so students can see *some* approved tutor
      profile fields — see `DATABASE.md`)
- [ ] `bookings` table + booking creation flow (status lifecycle)
- [ ] Booking views for student and tutor dashboards

## Phase 4 — Payments (Stripe)

- [ ] Stripe account setup, publishable/secret keys, webhook endpoint
- [ ] Checkout flow tied to a booking
- [ ] `payments` table + webhook-driven status updates
- [ ] `tutor_earnings` tracking, kept separate from payment/billing data
- [ ] Basic payout visibility for tutors (read-only to start)

## Phase 5 — Live Tutoring (Twilio Video)

- [ ] Twilio account setup, API key/secret
- [ ] Server route to mint short-lived video room tokens per booking
- [ ] In-app video session UI for student and tutor
- [ ] `video_sessions` table + session lifecycle status
- [ ] Recording storage + `recordings` table linked to bookings

## Phase 6 — On-Platform Messaging

- [ ] `internal_messages` table + RLS so only the two parties on a booking
      (plus admins) can read a thread
- [ ] Messaging UI in student/tutor dashboards
- [ ] Notification hooks for new messages (email/in-app)

## Phase 7 — Anti-Circumvention Detection

- [ ] Pattern detection for phone numbers, emails, social handles, payment
      handles, WhatsApp/Telegram references, etc. in `internal_messages`
- [ ] `circumvention_flags` table + admin review queue
- [ ] Admin UI to review flags and supporting evidence
- [ ] Policy/consequences workflow (warning, suspension, etc.) — product
      decision needed from owner before building enforcement actions

## Phase 8 — Session History, Reviews & Admin Analytics

- [ ] Student session history + recording access
- [ ] `reviews` table + review submission/display
- [ ] Admin dashboards: bookings overview, payments overview, tutor
      performance review
- [ ] `admin_settings` table for platform-wide configuration

## Ongoing / Cross-Cutting

- [ ] Transactional email provider integration (verification, reset,
      notifications) — Supabase's built-in emails are fine to start
- [ ] Accessibility pass on all interactive components
- [ ] Automated test coverage as features stabilize (avoid over-testing a
      still-changing surface) — `npm run test:rls` now covers the database
      authorization layer; consider Playwright/component tests once the UI
      surface stabilizes further
- [ ] Once a real Supabase project exists, regenerate
      `src/lib/supabase/database.types.ts` with
      `supabase gen types typescript` instead of maintaining it by hand
- [ ] Legal pages (Terms of Service, Privacy Policy) once content is
      provided by the owner
