# African Tutors — Architecture & Product Decisions

A running log of notable decisions and the reasoning behind them. Newest
entries at the bottom.

---

## 2026-08-15 — Responsive web app, not native mobile apps

**Decision:** African Tutors will launch as a responsive web application
rather than separate native mobile applications.

**Reasoning:** A single Next.js codebase deployed to Vercel can serve
desktop, laptop, tablet, iPhone, and Android browsers well, without the
added cost, review overhead, and maintenance burden of separate iOS/Android
codebases. This matches the explicitly requested technology stack and lets
the team ship and iterate on one product surface. Native apps can be
revisited later if usage patterns justify the investment.

## 2026-08-15 — Architecture minimizes tutor↔student contact exposure

**Decision:** The system will be architected to minimize direct tutor to
student contact exposure and reduce off platform circumvention opportunities.

**Reasoning:** Preventing tutor-to-client poaching and off-platform
circumvention is a central business requirement, not a bolt-on feature. If
the data model and UI expose personal contact information (auth emails,
phone numbers, unmanaged messaging/video links) early on, retrofitting
protection later is much harder — every place that leaked contact info has
to be found and fixed, likely after bad habits have already formed among
early users. Instead, Phase 1 establishes: a profile layer decoupled from
auth credentials, booking-centric data relationships, and a documented set
of principles (`ARCHITECTURE.md` → "Tutor to Client Circumvention
Prevention") that all future features (messaging, video, payments) are
expected to follow.

## 2026-08-15 — Supabase Auth roles are never client-assigned

**Decision:** A user can never grant themselves `tutor` or `admin` access by
simply selecting it in a form. Signup only records a `requested_role`
(student/tutor) as a hint; actual tutor access requires admin approval
(`tutor_profiles.status`), and admin accounts are provisioned directly by
the owner/engineering team.

**Reasoning:** Client-supplied role data can always be tampered with. Trust
must be rooted in server-side state (ultimately Postgres, enforced by RLS
and/or server checks), not in what a signup form happens to submit.

## 2026-08-15 — Auth code is written for Supabase from day one, but degrades gracefully without credentials

**Decision:** Supabase client/server utilities and login/signup forms were
built now, even though no Supabase project is connected yet. When
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` are absent, the
app detects this (`isSupabaseConfigured`) and renders forms in a disabled,
clearly-labeled "not configured yet" state instead of crashing or faking
success.

**Reasoning:** This lets Phase 1 ship a real, inspectable authentication UI
and the exact integration seam future phases will use, while still being
fully runnable/testable in an environment that has no external credentials
configured. It avoids a throwaway "fake" auth UI that would need to be
rebuilt later.

## 2026-08-15 — Design direction: modern edtech, not stereotypical or charity-styled

**Decision:** The visual design uses a warm amber/terracotta accent color as
a subtle nod to African-inspired warmth, paired with a neutral ink/navy
palette, a serif display font for headings, and generous whitespace —
avoiding heavy traditional patterns, cartoonish styling, or
charity/nonprofit visual language.

**Reasoning:** The brand should read as a credible, premium education
technology company that happens to focus on Africa, not a stereotype of
"African" visual tropes or a nonprofit aesthetic. This keeps the platform
positioned as a serious commercial product.

## 2026-08-16 — Finalized pricing: $12 / 30 min and $20 / 60 min

**Decision:** Customer pricing is $12 for a 30-minute session and $20 for a
60-minute session. The earlier `$19.50/hour` planning figure is obsolete and
removed everywhere.

**Reasoning:** The owner finalized a per-session model with two clear session
lengths. Flat, per-session pricing is simpler to communicate than an hourly rate
and maps cleanly onto the two session lengths Prompt 3's booking system will
support.

## 2026-08-16 — First 30-minute session is free, with no card required

**Decision:** Every legitimate new student gets one free 30-minute one-on-one
tutoring session. No credit card, debit card, deposit, subscription, or payment
authorization is required to claim or book it. It is a real tutoring session,
never marketed as a "free consultation."

**Reasoning:** Fulfillment cost for a 30-minute intro session is very low
(~$2.50 of tutor labor — internal, see `BUSINESS_MODEL.md`), and reducing
customer-acquisition friction at launch matters more than preventing every case
of free-trial abuse. Requiring a card would suppress conversions from a
new, unfamiliar service more than trial abuse would cost.

## 2026-08-16 — Accept low-level free-trial abuse; monitor before adding friction

**Decision:** We will not build invasive fraud prevention, fingerprinting, or
card verification for the free trial now. We accept that a small amount of abuse
may occur, will track free-trial usage in the data model, and will monitor abuse
before introducing any stronger friction.

**Reasoning:** Over-engineering anti-abuse ahead of real data would add friction
and complexity for little benefit given the low per-trial cost. The future data
model still records enough to measure abuse and free-trial → paid conversion.

## 2026-08-16 — Tutor compensation is private internal information

**Decision:** Tutor compensation and unit economics ($5/hour planned pay, and
the derived labor costs) live only in `BUSINESS_MODEL.md` and never in
customer-facing code, content, or `src/lib/pricing.ts`.

**Reasoning:** Exposing tutor pay or margins publicly would harm negotiating
position and brand perception. Keeping a hard separation between customer-facing
pricing (`src/lib/pricing.ts`) and internal economics prevents accidental leaks.
