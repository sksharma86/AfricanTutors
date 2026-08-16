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

## 2026-08-16 — African Tutors is a managed tutoring company, not an open marketplace

**Decision:** African Tutors is positioned publicly as a managed online
tutoring company that recruits, vets, approves, and manages a network of
tutors, and sells tutoring directly to customers — not as a two-sided
marketplace where students and tutors find and choose each other. Students
and tutors are never given equal prominence in public navigation, CTAs, or
homepage messaging.

**Reasoning:** This reflects the actual business model: African Tutors
controls customer acquisition, pricing, tutor recruiting/approval, and
scheduling/payments. Marketplace-style framing ("browse tutors," "students
and tutors join equally") would misrepresent that model to customers and
would also work against the anti-circumvention architecture from Phase 2 —
a marketplace mental model encourages the exact independent, direct
tutor↔student relationships that architecture is designed to avoid.

## 2026-08-16 — Primary customer: American parents; secondary: American students

**Decision:** The public site speaks primarily to American parents
purchasing tutoring for their children, secondarily to American students
purchasing tutoring for themselves. The brand is designed to resonate
particularly strongly with African American families, while remaining
broadly welcoming.

**Reasoning:** This is the actual target customer for the business. A
parent-first homepage (leading with price, professionalism, and trust
signals rather than a generic "connects students and tutors" pitch)
answers the questions a paying parent actually has, in the order they have
them — see `PROJECT_SPEC.md` → "Primary Customer".

## 2026-08-16 — Customer price is $19.50/hour; tutor compensation is private

**Decision:** The public customer price for live, one-on-one online
tutoring is $19.50/hour, displayed prominently across the site (hero,
pricing page, homepage pricing section, footer). Tutor compensation
($5/completed hour) is recorded only in `PROJECT_SPEC.md` as internal
business information and never appears in any customer-facing surface —
copy, metadata, or UI.

**Reasoning:** A real, final price is a stronger and more honest
acquisition tool than a placeholder, and the task was explicit that this
is a real business decision. Tutor compensation and customer price are
different concerns for different audiences; showing both invites
unhelpful comparisons ("the tutor only gets...") that don't serve either a
customer's or a tutor's understanding of the value they're each getting,
and internal margin information is not something a commercial company
publishes. This mirrors the existing `payments` vs. `tutor_earnings`
separation already established in `DATABASE.md`.

## 2026-08-16 — Brand mark: recreated from the supplied reference, not extracted from it

**Decision:** The production brand asset (`public/brand/mark.png`) is a
freshly generated icon that closely recreates the supplied reference
image's graphic concept (Africa silhouette + human profile + graduation
cap, gold/black split), rather than a crop of the original file, with its
background removed programmatically to produce a real transparent PNG.

**Reasoning:** The supplied reference was a flattened raster (a phone
screenshot–style composition with the wordmark baked in and a background
that wasn't cleanly separable into a transparent icon) — cropping it
directly would have produced a visible rectangular background artifact in
the navbar, which the task explicitly said to avoid. Recreating the same
graphic concept as a clean icon, then verifying true alpha transparency
programmatically (not just visually), produces a usable production asset
now while preserving the graphic identity exactly as specified. This
should be treated as a placeholder for a real vector/production file from
a designer — see `PROJECT_SPEC.md` → "Open Items".

## 2026-08-16 — Typography and color system derived from, but not copied from, the reference image

**Decision:** The supplied reference image's wordmark typography is not
used anywhere on the site — "African Tutors" is set in the site's existing
type system (Geist Sans for body copy, Fraunces for display/headings). The
color system was rebuilt around the reference's actual gold (`#e2a121`,
sampled directly from the generated mark) and a warm, neutral near-black
(`#131311`), replacing the previous amber/navy palette from Phase 1.

**Reasoning:** The task explicitly said the reference's typography is not
mandatory and that the graphic mark, not the wordmark font, is the
important brand element. Deriving the color ramp from a real sampled color
(rather than an approximate "gold-ish" choice) keeps the site visually
tied to the actual brand mark wherever gold appears.

## 2026-08-16 — Signup framing changed; underlying account/application mechanics unchanged

