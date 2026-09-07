# Study Hall booking engine (PR3)

One customer Study Hall is **exactly 60 minutes**. Historical 120/180 bookings stay as recorded.

## Flow

Who → When → Confirm.

Duration is not a customer choice. The server rejects any new scheduled Study Hall that is not 60 minutes. `?duration=` is ignored. `get_available_slots(null, …)` only accepts 60.

## Funding priority (server, one request = one source)

1. **Unused free first Study Hall** — even if 365 is active. A new 365 member who has not used the free session still gets the free session first; that day’s 365 entitlement remains.
2. **Study Hall 365** — if that start instant is entitled (`current_period_start <= start < current_period_end`) and the **booking start's** local date is unused. Timezone is `profiles.timezone` via `resolve_account_timezone`. Do not evaluate today's civil date.
3. **Prepaid minutes** — if balance ≥ 60. Consumes exactly 60.
4. **Account credit** — existing dollar-credit path (unchanged).
5. **PAYG** — $12 (1200 cents). 15-minute payment hold. Signed webhook confirms. Success URL is not authority.

A consumed 365 day does **not** block prepaid/PAYG. Confirmation shows the paid source in customer language (not `funding_source`).

Client cannot set `funding_source`, price, or a non-60 duration. Guides cannot call `book_session` for parent-funded Study Halls.

## 365 transaction

`book_session` (one SECURITY DEFINER transaction):

1. Validate children / duration / household.
2. If the start's local date is entitled, lock the membership row, re-read usage, then create the booking and insert `study_hall_365_day_usage`.
3. Unique `(account_id, local_date)` is the one-per-day 365 authority. Two concurrent same-day attempts cannot both consume 365.
4. If that insert loses (day already consumed), the booking is **not** aborted. The same transaction continues through prepaid, then credit, then PAYG.

Do not call `consume_study_hall_365_day` from the browser. That RPC is financial-actor only; booking inserts usage itself.

A failed booking (no Guide, past time, outside paid window) never writes a usage row.

Cancel does not restore the 365 day. The parent cannot cancel 4 PM and rebook 7 PM on 365 the same local date as a **second** request. Prepaid / credit / PAYG remain available as a separate request.

## Change (Plan My Week replacement)

`book_session` receives `p_replaces_booking_id` from the server (Plan My Week / checkout). The client does not choose funding.

**CASE A — additional same-local-day Study Hall.** The existing 365 session remains. A new booking without a replace id, or whose replace id is not the booking that owns that day's usage, cannot consume 365 again. It falls through to prepaid / credit / PAYG (0040).

**CASE B — replace the 365 session on the same local date.** The replacement is that day's one included Study Hall. `book_session` reassociates the existing `study_hall_365_day_usage.booking_id`, funds the new row as `study_hall_365`, returns `stripe_cents_due = 0` (no Checkout), and cancels the old row in the same transaction. Exactly one usage row remains. No prepaid or credit deduction.

**CASE C — replace onto a different local date.** The old day's usage is not transferred. The destination date uses independent 365 eligibility. If that date is unused and entitled, the new booking consumes it as 365; the old date stays consumed after cancel (existing policy). If the destination is already consumed or not entitled, prepaid / credit / PAYG apply, then 0041 finalizes the original.

Free-trial Change is the same shape as CASE B: the live trial row is cancelled in-transaction so the unique one-per-account index can attach to the successor. The replacement stays `free_trial`; it does not fall through to 365 / prepaid / PAYG.

Immediate (prepaid / credit) Change still books the new session first, then `finalize_booking_replacement` cancels the old one with existing restore economics (early restore, late forfeit). PAYG Change persists `bookings.replaces_booking_id` before returning Stripe Checkout. Do **not** cancel the original because a checkout URL exists. `fulfill_booking_payment` confirms the new booking, then cancels the original. Abandoned, expired, or failed payment leaves the original intact. Duplicate webhooks are idempotent. Success URL is not authority.

A same-day 365 replacement must never create a Stripe Checkout in order to undo it later.

Ordinary (non-Change) PAYG checkout does not set `replaces_booking_id`. The booking wizard does not pass a replace id.

## Prepaid cancellation

Unchanged: `customer_cancel_booking` + `restore_booking_value`. Early (≥24h or unscheduled) restores package minutes. Late (<24h) does not. 365 usage is not part of that restore.

## Snapshots

`bookings.funding_source` is written at creation (`free_trial` | `study_hall_365` | `prepaid` | `credit` | `payg` | `request`). Historical rows may be null. Later membership changes do not relabel old bookings.

## Prepaid leftover minutes

Customer copy uses Study Halls (`9 Study Halls remaining`). A non-multiple of 60 is honest: `1 Study Hall + 30 leftover minutes` or `20 leftover minutes`.
