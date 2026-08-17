# African Tutors — Business Model (INTERNAL ONLY)

> **INTERNAL — NOT FOR PUBLIC / CUSTOMER-FACING USE.**
> Nothing in this file may appear on the public website or in the
> customer-facing application. In particular, **tutor compensation is private
> internal business information** and must never be exposed to students,
> tutors, or the public UI. Customer-facing pricing lives in
> `src/lib/pricing.ts`; internal economics live only here.

## Finalized customer pricing (Prompt 2.7)

| Session length | Customer price |
| --- | --- |
| 30 minutes | $12 |
| 60 minutes | $20 |

**New customer offer:** a legitimate new student's **first 30-minute session is
free**. **No credit card or payment method is required** to claim or book the
free session.

The old `$19.50/hour` figure referenced in earlier planning is **obsolete** and
must not appear anywhere.

## Session economics (PRIVATE)

- Customer price: $12 (30 min) / $20 (60 min).
- Planned tutor compensation: **$5/hour**.
- Therefore planned tutor labor cost: **$2.50 (30 min) / $5.00 (60 min)**.
- Initial free-trial direct tutor labor cost: **~$2.50**.

Because the fulfillment cost of a 30-minute intro session is very low, the
business **intentionally accepts a small amount of free-trial abuse** rather
than adding acquisition friction. We do **not** require a card, deposit, or
payment authorization for the free session, and we do **not** build invasive
fingerprinting/surveillance. Trial abuse should be **monitored** before any
stronger friction is introduced.

## Free-trial eligibility model (intended rule)

- Each legitimate new student receives **one** free 30-minute introductory
  session.
- Keep fraud-prevention simple at launch; accept low-level abuse as a customer
  acquisition cost.
- The future data model (see `DATABASE.md`) must let us track, per student:
  whether the free trial was claimed, whether the free session was booked,
  whether it was completed, which tutor conducted it, and whether the student
  subsequently purchased a paid session.

## Conversion metrics to track (future — Prompt 3+ analytics)

These metrics will determine whether the free-trial acquisition model works:

- Visitor → signup
- Signup → free trial booked
- Free trial booked → free trial completed
- Free trial completed → first paid session
- First paid session → second paid session
- 30-day / 60-day / 90-day retention
- Average tutoring hours per active student
- Customer acquisition cost (CAC)
- Cost per completed free trial
- Free trial → paid conversion rate
- Tutor-specific free trial → paid conversion rate

Do not build the analytics dashboard yet; this is the target metric set.

## Prompt 3A — data foundation for the metrics (INTERNAL)

The booking system now records the raw data these metrics need, without building
the dashboards:

- Free-trial funnel: `bookings.is_free_trial`, `status` (booked → completed →
  no_show/cancelled), `tutor_id`, `completed_at`, and `created_at` allow
  computing trial booked/completed, which tutor conducted it, the first paid
  booking afterward, and time-from-trial-to-first-paid — per student and per
  tutor.
- Tutor performance: sessions completed, no-shows, cancellations, hours taught,
  trial→paid conversion, and repeat-student rate are all derivable from
  `bookings` grouped by `tutor_id`. Not displayed publicly.
- Matching cost lever: the assignment order (repeat-tutor → least workload) is
  where future ranking will incorporate conversion/performance once the metrics
  above are calculated.

Tutor compensation remains private and never appears in customer-facing code.
Cancellation/refund policy (which affects unit economics) is still an open owner
decision.
