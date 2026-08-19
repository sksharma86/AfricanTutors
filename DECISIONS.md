# African Tutors — Architecture & Product Decisions

A running log of notable decisions and the reasoning behind them. Newest
entries at the bottom.

---

## 2026-08-15 — Responsive web app, not native mobile apps

**Decision:** African Tutors will launch as a responsive web application
rather than separate native mobile applications.

**Reasoning:** A single Next.js codebase deployed to Vercel can serve
desktop, laptop, tablet, iPhone, and Android browsers well, without the
added cost, review overhead, and maintenance burden of separate iOS/Android
codebases. This matches the explicitly requested technology stack and lets
the team ship and iterate on one product surface. Native apps can be
revisited later if usage patterns justify the investment.

## 2026-08-15 — Architecture minimizes tutor↔student contact exposure

**Decision:** The system will be architected to minimize direct tutor to
student contact exposure and reduce off platform circumvention opportunities.

**Reasoning:** Preventing tutor-to-client poaching and off-platform
circumvention is a central business requirement, not a bolt-on feature. If
the data model and UI expose personal contact information (auth emails,
phone numbers, unmanaged messaging/video links) early on, retrofitting
protection later is much harder — every place that leaked contact info has
to be found and fixed, likely after bad habits have already formed among
early users. Instead, Phase 1 establishes: a profile layer decoupled from
auth credentials, booking-centric data relationships, and a documented set
of principles (`ARCHITECTURE.md` → "Tutor to Client Circumvention
Prevention") that all future features (messaging, video, payments) are
expected to follow.

## 2026-08-15 — Supabase Auth roles are never client-assigned

**Decision:** A user can never grant themselves `tutor` or `admin` access by
simply selecting it in a form. Signup only records a `requested_role`
(student/tutor) as a hint; actual tutor access requires admin approval
(`tutor_profiles.status`), and admin accounts are provisioned directly by
the owner/engineering team.

**Reasoning:** Client-supplied role data can always be tampered with. Trust
must be rooted in server-side state (ultimately Postgres, enforced by RLS
and/or server checks), not in what a signup form happens to submit.

## 2026-08-15 — Auth code is written for Supabase from day one, but degrades gracefully without credentials

**Decision:** Supabase client/server utilities and login/signup forms were
built now, even though no Supabase project is connected yet. When
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` are absent, the
app detects this (`isSupabaseConfigured`) and renders forms in a disabled,
clearly-labeled "not configured yet" state instead of crashing or faking
success.

**Reasoning:** This lets Phase 1 ship a real, inspectable authentication UI
and the exact integration seam future phases will use, while still being
fully runnable/testable in an environment that has no external credentials
configured. It avoids a throwaway "fake" auth UI that would need to be
rebuilt later.

## 2026-08-15 — Design direction: modern edtech, not stereotypical or charity-styled

**Decision:** The visual design uses a warm amber/terracotta accent color as
a subtle nod to African-inspired warmth, paired with a neutral ink/navy
palette, a serif display font for headings, and generous whitespace —
avoiding heavy traditional patterns, cartoonish styling, or
charity/nonprofit visual language.

**Reasoning:** The brand should read as a credible, premium education
technology company that happens to focus on Africa, not a stereotype of
"African" visual tropes or a nonprofit aesthetic. This keeps the platform
positioned as a serious commercial product.

## 2026-08-16 — Finalized pricing: $12 / 30 min and $20 / 60 min

**Decision:** Customer pricing is $12 for a 30-minute session and $20 for a
60-minute session. The earlier `$19.50/hour` planning figure is obsolete and
removed everywhere.

**Reasoning:** The owner finalized a per-session model with two clear session
lengths. Flat, per-session pricing is simpler to communicate than an hourly rate
and maps cleanly onto the two session lengths Prompt 3's booking system will
support.

## 2026-08-16 — First 30-minute session is free, with no card required

**Decision:** Every legitimate new student gets one free 30-minute one-on-one
tutoring session. No credit card, debit card, deposit, subscription, or payment
authorization is required to claim or book it. It is a real tutoring session,
never marketed as a "free consultation."

**Reasoning:** Fulfillment cost for a 30-minute intro session is very low
(~$2.50 of tutor labor — internal, see `BUSINESS_MODEL.md`), and reducing
customer-acquisition friction at launch matters more than preventing every case
of free-trial abuse. Requiring a card would suppress conversions from a
new, unfamiliar service more than trial abuse would cost.

## 2026-08-16 — Accept low-level free-trial abuse; monitor before adding friction

**Decision:** We will not build invasive fraud prevention, fingerprinting, or
card verification for the free trial now. We accept that a small amount of abuse
may occur, will track free-trial usage in the data model, and will monitor abuse
before introducing any stronger friction.

**Reasoning:** Over-engineering anti-abuse ahead of real data would add friction
and complexity for little benefit given the low per-trial cost. The future data
model still records enough to measure abuse and free-trial → paid conversion.

## 2026-08-16 — Tutor compensation is private internal information

**Decision:** Tutor compensation and unit economics ($5/hour planned pay, and
the derived labor costs) live only in `BUSINESS_MODEL.md` and never in
customer-facing code, content, or `src/lib/pricing.ts`.

**Reasoning:** Exposing tutor pay or margins publicly would harm negotiating
position and brand perception. Keeping a hard separation between customer-facing
pricing (`src/lib/pricing.ts`) and internal economics prevents accidental leaks.

## 2026-08-16 — Managed matching, not a tutor marketplace (Prompt 3)

**Decision:** Students never browse or pick from a public tutor catalog. They
tell African Tutors what they need and when; `create_booking()` auto-assigns an
eligible approved tutor (repeat-tutor preference → least workload → id).

**Reasoning:** The business owns the student and tutor relationships, pricing,
and quality control. Managed assignment supports the anti-poaching model (no
tutor profiles/contact exposed) and lets us evolve ranking later without
changing the family-facing flow.

## 2026-08-16 — Authoritative times in UTC; availability interpreted in local tz

**Decision:** All appointment instants are stored as UTC `timestamptz`. Tutor
recurring availability is stored as weekday + local time interpreted in the
tutor's IANA timezone; the UI renders every time in the viewer's own timezone.

**Reasoning:** Tutors in Africa and students in the US must both see correct
local times for the same instant. Storing ambiguous local timestamps as the
source of truth would cause DST/offset bugs that are disastrous for a scheduling
product.

## 2026-08-16 — Booking-critical rules enforced in the database

**Decision:** Double-booking prevention (gist exclusion constraint), one-free-
trial-per-student (partial unique index + server check), pricing, matching, and
authorization all live in Postgres (constraints + SECURITY DEFINER functions +
RLS), never trusted from the client.

**Reasoning:** Client checks can be bypassed. DB-level enforcement guarantees
correctness under concurrency and against tampering, which is essential for
money-adjacent scheduling and free-trial abuse limits.

## 2026-08-16 — Privacy-safe denormalization on bookings

**Decision:** Bookings carry only the minimum a tutor needs (student first name,
grade, subject, request note) as denormalized columns; tutors have no access to
the `students` table and no contact fields exist on bookings.

**Reasoning:** Lets a tutor read their assigned sessions under simple RLS
without ever exposing parent/student contact info — enforcing the anti-poaching
requirement at the data layer.

## 2026-08-16 — Parent-first: the free trial belongs to the student

**Decision:** A `students` table represents learners owned by an account; the
free trial and booking history belong to the student, not the login. The current
auth architecture is unchanged.

**Reasoning:** The primary customer is often a parent with multiple children.
Modeling learners separately avoids a costly rebuild later while keeping the
existing authentication intact.

## 2026-08-16 — Cancellation/rescheduling/refund policy deferred

**Decision:** The system supports cancellation structurally (`cancel_booking()`,
admin cancel) but promises no free cancellation, reschedule, or refund. Booking
horizon and lead time are configurable constants (`src/lib/booking-config.ts`).

**Reasoning:** The owner has not finalized commercial policy. We avoid inventing
policy and keep the knobs configurable so the decision can be applied later
without scattered code changes.

## 2026-08-16 — No fake payments or video before their phases

**Decision:** Paid bookings are created `awaiting_payment` with no money moved,
no card stored, and no invented transaction id. No Twilio rooms/links are
created. Both have documented, clean attachment points on `bookings`.

**Reasoning:** Prompt 3 is a scheduling foundation. Faking payment/video state
would corrupt data the Stripe/Twilio phases depend on.

## 2026-08-17 — Repeat-tutor continuity is same-subject and never overrides scheduling (Prompt 3B)

**Decision:** `create_booking` prefers a tutor only if they *completed* a prior
session with the same student **for the same subject** and are still approved,
qualified, and available; otherwise it falls back to least-workload matching.

**Reasoning:** Continuity should be subject-specific (a tutor a student liked for
Algebra isn't necessarily their Chemistry tutor) and must never assign an
unavailable or now-unqualified tutor. Scheduling correctness wins.

## 2026-08-17 — Free-trial consumption rule

**Decision:** One free 30-min trial per student. A trial **cancelled** before it
happens **restores** eligibility; a **completed** trial consumes it; a
**no_show** consumes it. Enforced by the partial unique index
`(student_id) where is_free_trial and status <> 'cancelled'` plus a server check.

**Reasoning:** This is the simplest rule compatible with the existing 3A
constraint and matches the intent (only a genuinely delivered/served trial
should burn eligibility; a clean cancellation shouldn't penalize the family).
No refund/payment policy is implied.

## 2026-08-17 — Availability/booking engine is not anonymous-callable (Prompt 3B)

**Decision:** Execute on `get_available_slots`, `tutor_is_available`, and
`has_used_free_trial` is revoked from `public`; only authenticated users (and the
service role) can call the booking engine. `create_booking` was already
authenticated-only.

**Reasoning:** Booking is a logged-in action; anonymous callers have no
legitimate need to enumerate availability, and locking it down supports the
anti-poaching/privacy posture.

## 2026-08-17 — Unpaid paid bookings are pending with an expiring hold (Prompt 3D)

**Decision:** A paid booking before payment is `status = pending`,
`payment_status = awaiting_payment`, with `payment_hold_expires_at = now() + 15m`
(configurable dev default). It is never treated as a confirmed session. A new
`expired` status marks timed-out unpaid holds; `release_expired_holds()` frees
those slots, and availability logic ignores expired holds. Free trials remain
`confirmed`/`not_required`. Verified Stripe payment (Prompt 4) will move a paid
booking to `confirmed`/`paid`.

**Reasoning:** Marking an unpaid session `confirmed` is semantically wrong and
would let an abandoned checkout block a tutor's slot forever. A short expiring
hold reserves the slot briefly, then releases it — the clean seam Stripe attaches
to. A CASE assigning the status enum must be cast (`::booking_status`) to avoid a
text/enum mismatch.

## 2026-08-17 — Video rooms attach only to confirmed bookings

**Decision:** A future Twilio room may only attach to a `confirmed` booking (free
trial or paid-and-verified). `pending`/`awaiting_payment`/`expired` bookings never
receive a room.

**Reasoning:** No unpaid or lapsed booking should grant a live tutoring session;
gating on `confirmed` keeps fulfillment aligned with payment/eligibility.

## 2026-08-18 — Ledger-based finances in integer cents (Phase 4A)

**Decision:** Financial state is auditable ledgers (`package_minute_ledger`,
`dollar_credit_ledger`), not mutable balance columns. Balances are derived by
SUM. All monetary values are integer cents; no floating point. Package products
live in a `package_products` table (seeded), never as authoritative frontend
constants. Package minutes and dollar credit are distinct instruments; both never
expire.

**Reasoning:** Auditability and correctness for money require an immutable
transaction history; cached balances can drift. Cents-as-integers avoid
floating-point rounding bugs. Table-driven products let pricing/offerings change
without code.

## 2026-08-18 — Tutor compensation is separate, admin-only, and rate-snapshotted

**Decision:** `tutor_profiles.comp_rate_cents_per_hour` is admin-only (guard
trigger + `admin_set_tutor_rate`); tutors can't set it. Customer pricing and
tutor pay are unrelated. `tutor_earnings` snapshots the rate used, so later rate
changes never rewrite historical earnings. 30-minute sessions pay 50% of the
hourly rate. The free trial charges the customer $0 but still records a normal
tutor earning.

**Reasoning:** Pay is confidential company-controlled supply economics, distinct
from customer price. Snapshotting preserves accurate history for future payouts.

## 2026-08-18 — Financial mutations are SECURITY DEFINER, idempotent, concurrency-safe

**Decision:** Only admins or the service role (`is_financial_actor`) can move
money, via SECURITY DEFINER functions. Idempotency uses unique `reference`
(ledgers), unique `booking_id` (earnings), and a `stripe_events` table (webhook
event ids). Consumption takes a per-account advisory lock and re-checks balance.
Stripe webhook signature verification (raw body) is authoritative; success
redirects are never trusted.

**Reasoning:** Browsers must never do read-then-write money logic; duplicate
Stripe deliveries and concurrent spends must be safe. Webhooks are the only
trustworthy payment signal.

## 2026-08-18 — Stripe events use a claim→fulfill→complete lifecycle (4A review)

**Decision:** Replace the record-then-done webhook idempotency with a
`begin_stripe_event` (claimed/duplicate/in_progress) → fulfill →
`complete_stripe_event`/`fail_stripe_event` lifecycle. An event is "completed"
only after fulfillment succeeds; failed events are retryable; a concurrent
duplicate delivery gets `in_progress` (409) and never double-fulfills.

**Reasoning:** Recording an event as processed before fulfillment would (once 4B
adds fulfillment) let a failed-then-retried delivery skip fulfillment, so a paid
customer might never be credited. The lifecycle makes success the only terminal
state that suppresses retries.

## 2026-08-18 — Financial history is never physically deleted (4A review)

**Decision:** Financial FKs to profiles (`payments.account_id`, both ledgers'
`account_id`, `tutor_earnings.tutor_id`) are `ON DELETE RESTRICT`; ledger/audit
`created_by`/`actor_id` are `ON DELETE SET NULL`. Ledger idempotency `reference`
is NOT NULL + non-blank. Tutor earnings derive tutor + duration from the
authoritative booking.

**Reasoning:** Cascading deletes would erase auditable financial history when a
profile is removed. RESTRICT forces a deliberate soft-delete/anonymize path
instead. Non-null references keep idempotency guarantees real (Postgres unique
allows multiple NULLs). Deriving earnings from the booking prevents wrong-tutor
or arbitrary-duration earnings.

## 2026-08-18 — Booking funding priority: package → credit → Stripe (Phase 4B)

**Decision:** `book_session` prices a session server-side and picks funding in a
fixed order: use package minutes ONLY if they cover the ENTIRE session (partial
minutes are never touched); otherwise apply available dollar credit; then charge
the remainder through Stripe. Fully-internal outcomes (package, full credit, free
trial) confirm the booking inside one transaction with no Stripe object. Mixed /
Stripe-only bookings stay `pending`/`awaiting_payment` on the existing 15-minute
hold until a verified webhook confirms them.

**Reasoning:** Matches the authoritative business rule and keeps zero-Stripe cases
free of fake $0 charges while still writing auditable payment/ledger records.

## 2026-08-18 — Partial credit uses consume-and-restore, not a separate hold (Phase 4B)

**Decision:** When a booking (or package) needs partial credit + Stripe, the
credit is consumed immediately as a ledger `consumption` linked to the payment.
If the hold expires or payment fails, `release_expired_holds` restores the exact
amount via an idempotent `restore:<payment_id>` entry and cancels the payment. On
success the consumption stands.

**Reasoning:** Consuming up front makes the credit un-spendable elsewhere while a
Stripe payment is outstanding (no double-spend), and the idempotent restore keeps
it from being stranded. Simpler and more auditable than a parallel reservation
state on the balance.

## 2026-08-18 — Delayed Stripe success after expiry credits the account (Phase 4B)

**Decision:** If a Stripe payment for a booking succeeds AFTER the slot expired,
`fulfill_booking_payment` does not reactivate the slot. It restores any reserved
credit and issues the Stripe amount as dollar credit (`delayed:<payment_id>`),
marks the payment succeeded with a note, and the return page shows a "value
credited" state. The customer keeps 100% of the value for a future booking.

**Reasoning:** Re-confirming an expired slot could double-book a tutor; refusing
the money would strand the customer. Crediting the balance is the safe,
foundation-compatible behavior.

## 2026-08-18 — Hosted Stripe Checkout Sessions; webhook is authoritative (Phase 4B)

**Decision:** Use Stripe Checkout Sessions (hosted), not raw PaymentIntents.
Amount/currency/metadata are set server-side; idempotency keys guard session
creation; `ensureStripeCustomer` is concurrency-safe. Fulfillment happens only in
the signature-verified webhook via `fulfill_booking_payment` /
`fulfill_package_payment`, which are idempotent at the payment-object and ledger
levels. The `/checkout/return` page reads internal state and never trusts the
redirect. Customer emails are a documented stub (`src/lib/email.ts`) that upgrades
to Resend when `RESEND_API_KEY` is set.

**Reasoning:** Checkout Sessions need no card UI and keep the app out of PCI
scope. Double-layer idempotency prevents duplicate minutes/confirmations from
Stripe re-delivery or overlapping session/payment_intent events.

## 2026-08-19 — Stripe session lifetime is separate from the 15-min internal hold (4B review)

**Decision:** The African Tutors booking/payment hold stays **15 minutes** and is
authoritative in the DB (`payments.expires_at`, `bookings.payment_hold_expires_at`).
Stripe Checkout Sessions require `expires_at` in [30 min, 24 h], so the hosted
session is created with a 30-minute lifetime (`src/lib/stripe/checkout-expiry.mjs`,
`stripeCheckoutExpiresAt`). The internal 15-min expiry fires first and releases the
slot / restores credit; a payment made via a still-open Stripe session in the
15–30-min window is handled by delayed-payment logic (value credited, nothing
resurrected). A pure unit test asserts the value sent to Stripe is always ≥ 30 min.

**Reasoning:** The prior code sent a 15-min `expires_at`, which live Stripe would
reject. Business hold and Stripe session lifetime are different concerns; the DB
remains authoritative and the extra Stripe window is covered by delayed-payment.

## 2026-08-19 — Package checkouts have an authoritative expiry; reserved credit is never stranded (4B review)

**Decision:** `payments.expires_at` now applies to package Stripe reservations too
(15-min internal). `release_expired_checkouts()` sweeps expired booking holds AND
expired package reservations, restoring reserved credit (idempotent
`restore:<payment_id>`) and canceling the payment without issuing minutes.
`cancel_pending_payment(payment_id, reason)` is an explicit, idempotent rollback
used when Stripe Checkout creation fails or Stripe is unavailable after a DB
reservation — for both bookings (also releases the slot) and packages. The
checkout service calls it on any Stripe failure and the webhook calls it on
`checkout.session.expired` / `*payment_failed`. Package cleanup keys off
`payments.expires_at`, never `bookings.payment_hold_expires_at` (a package has no
booking).

**Reasoning:** Package reservations previously had no release path, so abandoned
or failed Stripe checkouts could strand credit indefinitely. A payment-level
expiry + explicit rollback closes that gap and reuses the existing `payments`
architecture instead of a parallel system.

## 2026-08-19 — Late package payment credits the account (mirrors booking policy)

**Decision:** If Stripe succeeds after a package reservation already expired,
`fulfill_package_payment` does NOT issue the package: it restores any reserved
credit (idempotent) and credits the Stripe-paid amount to the account balance
(`delayed:<payment_id>`), marking the payment succeeded with a note. Package
minutes are issued exactly once and only on the still-pending path.

**Reasoning:** Consistency with the booking delayed-payment principle — an expired
transaction must not silently resurrect — while never losing the customer's money.

## 2026-08-19 — Payment expiry is self-enforcing at fulfillment (4B review 2)

**Decision:** `fulfill_booking_payment` and `fulfill_package_payment` now evaluate
the authoritative deadline themselves (while the payment/booking rows are locked)
instead of trusting that a sweeper already ran. A booking is treated as expired if
`payments.expires_at <= now()` OR `bookings.payment_hold_expires_at <= now()` (and
not already confirmed) OR the row was already swept to a terminal/expired state; a
package is expired if `payments.expires_at <= now()` OR already canceled/failed.
When expired, fulfillment runs the delayed-payment path (restore reserved credit +
credit the Stripe amount, both idempotent) and never confirms the booking or
issues package minutes. `release_expired_checkouts()` remains a proactive cleanup
but is NOT required for correctness.

**Runtime scheduling:** `release_expired_holds()` still runs opportunistically at
the top of `create_booking`/`book_session`; `release_expired_checkouts()` has no
automated cron yet (invoked on demand and via Stripe `checkout.session.expired` /
`*payment_failed` webhooks). Because fulfillment self-enforces the deadline, the
absence of a cron can no longer cause a wrong confirmation/issuance — the cron is
future operational polish, tracked in TODO.

**Race safety:** the payment row `FOR UPDATE` lock (shared by fulfillment and the
sweeper's `cancel_pending_payment`) serializes the two paths; unique ledger
references (`restore:<payment_id>`, `delayed:<payment_id>`) guarantee reserved
credit is restored once and the Stripe amount is credited once, with no duplicate
ledger rows and no booking confirmation / package issuance after expiry.

## 2026-08-19 — Cancellation 24-hour rule is server-authoritative (Phase 4C)

**Decision:** `customer_cancel_booking` computes early vs late from `scheduled_start`
server-side (never a client flag). Early (≥24h or unscheduled) restores package
minutes if the booking was package-funded, otherwise the FULL booking value
(credit + Stripe) as account credit — mixed funding returns the total as credit,
never credit + a separate Stripe refund. Late (<24h) restores nothing and pays
the tutor 100%. Idempotent via booking status guard + unique restore references
(`cancel:pkg:<booking>`, `cancel:credit:<booking>`). Ordinary cancellation never
triggers an automatic Stripe cash refund.

**Reasoning:** Matches the authoritative policy, prevents client tampering and
double-restoration, and keeps cash refunds an explicit admin decision.

## 2026-08-19 — Tutor earnings are event-driven, rate-snapshotted, admin-managed (Phase 4C)

**Decision:** Full earnings are created by authoritative booking events
(complete / late-cancel / no-show / free-trial completion) via
`record_full_earning` (rate snapshot, one per booking). Early/tutor cancellation
create no earning. `try_full_earning` never aborts a state change if a rate is
missing (defers with an audit note). Reassignment makes the new tutor the
authoritative earner (earnings are created later, keyed on the booking's current
tutor). Admin lifecycle: mark paid (single/batch, no double-pay), adjust
(preserves `adjusted_from_cents`), void/restore. Payouts are recorded only — no
Stripe Connect.

**Reasoning:** Ledger-style, auditable earnings with immutable historical rates;
manual payouts in V1 as specified.

## 2026-08-19 — Refunds are capped, idempotent, and separate from credit (Phase 4C)

**Decision:** `refunds` table + `admin_record_refund` cap at the refundable Stripe
amount (`stripe_paid_cents - refunded_cents`), are idempotent per
`stripe_refund_id`, and update `payments.refunded_cents`/status. `/api/admin/refund`
creates the Stripe refund server-side first (using the DB-stored payment intent),
then reconciles. A Stripe refund and account credit are distinct and only both
occur if an admin explicitly chooses both. Mixed bookings can never be Stripe-
refunded beyond their Stripe-paid portion.

**Reasoning:** Prevents over-refunding and double-application; keeps cash vs
internal credit unambiguous.

## 2026-08-19 — Internal disputes with hidden admin notes (Phase 4C)

**Decision:** `disputes` (one active per booking via a partial unique index).
Customers submit via `create_dispute` (own eligible booking) and read a safe
projection via `get_my_disputes` — the base table is admin-RLS-only so
`admin_notes`/reviewer identity are never exposed. `admin_resolve_dispute`
supports denied / courtesy / upheld with any explicit mix of minute restore,
account credit, Stripe refund, and tutor-earning void/adjust (no hard-coded
outcome). `bookings.recording_ref` is a placeholder for future recording review.

**Reasoning:** Company-arbitrated quality control with no automatic
satisfaction-guarantee refund and strict separation of customer vs admin views.
