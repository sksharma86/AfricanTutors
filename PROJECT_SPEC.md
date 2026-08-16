# African Tutors — Project Specification

> **Status: Core business model, pricing, and brand are now settled** (as of
> Prompt 2.5). Some details still need to be gathered from the owner — see
> "Open Items" at the end. Nothing here should be treated as exhaustive,
> but the items below are real decisions, not placeholders.

## What African Tutors Is

African Tutors is a **managed online tutoring company**, not an open
two-sided marketplace. African Tutors recruits, vets, approves, assigns,
and manages a network of qualified African academics, and sells live,
one-on-one online tutoring directly to American families as a single,
professionally managed service.

- The customer purchases tutoring **from African Tutors**.
- The tutor provides tutoring **through African Tutors**, as part of a
  managed fulfillment network — not as an independent seller running their
  own storefront.
- African Tutors controls and manages customer acquisition, pricing, tutor
  recruiting/application/approval/assignment, scheduling, payments, the
  online session environment, customer support, and quality control.

This distinction matters for both product decisions and public copy: the
website should never present "students looking for tutors" and "tutors
looking for students" as two equally prominent, symmetric audiences. See
`DECISIONS.md`.

## Primary Customer

- **Primary audience:** American parents purchasing tutoring for their
  children.
- **Secondary audience:** American students purchasing tutoring for
  themselves.
- The service targets customers in the United States. The brand should
  resonate particularly strongly with African American families, while
  remaining welcoming and available to students of all backgrounds.

A parent arriving at the site should be able to quickly answer: what does
this cost, is it actually one-on-one, who are the tutors, why is the price
affordable, is this professional, how does it work, and how do they get
their child started. The homepage and navigation are organized around
answering those questions, in that rough order — see `ARCHITECTURE.md`.

## Pricing

- **Customer price: $19.50 per hour** for live, one-on-one online
  tutoring. This is a real, final price, not a placeholder, and is
  displayed prominently across the site (hero, pricing page, homepage
  pricing section, footer).
- No tiers, packages, or subscription plans. One student, one tutor, one
  hour, one price.
- **Tutor compensation is $5 per completed tutoring hour. This is strictly
  internal business information and must never appear anywhere customer
  facing** (homepage, pricing, about, tutor recruiting copy, dashboards,
  public metadata, or marketing copy of any kind), and the two figures
  (customer price vs. tutor pay) must never be compared or juxtaposed in
  any customer-facing content. See `DECISIONS.md`.
- Do not invent competitor pricing, savings percentages, or claims like "70%
  cheaper" — the $19.50 price stands on its own.

## Core Value Proposition

1. **Real human help.** The product is a real human tutor working
   one-on-one with the student, live — not an AI chatbot. AI may eventually
   support the service behind the scenes (tutor prep, practice generation,
   session summaries, progress reports), but the human tutor is the core
   product and the public-facing positioning.
2. **Affordability.** $19.50/hour, made possible by a global academic
   talent model — not by underpaying "cheap overseas labor" framing, which
   must never appear in customer-facing copy.
3. **Global opportunity.** African Tutors creates meaningful, paid teaching
   opportunities for talented African academics, presented proudly and
   commercially — never with charity, pity, or poverty framing.

## Core Business Requirement: Anti-Circumvention

This remains a **central** requirement, not a minor feature. African
Tutors owns and manages the customer relationship:

- Students and tutors should be able to complete an entire tutoring
  relationship — matching, scheduling, messaging, payment, live sessions,
  and history — without exchanging private contact information.
- Tutors must not receive unnecessary access to a student's/parent's
  personal email, phone number, payment information, social media
  information, or other private contact details. Students likewise
  should not need a tutor's private contact information or payout details.
- Communication, scheduling, payments, and tutoring activity should stay
  on-platform by design, not by policy alone.
- To customers, this should simply feel like a professionally managed
  tutoring platform — the term "anti-poaching"/"circumvention" is internal
  vocabulary and should not appear prominently in customer-facing copy.
- See `ARCHITECTURE.md` → "Tutor to Client Circumvention Prevention" for
  the technical architecture, and `DATABASE.md` for what has actually been
  implemented and tested.

## Roles

- **Student** — books tutoring, pays, attends sessions, views session
  history, accesses recordings, communicates on-platform. The primary
  public account type; signup defaults here.
- **Tutor** — part of African Tutors' managed fulfillment network:
  recruited, approved, and assigned by African Tutors. Manages
  availability, sees assigned sessions, joins sessions, views earnings,
  communicates on-platform. Deliberately restricted from unnecessary
  student private information. Tutor recruiting is a secondary,
  lower-prominence public path (footer-level), not equal to student
  signup.
- **Administrator** — manages students and tutors, approves tutors,
  manages subjects, views bookings and payments, reassigns tutors, views
  recordings, reviews tutor performance and circumvention activity,
  manages platform settings.

Role assignment is never client-chosen. Tutor and administrator privileges
require controlled, server-enforced authorization (see `ARCHITECTURE.md`).

## Brand

- **Graphic mark:** the silhouette of Africa merged with a human profile
  wearing a graduation cap. This is the primary visual identity — preserve
  and respect this graphic concept in any future brand work.
- **Typography:** not dictated by the supplied reference logo's wordmark
  font. The company name is displayed as "African Tutors" in a modern,
  professional, highly readable type system.
- **Colors:** near-black (sophistication, typography, navigation), warm
  gold (used strategically — primary CTAs, pricing emphasis, icons/accents
  — never flooding entire sections), and warm ivory/off-white
  (spacious backgrounds, warmth).
- **Design goal:** the site should look like a serious, established
  tutoring company that happens to offer an unusually accessible price —
  never like a discount marketplace, charity, or low-budget template. See
  `DECISIONS.md`.

## Technology Stack (fixed decisions)

- Next.js + TypeScript
- Supabase (PostgreSQL + Auth)
- Stripe (future payments)
- Twilio Video (future live tutoring sessions)
- Vercel (deployment)
- Responsive web application — **not** a native mobile app.

## Planned Future Capabilities

(Not implemented yet — architecture should anticipate these.)

- Internal, on-platform messaging between students and tutors
- Booking and scheduling
- Payments and tutor payouts/earnings tracking
- Live video tutoring sessions and recordings
- Notifications
- Session history
- Administrative monitoring, including circumvention detection/flagging

## Design Direction

Modern, premium, trustworthy, friendly, clean, academic, mobile-friendly,
and culturally confident. Avoid cartoonish or generic-template visuals,
safari/tribal/wildlife imagery, charity/nonprofit visual language, and
unverified marketing claims (tutor counts, results, savings percentages,
customer counts, testimonials, ratings, certifications, or guarantees)
unless real evidence exists.

## Open Items Requiring Owner Input (not yet specified)

- Exact subject/grade coverage limits (the current subject list is a
  starting catalog, not an exhaustive guarantee)
- Detailed tutor vetting/approval criteria beyond "reviewed and approved"
- Session length options beyond the standard hour, and
  cancellation/refund policy specifics
- Legal entity, Terms of Service, and Privacy Policy content
- A production-quality, vector version of the brand mark (see
  `DECISIONS.md` — the current asset is a cleaned raster derived from the
  supplied reference and should be replaced with a proper vector file when
  one exists)
