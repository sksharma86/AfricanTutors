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

## 2026-08-16 — A tutor's `role` is set to `tutor` at signup; `tutor_profiles.status` gates real access

**Decision:** Choosing "Teach" at signup immediately sets `profiles.role =
'tutor'`, but `tutor_profiles.status` starts at `'pending'` and is the only
thing that actually unlocks tutor functionality. `role` and `status` are
deliberately two different fields.

**Reasoning:** This matches the mental model in `PROJECT_SPEC.md` and
`DATABASE.md` cleanly: "which kind of account is this" (role) is a
different question from "has this tutor been vetted yet" (status). It also
means the routing logic (`src/proxy.ts`) can treat any tutor — pending or
approved — as belonging on `/dashboard/tutor`, while the *page itself*
decides whether to show the application form or full tutor functionality
based on status. Keeping "am I a tutor account" and "am I an approved
tutor" separate avoids ever needing a third, ambiguous role value.

## 2026-08-16 — Column-level SQL grants enforce which fields are editable, not just Row Level Security

**Decision:** Sensitive columns (`profiles.role`; `tutor_profiles.status`,
`admin_notes`, `approved_by`, `approved_at`, `status_updated_at`) are never
included in any `GRANT UPDATE` to the `authenticated` role — not "hidden
behind a check," but literally not possible to write via the standard
Supabase client, regardless of RLS policy wording.

**Reasoning:** Row Level Security answers "which *rows* can this role
touch"; it doesn't by itself answer "which *columns* of a row this role
can otherwise see are they allowed to change." Relying solely on an RLS
`WITH CHECK` clause to prevent self-promotion is more error-prone to write
correctly (and to keep correct as policies evolve) than simply never
granting `UPDATE` on the column in the first place. This was verified with
an automated test (`npm run test:rls`): a student attempting
`UPDATE profiles SET role = 'admin'` on their own row fails with a
permission error before RLS is even evaluated.

## 2026-08-16 — Admin approval goes through one `SECURITY DEFINER` function, not a direct table grant

**Decision:** The only way `tutor_profiles.status` (and its approval
metadata) changes is by calling `public.admin_set_tutor_status(...)`, a
Postgres function that checks the caller is an admin internally and can
safely be granted to every authenticated user (a non-admin caller just gets
an error).

**Reasoning:** Centralizing this in one function means `approved_by` /
`approved_at` / `status_updated_at` are always set consistently and
correctly, the authorization check exists in exactly one place instead of
being re-implemented at every call site, and the admin dashboard's
approve/reject/suspend buttons can call it directly without needing their
own separate authorization logic to get right.

## 2026-08-16 — Verified the anti-poaching database requirement with a local test harness instead of only by code review

**Decision:** Before ever connecting a real Supabase project, the actual
migration files were applied to a local PostgreSQL database bootstrapped to
imitate Supabase's `auth` schema, roles, and `auth.uid()` contract, and an
automated test suite (`supabase/tests/`, run via `npm run test:rls`) proves
— not just asserts in documentation — that a tutor cannot read a student's
identity/profile data (or vice versa), that `auth.users` itself is
unreachable by normal app roles, and that no non-admin can self-promote or
self-approve.

**Reasoning:** The task explicitly called for verifying this concept, and
"we designed it not to allow that" is weaker evidence than "we ran a test
that tries to do the disallowed thing and confirms it fails." Docker (which
`supabase start` requires) was not available in this environment, so a
plain PostgreSQL instance with a hand-built approximation of Supabase's
`auth` schema was used instead — good enough to validate the actual SQL
logic (RLS policies, grants, triggers, functions) that will run unmodified
on the real project, though a final smoke test against a live, connected
Supabase project is still recommended once one exists (see `SETUP.md`).

## 2026-08-16 — The first administrator is created by direct SQL/service-role script, never through the app

**Decision:** There is no in-app path — no button, no hidden route, no
environment-variable email allowlist — that grants the `admin` role.
The first (and every) admin is created by either running one SQL statement
directly in the Supabase SQL Editor, or running
`scripts/promote-admin.mjs` (which uses the service role key and is meant
to be run by a developer/agent, never shipped to the browser).

**Reasoning:** The task explicitly warned against determining admin access
from a hardcoded email address or otherwise insecure shortcut. A one-line
SQL statement run by a trusted human, or a small script using a secret
that's never exposed to the app's client bundle, is simple enough for a
one-time bootstrap step without introducing a standing security hole.
