# African Tutors — Setup & External Services

This document tracks the external services African Tutors depends on, and
exactly what will eventually be needed from the owner. **Nothing here needs
to be provided yet** unless a specific item says otherwise — credentials are
requested only when the feature that needs them is actually being built.

## Running the app locally today

No external service is required to run Phase 1 of the app:

```bash
npm install
npm run dev
```

The app runs with authentication in a visibly "not configured yet" state
until Supabase credentials are supplied (forms render but are disabled).
Nothing else in this phase depends on an external service.

## Supabase (Auth + Database)

**Needed when:** we start wiring up real authentication and persisting data
(next development phase).

What we'll need from the owner at that point:

- A Supabase project (the owner can create one for free at
  [supabase.com](https://supabase.com), or authorize engineering to create
  one on the owner's behalf).
- From the project's API settings: the Project URL, the `anon` public key,
  and the `service_role` secret key.

Where they go: `.env.local` (never committed) as `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. See
`.env.example` for the full list of placeholders.

## Stripe (Payments)

**Needed when:** we build checkout/booking payments (explicitly out of
scope for Phase 1).

What we'll need eventually:

- A Stripe account (test mode is fine to start).
- Publishable key, secret key, and a webhook signing secret once webhooks
  are configured.

## Twilio Video (Live Tutoring Sessions)

**Needed when:** we build live video sessions (explicitly out of scope for
Phase 1).

What we'll need eventually:

- A Twilio account with Video enabled.
- Account SID and an API Key/Secret pair (used server-side only to mint
  short-lived room access tokens — see `ARCHITECTURE.md`).

## Vercel (Deployment)

**Needed when:** we're ready to deploy a live, shareable version of the
site.

What we'll need eventually:

- A Vercel account connected to the project's Git repository.
- The environment variables above configured in the Vercel project
  settings (mirroring `.env.local`, but entered through Vercel's dashboard,
  never committed to Git).

## Transactional Email Provider

**Needed when:** we wire up real email verification, password reset, and
notification emails. Supabase can send basic auth emails out of the box for
early development, but a dedicated provider (e.g. Resend, Postmark,
SendGrid) will likely be needed for reliable delivery and custom templates
at scale.

What we'll need eventually:

- A chosen provider and an account (recommendation will be made when this
  becomes relevant).
- An API key and a verified sending domain/address.

## Summary of What's Actually Needed Right Now

**Nothing.** This phase runs entirely without external credentials. This
section will be updated (and `PROGRESS.md` → "Blocked" will note it) the
moment a future task genuinely requires the owner to create an account or
hand over a credential.
