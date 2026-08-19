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

### Phase 4B — Customer checkout & fulfillment (DONE)
- [x] `book_session` funding orchestration (package → credit → Stripe); `purchase_package`
- [x] `booking_quote`, `get_customer_balances`; consume-and-restore credit reservation
- [x] Stripe Checkout Session routes (booking/package) + status route; hosted checkout
- [x] Webhook fulfillment (`fulfill_booking_payment`/`fulfill_package_payment`), double idempotency
- [x] Expiry restores reserved credit; delayed-payment-after-expiry credits the account
- [x] Customer UI: wizard quote breakdown + balances, packages page, authoritative return page
- [x] Email stub (booking confirmed / hold expired / package purchased)
- [x] Stripe session lifetime (>=30 min) separated from 15-min internal hold; contract unit test
- [x] Package checkout expiry lifecycle (`payments.expires_at`, `release_expired_checkouts`)
- [x] Safe rollback on Stripe-create failure/unavailable (`cancel_pending_payment`, booking+package)
- [x] Late package payment credits account (mirrors booking delayed-payment)
- [x] Expiry is self-enforcing inside `fulfill_booking_payment`/`fulfill_package_payment` (sweeper not required for correctness)
- [ ] Schedule `release_expired_checkouts()` (cron) — operational polish; currently on-demand + Stripe expiry/failure webhooks
- [ ] Live Stripe redirect + signed webhook E2E — needs `STRIPE_*` env keys (secrets)
- [ ] Production email provider (`RESEND_API_KEY`) — stub logs until configured

### Phase 4C — Admin ops, earnings, cancellations, refunds, disputes (DONE)
- [x] Cancellation engine (24h rule), no-show/complete, admin release/reassign
- [x] Tutor earnings lifecycle (event-driven, rate snapshot) + admin pay/adjust/void/restore
- [x] Admin credit/minute adjustments (negative-balance prevention); refunds (capped, idempotent)
- [x] Internal disputes (submit / admin resolve: denied/courtesy/upheld) + hidden admin notes
- [x] Admin finance console + customer cancel/report UI; audit on every mutation
- [ ] Production email provider (`RESEND_API_KEY`) — stub logs until configured
- [ ] `bookings.recording_ref` is a placeholder; wire real session-recording review in 4D

### Phase 4D — Financial hardening & operational readiness (DONE)
- [x] Concurrency/race tests (refund race, payout race, cancel-vs-complete/no-show, package double-submit, same-slot double-submit)
- [x] Refund idempotency closes the Stripe-then-DB failure window (`refund-<payment>-<refunded_before>-<amount>`)
- [x] `purchase_package` dedupe for duplicate submissions (advisory-lock serialized)
- [x] RLS/security red-team: RLS enabled on all financial tables, no unsafe write policies, all definer fns set `search_path`, internal helpers not client-executable
- [x] Booking/payment state-transition integrity + client-tampering tests; 24h cancellation boundary verified
- [x] Secret-protected cron route for `release_expired_checkouts()`; `.env.example` corrected (email/cron/db-url)
- [ ] Real Stripe test-mode E2E — needs `STRIPE_*` keys (not present in this environment)
- [ ] Production email provider (`RESEND_API_KEY`) — stub logs until configured
- [ ] Wire the cron route to a scheduler once the deployment target is chosen
- [ ] Session-recording review integration (consume `bookings.recording_ref` securely) — future
- [ ] Cancellation/refund policy (owner decision); promo-code + referral systems

### Phase 5A — Live tutoring room with Daily (DONE)
- [x] `authorize_session_join` (server-time gate: parties only, confirmed + join window)
- [x] Deterministic private Daily rooms + short-lived, room-scoped, least-privilege meeting tokens (server-only key)
- [x] Session page `/dashboard/session/[bookingId]` + Daily Prebuilt room; student/tutor dashboard join links
- [x] `session_presence` (join/leave evidence; not a completion signal) + signature-verified Daily webhook foundation
- [x] Fail-safe when Daily unconfigured (503, no state change); anti-poaching-safe display names
- [ ] Real Daily test-mode E2E — needs `DAILY_API_KEY`/`DAILY_DOMAIN`
- [ ] Wire Daily webhook (`DAILY_WEBHOOK_SECRET`) for reliable leave/attendance

### Phase 5B — Automatic session recording (DONE)
- [x] Automatic Daily cloud recording (room `enable_recording:"cloud"` + token `start_cloud_recording`, composed 720p)
- [x] Normalized `session_recordings` (many-per-booking); `record_recording_event` idempotent per recording/instance id
- [x] Recording lifecycle via Daily webhook (`recording.ready-to-download` / `recording.error`); room→booking verified
- [x] Admin-only RLS + secure ephemeral playback (`/api/admin/recording/access`); no permanent public URLs
- [x] Recording status/review integrated into admin dispute workflow; failure never affects booking/payment/earnings
- [x] Optional custom private S3 storage hooks (`DAILY_S3_*`, Mode B); Daily-managed default (Mode A)
- [ ] Real Daily recording E2E — needs `DAILY_API_KEY`/`DAILY_DOMAIN` (paid plan) + `DAILY_WEBHOOK_SECRET`
- [ ] Finalize recording-consent Terms/Privacy language (launch/legal readiness)

### Phase 6 — Production email, notifications & reminders (DONE)
- [x] Central idempotent notification service (Resend) + `email_deliveries` log (stable business-event keys)
- [x] Customer + tutor transactional emails (booking/free-trial/package/cancellation/reassignment/refund/dispute/tutor-approved)
- [x] Session reminders (day-before + final-hour) via secret cron; idempotent; excludes cancelled/expired/completed/no-show
- [x] Timezone-correct rendering (student vs tutor); app-route join links (never Daily URLs); server-resolved recipients
- [x] Resend Svix delivery webhook (delivered/bounced) + admin notification-failure visibility
- [ ] Real Resend E2E — needs `RESEND_API_KEY` + verified sender
- [ ] Wire crons (reminders + release-expired) to a scheduler; set `RESEND_WEBHOOK_SECRET`, `ADMIN_ALERT_EMAIL`
- [ ] Welcome email wiring on signup (function ready; not wired to avoid touching Supabase auth flow)

### Phase 7+ — NOT built yet
- [ ] SMS/WhatsApp/push, marketing, notification preferences, transcription/AI, ratings, advanced analytics
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
