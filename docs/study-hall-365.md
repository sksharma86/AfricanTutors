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

### PR3 booking contract

PR3 must pass the scheduled Study Hall **start instant** into:

- `get_study_hall_365_entitlement(..., p_booking_start)`
- `consume_study_hall_365_day(..., p_booking_start)`
- or `evaluateStudyHall365Day({ bookingStart })` / `getStudyHall365Entitlement({ bookingStart })`

Rules, in order:

1. Membership status must be entitled at `as_of`.
2. The household local civil date of the booking must overlap the paid window.
3. The booking start instant must satisfy `period_start <= start < period_end`.
4. That local date must not already be consumed.

A civil date can overlap the paid window (e.g. subscribe at 4pm local) while a
morning start that same day is still **before** `current_period_start`.
Step 3 rejects that. Do not book from civil-date overlap alone.

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

## Parent-facing membership data

Raw `study_hall_365_subscriptions` / `study_hall_365_day_usage` rows are
server/admin only after `0037`. Parents do **not** SELECT those tables.

Parent Hours UI and `GET /api/billing/membership` call
`get_study_hall_365_membership`, which returns only:

- `customer_status` (`active` | `cancels_at_period_end` | `inactive`)
- `entitled`
- `cancel_at_period_end`
- `current_period_start` / `current_period_end`

Never returned: `stripe_subscription_id`, `stripe_customer_id`,
`stripe_price_id`, `last_stripe_event_id`, `last_stripe_event_created`,
invoice ids.

Admins may SELECT the raw tables (existing `is_admin` policy) for later ops.
Guides have no access.

`profiles.stripe_customer_id` remains a pre-existing Phase 4A own-row column.
PR80 billing routes never send it to the browser.

## Customer Portal flow

1. Authenticated parent clicks Manage billing.
2. `POST /api/billing/portal` uses `getCurrentUser()`.
3. Service role reads `profiles.stripe_customer_id` (never the browser).
4. Server creates a Stripe Billing Portal session.
5. JSON response is `{ url }` only.

## Stripe / Vercel configuration still required

1. `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (already required)
2. **Production:** `STRIPE_PRICE_STUDY_HALL_365` is **required** when
   `VERCEL_ENV=production`. Create a Stripe Product **Study Hall 365** with a
   recurring Price: **$149.00 USD / month**. Do not hardcode the Price id.
   Local/dev may omit it and use inline `price_data` for the same amount.
3. Stripe Dashboard webhook must include the subscription/invoice events above (in addition to existing Checkout / PaymentIntent events).
4. Stripe Customer Portal: enable update payment method + cancel at period end. `/api/billing/portal` returns 409 until that is configured.
5. Do **not** enable a Stripe subscription trial.

Production is **not** ready until those Dashboard items exist. Code does not hardcode live Price ids.

## Cutover

1. Apply `0036_study_hall_365.sql` and `0037_study_hall_365_parent_privacy.sql`. Existing balances unchanged.
2. Confirm `pkg_10sh` is active (600 / $100). Leave `pkg_14h` / `pkg_28h` **`is_active=true`** until live `purchase_package` tests are updated and production 10-pack Checkout is verified.
3. Parent Hours UI (`customerFacingPrepaidPackages`): if `pkg_10sh` is present, list **only** that SKU. Parents do not see 14h + 28h + 10-pack together. If `pkg_10sh` is missing, fall back to remaining active rows.
4. `purchase_package` can still sell 14h/28h by id while they stay active (API, not Hours UI).
5. Set `pkg_14h` / `pkg_28h` `is_active=false` in a **later** migration after: (a) `0036` is in production, (b) 10-pack webhook credit is verified live, (c) phase4/PR2 live tests that buy `pkg_14h` are updated. Do **not** delete those rows.
6. Historical `pkg_10h` ($190 / 600 min, inactive) stays inactive forever.

## Deferred to PR3+

- Wire `book_session` to consume 365 daily entitlement
- Enforce PAYG = 60 minutes only
- Cancel future bookings after membership end
- Plan My Week / weekly calendar
- Courtesy restore of a consumed day
