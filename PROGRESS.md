# African Tutors Development Progress

## Completed

**Phase 1 (project foundation):** Next.js 16 + TypeScript + Tailwind app
shell, public marketing pages, responsive navigation, reusable component
library, and core project documentation. See git history for full detail.

**Phase 2.6 (premium conversion, human connection, and public website polish):**

- Shortened and de-repeated the homepage: merged two 5+3-card feature
  grids into one consolidated, card-free "Why African Tutors" section
  (`ValueList` + photography), and replaced the full 8-card subject grid
  with a compact row of subject pills linking to `/subjects`. The literal
  price "$19.50" now appears on the homepage only in the hero and the
  dedicated pricing section, not in nearly every section.
- Refined the hero: headline unchanged ("Great tutoring shouldn't cost a
  fortune."), body copy rewritten so African Tutors clearly *provides* the
  service ("African Tutors gives your student...") instead of sounding
  like an introduction/marketplace service ("connects your student
  with..."). Simplified the price card from a 3-item checklist to one
  clean line.
- Added real human visual storytelling: two photographs connecting an
  American student with a professional African tutor, used on the
  homepage ("Why African Tutors" and "Our Mission" sections) and the About
  page. These are **AI-generated development placeholders** (not real
  photographs, not stock images, not scraped from search results) —
  documented in `public/images/README.md` and tracked as a required
  pre-launch replacement in `TODO.md`.
- Consolidated the "real tutor, not a chatbot" idea to a single, well-
  reasoned expression ("AI can explain a concept. A great tutor notices
  when a student still isn't getting it, and adjusts.") instead of
  repeating "not a chatbot" in multiple places.
- Removed or neutralized unapproved commercial policy promises from public
  copy: "no long-term contract," "no packages," "no hidden fees," and
  "reschedule when life happens" are gone — replaced with neutral,
  accurate statements about the current pricing structure. See
  `DECISIONS.md`.
- Preserved (unchanged, per instructions): the $19.50/hour price, the
  "Great tutoring shouldn't cost a fortune" headline concept, the Global
  Advantage flow (American Families → African Tutors → Qualified African
  Academics), the "Academic talent has no borders" mission line, the
  Simple Pricing concept ("One student. One tutor. One hour."), the
  student-first signup flow with a secondary tutor application path, and
  all authentication/database/RLS/anti-circumvention architecture from
  Phase 2.
- Verified Phase 2's architecture is fully intact: `npm run test:rls`
  (12/12 assertions) still passes unchanged; no migration, RLS policy,
  grant, trigger, or `proxy.ts` logic was touched this phase.
- Quality tooling re-verified: TypeScript, ESLint, and a production build
  all pass with zero errors after the refinement pass.

**Phase 2.5 (final brand, pricing, customer positioning, visual identity):**

- Corrected the public business model framing: African Tutors now reads
  as a managed tutoring company (not an open marketplace) throughout the
  site — audited and rewrote homepage, How It Works, About, Pricing,
  navigation, and signup copy to remove marketplace/equal-prominence
  language ("Learn/Teach" toggle, "find a tutor," etc.).
  See `DECISIONS.md`.
- New brand color system: near-black + warm gold (sampled from the actual
  brand mark, `#e2a121`) + warm ivory, replacing the Phase 1 amber/navy
  palette. Renamed the `brand-*` Tailwind tokens to `gold-*` across the
  entire codebase to match.
- New brand mark: `public/brand/mark.png`, a cleaned, transparent
  recreation of the supplied Africa-silhouette + human-profile +
  graduation-cap reference image, with true alpha transparency (verified
  programmatically, not just visually). Wired into a `BrandMark` +
  `BrandLockup` component pair used in the navbar and footer, plus
  Next.js's file-based `icon.png`/`apple-icon.png` favicon convention. See
  `DECISIONS.md` for why it was recreated rather than cropped from the
  original.
- Real pricing is live everywhere it matters: **$19.50/hour** appears in
  the hero (with a dedicated price card), a dedicated homepage pricing
  section, the Pricing page, and the footer tagline. Tutor compensation is
  recorded only as internal information in `PROJECT_SPEC.md` and never
  appears in any customer-facing surface.
- Rebuilt the homepage into a deliberate conversion journey: Hero → Why
  African Tutors → How It Works → Why Parents Choose Us → The Global
  Advantage → Subjects → Simple Pricing → Our Mission → Final CTA. Added a
  new `/subjects` page and rewrote `/pricing`, `/about`, and
  `/how-it-works` around the managed-service, parent-facing positioning.
- Signup framing split by prominence, with **no change to the underlying
  account/authorization logic**: `/signup` (primary, in nav and every CTA)
  now shows a "Create your student account" form with no Learn/Teach
  toggle; a new, secondary `/apply-to-tutor` page (linked only from the
  footer and a small text link) handles the tutor path. Both call the same
  `SignupForm` component with a fixed `role` prop instead of a toggle.
- Verified Phase 2's authentication, database, RLS, and anti-circumvention
  architecture is fully intact after all of the above: `npm run test:rls`
  (12/12 assertions) still passes unchanged, and no migration, RLS policy,
  grant, trigger, or `proxy.ts` logic was touched this phase.
- Quality tooling re-verified: TypeScript, ESLint, and a production build
  all pass with zero errors after the redesign.

**Phase 2 (authentication, database, roles, anti-poaching foundation):**

- Real database schema implemented as migrations
  (`supabase/migrations/`): `profiles`, `student_profiles`,
  `tutor_profiles`, `subjects`, `tutor_profile_subjects` — with Row Level
  Security enabled on every table, column-level `GRANT`s restricting which
  fields each role can write, a signup trigger (`handle_new_user`) that
  creates the right profile rows automatically, and an
  `admin_set_tutor_status(...)` function that is the only way a tutor
  application can be approved/rejected/suspended.
- **Anti-poaching requirement verified with an automated test suite**, not
  just documentation: `npm run test:rls` applies the real migrations to a
  local PostgreSQL database bootstrapped to imitate Supabase's `auth`
  schema and role model, then runs 12 assertions proving (among other
  things) that an approved tutor cannot read a student's identity/profile
  data, a student cannot read a tutor's private application data, nobody
  but the internal service role can query `auth.users` directly, and no
  non-admin can self-promote or self-approve. All 12 currently pass. See
  `DATABASE.md` → "Anti-Poaching Verification".
- Real Supabase Auth wired up for login and signup (client-side, via
  `@supabase/ssr`), with friendly, nontechnical error messages
  (`src/lib/supabase/errors.ts`) instead of raw error codes.
- Signup lets a visitor choose "Learn" (student, immediate access) or
  "Teach" (tutor, starts as `pending` — no elevated access until an admin
  approves it).
- Tutor application flow: a logged-in tutor fills out a short form
  (headline, bio, education, years of experience, subjects) via a Server
  Action that only ever updates their own application-editable columns.
  Pending/rejected/suspended tutors see an appropriate status message
  instead of full tutor functionality.
- Admin dashboard now has its first real functionality: a tutor
  application review queue with Approve/Reject/Suspend actions, calling
  the admin-only database function — verified to reject non-admin callers.
- Real server-enforced route protection in `src/proxy.ts` (Next.js 16's
  middleware): logged-out visitors are redirected to `/login`; logged-in
  users who navigate to a dashboard that isn't theirs (by role, looked up
  from the database) are redirected to their own dashboard instead of
  seeing the wrong one — this works by typing a URL directly, not just by
  what the UI links to.
- Password reset flow: `/forgot-password` → email → `/auth/confirm`
  (Supabase's current recommended `token_hash` pattern, not the deprecated
  implicit-flow) → `/reset-password`.
- `scripts/promote-admin.mjs` plus a documented direct-SQL fallback for
  creating the first administrator account — there is no public "sign up
  as admin" option anywhere, and no column grant exists that would let a
  client set their own role to admin.
- Quality tooling re-verified: TypeScript (`tsc --noEmit`), ESLint
  (`npm run lint`), and a production build (`npm run build`) all pass with
  zero errors. All dashboard routes correctly render as dynamic
  (server-rendered per request), not statically cached, since they show
  private per-user data.
- Manual verification (browser + local dev server, without live Supabase
  credentials — see "Blocked" below): homepage and all marketing pages
  still work, login/signup/forgot-password/reset-password/auth-error pages
  render correctly with disabled forms and a "not configured yet" notice,
  and all three dashboards fall back to sensible placeholder content
  instead of crashing when no Supabase project is connected.

## Currently Working On

Nothing in progress. Phase 2.6 is complete. Phase 2's authentication and
database work is still code-complete and verified as thoroughly as
possible without a live Supabase project. Waiting on the owner actions
described below (a technical one and two business decisions) before
either phase can be fully verified/finalized.

## Next

Once a Supabase project is connected (see "Blocked"): do a real end-to-end
smoke test against it (sign up as a student, sign up as a tutor via
`/apply-to-tutor`, confirm the tutor starts pending, promote an admin,
approve the tutor from the Admin Dashboard, confirm the tutor then sees
full Tutor Dashboard content, confirm a student can never reach
`/dashboard/tutor` or `/dashboard/admin` by typing the URL). After that,
Phase 3 (subjects catalog admin UI, tutor availability, and the beginning
of booking) is the recommended next development task — see `TODO.md`, but
it should not start until the owner has decided the initial student
age/grade and subject scope (see "Blocked"). Prompt 2.6 was explicitly
scoped to stop before both live Supabase setup and Phase 3.

## Blocked

**Needs owner action (technical):** a real Supabase project needs to be
created and connected before Phase 2's authentication/database work can be
tested end-to-end for real (real signup emails, real login sessions, real
admin approval against a live database). Step-by-step instructions —
written for a nontechnical owner, no coding required — are in `SETUP.md`
under "Supabase (Auth + Database) — action needed now."

**Needs owner decision (business, before Phase 3/booking):**

1. **Student age/grade and subject scope.** K–12? Middle/high school
   only? K–college? Broad academic tutoring? This shapes the subject
   catalog, tutor recruiting, and matching logic — see `PROJECT_SPEC.md` →
   "Open Items."
2. **A formal tutor vetting standard.** What "reviewed and approved"
   concretely requires (beyond what's already true today). Once decided,
   this becomes a real trust/conversion feature we can state specifically
   in public copy instead of generally.

Nothing else is blocked — Stripe, Twilio, Vercel, and email provider
credentials are still not needed yet (see `SETUP.md`).

## Known Issues

- **The two homepage/About-page photographs are AI-generated development
  placeholders, not real photography.** They are documented in
  `public/images/README.md` and must be replaced with commissioned or
  properly licensed photography before public launch — see
  `PROJECT_SPEC.md` → "Visual Identity & Photography."
- **The brand mark asset is a recreated raster, not a final production
  vector file.** `public/brand/mark.png` closely recreates the supplied
  reference's graphic concept and has real, verified transparency, but a
  proper vector (SVG) or high-resolution production file from a designer
  should replace it when available — see `PROJECT_SPEC.md` → "Open Items"
  and `DECISIONS.md`.
- **Not yet tested against a real Supabase project.** Everything in this
  phase has been verified either by a local PostgreSQL test harness (for
  the database/RLS logic — see `DATABASE.md`) or by running the Next.js
  app with Supabase deliberately "not configured" (for the UI, which falls
  back gracefully). Neither of those exercises a real, live sign-up email,
  a real browser session cookie round-trip through Supabase's actual
  GoTrue auth server, or PostgREST's exact request handling. This is a
  reasonable gap given no Supabase project exists in this environment, but
  it should be smoke-tested for real as the very first thing once one is
  connected.
- The contact form (from Phase 1) still only logs submissions server-side;
  no email is sent yet, since no transactional email provider is
  connected.
- No public "browse approved tutors" page exists yet, so there is
  currently no way for a student to see any tutor's profile at all (by
  design, until a booking-scoped policy is added in Phase 3 — see
  `DATABASE.md`).
- No admin UI exists yet for managing the `subjects` catalog; it's
  currently seeded once by migration only.
- No automated browser/end-to-end test suite exists yet (`npm run
  test:rls` covers the database authorization layer specifically). Given
  the UI surface is still evolving, this was judged an acceptable trade-off
  for this phase.

## Last Verified

2026-08-16 (Phase 2.6) — `npm run build` (production build),
`npx tsc --noEmit`, `npm run lint`, and `npm run test:rls` (12/12 database
RLS/anti-poaching assertions, unchanged and still passing) all pass with
zero errors. Verified via a live preview server, at both desktop and
mobile (390px) widths, that: the shortened homepage renders correctly with
no layout bugs and no leftover repeated pricing/policy copy; both
photographs load correctly and look natural/professional (no broken
images); $19.50/hour is visible above the fold on mobile without
scrolling; `/pricing` shows no unapproved policy promises; `/about`,
`/how-it-works`, and `/subjects` all render correctly; `/signup` still
shows the student-only form with no Learn/Teach toggle; and every checked
route returns HTTP 200 with no console errors.
