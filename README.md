# African Tutors

African Tutors is a responsive web platform connecting students with
qualified tutors in Africa for one-on-one online tutoring.

This repository is in an early foundation phase. See the project
documentation below before making changes.

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
- [Supabase](https://supabase.com) (PostgreSQL + Auth) — planned
- [Stripe](https://stripe.com) (payments) — planned
- [Twilio Video](https://www.twilio.com/en-us/video) (live tutoring) — planned
- [Vercel](https://vercel.com) (deployment)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` to `.env.local` and fill in real values as external
services are connected (none are required to run this phase of the app).

## Scripts

```bash
npm run dev     # start the dev server
npm run build   # production build
npm run start   # run the production build
npm run lint    # ESLint
```
