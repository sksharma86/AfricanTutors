# Study Hall 365 — financial foundation (PR 2)

This document is the operational contract for subscription, à-la-carte, and
daily entitlement. Booking UI (Plan My Week) is PR3+.

## Products

| Offer | Customer price | Internal value | Stripe |
| --- | --- | --- | --- |
| Pay as you go | $12 / 60-minute Study Hall | existing `book_session` list price | Checkout `mode=payment` (unchanged) |
| 10 Study Halls | $100, never expire | `pkg_10sh` → **600 minutes** | existing package Checkout + webhook |
| Study Hall 365 | $149 / month | **daily entitlement**, not credits | Checkout `mode=subscription` |

1 Study Hall = 60 prepaid minutes internally. Existing minute ledgers are not rewritten.

## Timezone

Entitlement days are the household's **local civil date**.

Resolver (`resolve_account_timezone`):

1. `profiles.timezone` when set (IANA, e.g. `America/Chicago`)
2. first child's `students.timezone`
3. fallback `America/Chicago`

Clients cannot update `profiles.timezone` or `stripe_customer_id` (privilege guard).
Do not infer days from the server timezone or truncate UTC timestamps.

## Entitlement statuses

`isSubscriptionEntitled` / `study_hall_365_status_entitled`:

- **Entitled:** `active`; or `canceled` + `cancel_at_period_end` + now < `current_period_end`
- **Not entitled:** `trialing`, `past_due`, `unpaid`, `incomplete`, `incomplete_expired`, `paused`, `ended`

`past_due` is an explicit denial so a failed renewal cannot leave indefinite access.
Stripe retries may restore `active`. We do not use Stripe subscription trials.
The free first Study Hall remains a separate no-card path.

Paid window is half-open: `[current_period_start, current_period_end)`.
A local date is covered when that civil day **overlaps** the paid window.
A future booking start timestamp must fall inside the paid window (PR3).

## Daily consumption

Table `study_hall_365_day_usage` with `UNIQUE (account_id, local_date)`.

- Household / account scoped — siblings in one Study Hall consume **one** day
- Ordinary booking cancel does **not** restore the day
- Unused days do not bank, roll over, or convert to prepaid minutes
- No month-end credit job
- Month length is whatever the calendar says (28/29/30/31)

Call `consume_study_hall_365_day` (service role only) from booking in PR3.

## Cancellation

- `cancel_at_period_end = true` — no prorated cash refund or account credit
- Undo before period end via `/api/billing/membership` (`resume`) or Customer Portal
- Pause / freeze is not implemented

## Duplicate memberships

Server refuses a second open 365 membership (`study_hall_365_has_open_membership`
+ partial unique index on open rows). `ended_at` or `incomplete_expired` frees the slot.

## Webhooks

Existing `begin_stripe_event` / `complete_stripe_event` / `fail_stripe_event`
idempotency is reused (Stripe `evt_…` primary key).

New handling:

- `checkout.session.completed` with `kind=study_hall_365` → fulfill first invoice payment (no minutes) + upsert subscription
- `customer.subscription.created|updated|deleted`
- `invoice.paid` / `invoice.payment_failed` → retrieve subscription and upsert

Out-of-order: `upsert_study_hall_365_subscription` applies a snapshot only when
`event.created >= last_stripe_event_created`. Stale events are audited and skipped.

Success URLs never credit value.

## Stripe / Vercel configuration still required

1. `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (already required)
2. Optional `STRIPE_PRICE_STUDY_HALL_365` — monthly Price at **14900 cents**. If unset, Checkout uses `price_data`.
3. Stripe Dashboard webhook must include the subscription/invoice events above (in addition to existing Checkout / PaymentIntent events).
4. Stripe Customer Portal: enable update payment method + cancel at period end. `/api/billing/portal` returns 409 until that is configured.
5. Do **not** enable a Stripe subscription trial.

Production is **not** ready until those Dashboard items exist. Code does not hardcode live Price ids.

## Cutover

1. Apply `0036_study_hall_365.sql` (additive). Existing balances unchanged.
2. Confirm `pkg_10sh` is active (600 / $100). Leave `pkg_14h` / `pkg_28h` active until live purchase tests are updated and 10-pack Checkout is verified.
3. Parent Hours UI offers `pkg_10sh` when present; otherwise it falls back to remaining active packages so the old path is not removed before the new one works.
4. After 10-pack is verified in production, a later migration may set `pkg_14h` / `pkg_28h` `is_active=false`. Do **not** delete those rows.
5. Historical `pkg_10h` ($190 / 600 min, inactive) stays inactive forever.

## Deferred to PR3+

- Wire `book_session` to consume 365 daily entitlement
- Enforce PAYG = 60 minutes only
- Cancel future bookings after membership end
- Plan My Week / weekly calendar
- Courtesy restore of a consumed day
