# African Tutors — Setup & External Services

This document tracks the external services African Tutors depends on, and
exactly what will eventually be needed from the owner. **Nothing here needs
to be provided yet** unless a specific item says otherwise — credentials are
requested only when the feature that needs them is actually being built.

## Running the app locally today

No external service is required to run the app:

```bash
npm install
npm run dev
```

The app runs with authentication in a visibly "not configured yet" state
until Supabase credentials are supplied (forms render but are disabled, and
the tutor/admin dashboards fall back to placeholder content). All of the
real authentication, database, and permission logic described in
`ARCHITECTURE.md` and `DATABASE.md` is written and has been tested against
a local PostgreSQL database standing in for Supabase (`npm run test:rls`) —
but it has not yet been tried against a real, live Supabase project, because
no Supabase project is connected in this environment yet.

## Supabase (Auth + Database) — action needed now

This is the one thing genuinely needed from the owner right now to move
past this phase. Everything else in this document can wait.

### Step 1: Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up or log in (a free
   plan is enough to start).
2. Click **New Project**.
3. Give it a name (e.g. "African Tutors"), choose a strong database
   password (Supabase can generate one for you — save it somewhere safe,
   like a password manager; it is not the same as the keys below), and pick
   a region.
4. Wait a minute or two for the project to finish setting up.

### Step 2: Copy three values into Cursor's secrets (not into chat)

1. In the Supabase dashboard, go to **Project Settings → API**.
2. You'll see three values to copy:
   - **Project URL**
   - **anon public** key
   - **service_role** key (click "Reveal" — keep this one especially
     private, it bypasses all security rules)
3. In Cursor, go to **Cloud Agents → Secrets** and add these three secrets
   (exact names matter):
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon public key
   - `SUPABASE_SERVICE_ROLE_KEY` = the service_role key
4. These secrets are saved securely and will automatically be available the
   next time an agent works on this project — you only need to do this
   once. **Never paste these into a chat message or commit them to GitHub.**

### Step 3: Apply the database migrations

The actual database structure (tables, security rules) is already written
in this repository at `supabase/migrations/`. It just needs to be run once
against your new project:

1. In the Supabase dashboard, go to **SQL Editor → New query**.
2. Open `supabase/migrations/20260816000000_roles_and_profiles.sql` in this
   repository, copy its entire contents, paste into the SQL Editor, and
   click **Run**.
3. Repeat step 2 for `supabase/migrations/20260816000001_admin_tutor_review.sql`
   (run it *after* the first file — it depends on it).
4. If you'd rather not do this yourself, ask the agent to do it for you in
   your next session, once the three secrets above are saved — the agent
   can apply them for you if given a way to run SQL against the project
   (see "Optional: let the agent run migrations for you" below).

### Optional: let the agent run migrations for you

If you'd like a future agent session to apply migrations directly instead
of copy-pasting SQL yourself (useful for this phase and for any future
schema changes), you can also add one more secret:

- In Supabase, go to **Project Settings → Database → Connection string**
  and copy the "URI" connection string (it includes the database password
  you set in Step 1).
- Add it to Cursor's secrets as `SUPABASE_DB_URL`.

This is only ever used by a developer/agent running migrations directly
against the database — the running application itself never uses it.

### That's it for setup

Once the three required secrets exist, the app will automatically start
using real authentication — no code changes needed (see
`ARCHITECTURE.md` → "Authentication Strategy" for why).

## Creating the first administrator

There is no "sign up as admin" option anywhere in the app, by design (see
`DECISIONS.md`). To create the very first administrator account:

1. Have that person sign up for a normal account at `/signup` (as a
   student — it doesn't matter which option they pick, since role is
   changed directly afterward).
2. Then either:
   - Ask the agent to run: `npm run promote-admin -- their-email@example.com`
     (uses the service_role key, never exposed to the browser), or
   - Run this SQL yourself in the Supabase SQL Editor:
     ```sql
     update public.profiles
     set role = 'admin'
     where id = (select id from auth.users where email = 'their-email@example.com');
     ```
3. That person can now log in and will be routed to the Admin Dashboard.

Once at least one administrator exists, they can approve tutor applications
from the Admin Dashboard — no further SQL is needed for that.

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

**A Supabase project, connected as described above.** This is the one
genuine blocker for this phase to be fully verified end-to-end — see
`PROGRESS.md` → "Blocked". Everything else in this document (Stripe,
Twilio, Vercel, transactional email) can still wait until the feature that
needs it is actually being built.
