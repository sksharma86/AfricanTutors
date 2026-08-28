# 58B — Controlled shared demo/test environment cleanup

Authorized destructive cleanup of the **shared development/testing** Supabase project identified in 58A (`giozoutlnbiqxlvixkho`). Not production. Not live Stripe.

The executable is `scripts/58b-shared-demo-cleanup.mjs`. It refuses to run unless:

- `CONFIRM=58B-DEMO-CLEANUP`
- `NEXT_PUBLIC_SUPABASE_URL` contains the 58A demo project ref

It does not call Stripe, Daily, Resend, or Twilio.

See `docs/58b-cleanup-result.json` after a successful run.
