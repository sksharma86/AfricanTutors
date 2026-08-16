# African Tutors

African Tutors is a responsive web platform connecting students with
qualified tutors in Africa for one-on-one online tutoring.

See the project documentation below before making changes — in particular
`SETUP.md` if you're picking this up and no Supabase project is connected
yet.

## Documentation

- [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) — business specification (in progress)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — technical architecture, including
  the anti-poaching/anti-circumvention architecture
- [`DATABASE.md`](./DATABASE.md) — preliminary database design
- [`SETUP.md`](./SETUP.md) — external services and what's needed from the owner
- [`DECISIONS.md`](./DECISIONS.md) — architecture decision log
- [`TODO.md`](./TODO.md) — phased development backlog
- [`PROGRESS.md`](./PROGRESS.md) — current development status (kept up to date)

## Tech Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com) v4
- [Supabase](https://supabase.com) (PostgreSQL + Auth) — implemented, needs
  a connected project (see `SETUP.md`)
- [Stripe](https://stripe.com) (payments) — planned
- [Twilio Video](https://www.twilio.com/en-us/video) (live tutoring) — planned
- [Vercel](https://vercel.com) (deployment)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` to `.env.local` and fill in real values once a Supabase
project is connected (see `SETUP.md`) — the app runs fine without it, with
authentication features visibly disabled.

## Scripts

```bash
npm run dev            # start the dev server
npm run build          # production build
npm run start           # run the production build
npm run lint             # ESLint
npm run test:rls          # local Row Level Security test suite (needs local PostgreSQL)
npm run promote-admin     # grant the admin role to an existing account by email
```

## Database

The schema and Row Level Security policies live in `supabase/migrations/`
as plain SQL — see `DATABASE.md` for the design and `SETUP.md` for how to
apply them to a real Supabase project.
