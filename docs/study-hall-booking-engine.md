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
2. Create the booking (`create_booking` re-checks Guide availability).
3. Lock the entitled subscription row and insert `study_hall_365_day_usage`.
4. If the unique `(account_id, local_date)` insert hits a conflict, the exception rolls back the booking.

Do not call `consume_study_hall_365_day` from the browser. That RPC is financial-actor only; booking inserts usage itself.

A failed booking (no Guide, past time, outside paid window, conflict) never writes a usage row.

Cancel does not restore the 365 day. The parent cannot cancel 4 PM and rebook 7 PM on 365 the same local date. Prepaid/PAYG remain available as a separate request.

## Prepaid cancellation

Unchanged: `customer_cancel_booking` + `restore_booking_value`. Early (≥24h or unscheduled) restores package minutes. Late (<24h) does not. 365 usage is not part of that restore.

## Snapshots

`bookings.funding_source` is written at creation (`free_trial` | `study_hall_365` | `prepaid` | `credit` | `payg` | `request`). Historical rows may be null. Later membership changes do not relabel old bookings.

## Prepaid leftover minutes

Customer copy uses Study Halls (`9 Study Halls remaining`). A non-multiple of 60 is honest: `1 Study Hall + 30 leftover minutes` or `20 leftover minutes`.