**Decision:** `/signup` (primary, in main navigation and every CTA) no
longer presents a Learn/Teach toggle — it renders `SignupForm` fixed to
`role="student"`. A new, secondary `/apply-to-tutor` page (linked only from
the footer and a small secondary text link) renders the same form fixed to
`role="tutor"`. Nothing about the Supabase `signUp()` call, the
`requested_role` metadata, the `handle_new_user` trigger, or a tutor
starting as `tutor_profiles.status = 'pending'` changed — only which page
presents which role, and how prominently.

**Reasoning:** The task was explicit that student and tutor signup must
not be presented as equal choices. Since the actual account/authorization
mechanics from Phase 2 were already correct and already thoroughly tested,
the right fix was a presentation-layer change (which page shows which
fixed role) rather than touching the authentication or database logic at
all — minimizing risk to already-verified functionality while fully
addressing the positioning requirement.

## 2026-08-16 — Shortened the homepage and consolidated repeated messaging

**Decision:** Merged the two homepage feature-card grids ("Why African
Tutors" and "Why Parents Choose Us" — 8 cards combined) into one
consolidated "Why African Tutors" section using a plain, card-free list
(`ValueList`) paired with a photograph. Replaced the full 8-card subject
grid on the homepage with a compact row of subject pills linking to the
dedicated `/subjects` page. Removed the literal price "$19.50" from every
homepage section except the hero and the dedicated pricing section.

**Reasoning:** The task was explicit that a premium company states its
value once, clearly, and moves on — repeating "$19.50/hour," "one-on-one,"
"carefully selected," and "managed by African Tutors" in nearly every
section reads as insecure rather than confident, and duplicating the full
subject grid that already exists on its own page told the visitor nothing
new. Shortening the page and removing redundant restatements makes the
homepage easier to skim and more premium, while every fact that was
removed from a section is still stated clearly somewhere on the page (or
one click away on its own page).

## 2026-08-16 — Avoid card overload: `ValueList` and `PhotoFrame` instead of more feature-card grids

**Decision:** Added `ValueList` (plain icon + text rows, no card borders)
and `PhotoFrame` (a responsive, cropped photo container) as the preferred
way to present a short set of related points, instead of defaulting to
another bordered-rounded-rectangle feature-card grid.

**Reasoning:** The task explicitly warned against "AI generated SaaS
template" visual patterns — a page built entirely from rounded feature
cards and icon grids reads as generic and can undercut the "premium"
perception the brand needs at this price point. Typography, whitespace,
and photography communicate the same information with more visual variety
and a more editorial, premium feel. Existing card-based components
(`FeatureGrid`, `Steps`) are still used where a card/step actually has a
distinct visual identity worth calling out (e.g. numbered process steps),
just not for every list of ideas.

## 2026-08-16 — Added AI-generated placeholder photography, clearly documented as a placeholder

**Decision:** Added two photographs
(`public/images/student-tutoring-session.jpg`,
`public/images/tutor-portrait.jpg`) generated fresh for this project (not
sourced from any stock library or search engine), used on the homepage and
About page to visually connect an American student with a professional
African tutor. Documented their provenance and required pre-launch
replacement in `public/images/README.md`.

**Reasoning:** The task required adding real human visual storytelling to
the site, but explicitly prohibited scraping images from search engines or
using imagery without a clear right to use it, and offered "create polished
placeholders and document what's needed later" as the fallback when
reliable, properly licensed real photography isn't available in the
current environment (no stock-photo API access, no ability to commission
real photography). Freshly generated images created specifically for this
project carry no known third-party copyright claim, making them a safe,
honest placeholder — as long as they are clearly labeled as such and
tracked for replacement before launch, which they are.

## 2026-08-16 — Removed unapproved commercial policy promises from public copy

**Decision:** Removed or neutralized several phrases that read as
commercial policy commitments the owner has not actually made: "no
long-term contract," "no packages to buy" / "no packages," "no hidden
fees," and "reschedule when life happens." Replaced them with neutral,
accurate descriptions of the current pricing structure (e.g. "sessions are
billed individually" instead of "no packages to buy and no long-term
contract").

**Reasoning:** These phrases sounded appealing while drafting copy in
Prompt 2.5, but none of them were ever actually approved as company
policy — cancellation, rescheduling, and contract terms are real
commercial decisions the owner has not made yet. Publishing them as if
they were settled policy would create a real obligation (and potential
customer-facing liability) the business hasn't agreed to. The task was
explicit that Cursor must not independently establish commercial policy
just because it reads well; see `PROJECT_SPEC.md` → "Public Copy
Standards" and "Open Items."

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
