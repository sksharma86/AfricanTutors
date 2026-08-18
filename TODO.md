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

- [ ] Create/connect a real Supabase project; add credentials to `.env.local`
      and Vercel
- [ ] Create `profiles`, `student_profiles`, `tutor_profiles` tables +
      row level security policies (see `DATABASE.md`)
- [ ] Database trigger/function to create a `profiles` row on signup with
      role `student` by default
- [ ] Wire up email verification and password reset flows end-to-end
- [ ] Add real server-enforced role checks to middleware (redirect a
      student away from `/dashboard/tutor`, etc.)
- [ ] Admin tooling (even minimal) to approve pending tutor applications

## Pricing & Free Trial (finalized — Prompt 2.7)

- [x] Customer pricing finalized: $12 / 30 min, $20 / 60 min (replaces the
      obsolete $19.50/hour figure)
- [x] First 30-minute session free for new students; no card/payment required
- [x] Public site + docs updated; tutor compensation kept private
      (`BUSINESS_MODEL.md`)

## Phase 3 — Subjects, Availability & Booking (staged 3A → 3D)

### Prompt 3A — data & server foundation (DONE)
- [x] `students` (parent-first learners), `subjects`, `tutor_subjects` tables
- [x] `tutor_availability` + `tutor_availability_exceptions` + tutor timezone
- [x] `bookings` table + lifecycle statuses (30- and 60-min); free-trial = 30 only
- [x] Server-side managed matching (`create_booking`) — no public tutor catalog
- [x] Free-trial eligibility enforced at the DB (one free 30-min per student)
- [x] Timezone-safe design (UTC + local-tz availability), double-booking &
      free-trial enforcement, RLS/anti-poaching, live foundation tests

### Prompt 3B — server-side booking engine (DONE)
- [x] Hardened `get_available_slots` (configurable interval, duration-fit,
      exceptions/bookings, horizon, authenticated-only)
- [x] Hardened `create_booking` matching (same-subject repeat → workload → id)
- [x] Documented free-trial consumption rule + price integrity + Stripe point
- [x] Server-only booking service layer (`src/lib/booking-service.ts`)
- [x] 49/49 live tests (incl. slot math, concurrency, DST, security)

### Prompt 3C — Booking / tutor / admin UI (DONE)
- [x] Student/parent booking wizard (student, subject/Other, session, time, review, confirm)
- [x] Multiple-student selection + inline add; per-student free-trial state
- [x] Student dashboard bookings + payment-required presentation
- [x] Tutor availability + exceptions UI; privacy-safe tutor session views
- [x] Admin subject management, tutor-subject qualification, filterable booking ops + Other requests

### Prompt 3D — Booking lifecycle hardening (DONE)
- [x] Paid bookings pending + payment hold (not falsely confirmed); `expired` status
- [x] `release_expired_holds()`; availability ignores expired holds
- [x] Parent-friendly error handling; admin `expired` filter
- [x] State machine + Stripe handoff contract + Twilio confirmed-only documented

## Phase 4 — Payments & finance (staged)

### Phase 4A — Stripe & financial foundation (DONE)
- [x] Package products table (seeded), package-minute + dollar-credit ledgers
- [x] `payments`, `tutor_earnings` (rate snapshot), `stripe_events`, `financial_audit_log`
- [x] Admin-only tutor comp rate; atomic idempotent money functions; RLS
- [x] Stripe SDK + server client + webhook (signature verify + idempotency)

### Phase 4B–4D — NOT built yet
- [ ] 4B: Stripe checkout (Checkout/PaymentIntent), webhook fulfillment handlers,
      package purchase + booking payment UI (`awaiting_payment` → `paid`/`confirmed`)
- [ ] 4C: admin financial UI + tutor payout tracking (payouts remain manual)
- [ ] 4D: dispute/arbitration workflow
- [ ] Cancellation/refund policy (owner decision); promo-code + referral systems
- [ ] Twilio video rooms (attach to a confirmed booking)
- [ ] Cancellation/rescheduling/refund policy (owner decision) + UI
- [ ] Free-trial conversion + tutor-performance analytics dashboards

### Deferred to later phases (not Prompt 3)
- [ ] Stripe payments (attach to `bookings`; move `awaiting_payment` → `paid`)
- [ ] Twilio video rooms (attach to a confirmed booking)
- [ ] Cancellation/rescheduling/refund policy (owner decision) + UI
- [ ] Free-trial conversion + tutor-performance analytics dashboards

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
- [ ] Free-trial conversion analytics (critical): visitor→signup,
      signup→trial booked, trial booked→completed, completed→first paid,
      first→second paid, 30/60/90-day retention, avg hours/active student,
      CAC, cost per completed free trial, trial→paid rate (overall and
      per-tutor). See `BUSINESS_MODEL.md` for the full metric set.

## Ongoing / Cross-Cutting

- [ ] Transactional email provider integration (verification, reset,
      notifications)
- [ ] Accessibility pass on all interactive components
- [ ] Automated test coverage as features stabilize (avoid over-testing a
      still-changing surface)
- [ ] Legal pages (Terms of Service, Privacy Policy) once content is
      provided by the owner
