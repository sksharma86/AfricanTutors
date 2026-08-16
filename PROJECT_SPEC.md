# African Tutors — Project Specification

> **Status: Incomplete.** This file captures the business requirements known so
> far from project kickoff. The full, detailed business specification
> (pricing model, subject catalog, tutor vetting criteria, session length
> options, refund/cancellation policy, target markets, legal/compliance
> requirements, etc.) still needs to be gathered from the owner and inserted
> here. Nothing below should be treated as final or complete — it is the
> foundation for a living document.

## What African Tutors Is

African Tutors is a responsive web-based tutoring platform that connects
students with tutors in Africa for online, one-on-one tutoring.

## Core Business Requirement: Anti-Poaching / Anti-Circumvention

This is a **central** requirement, not a minor feature:

- The platform must be architected from the start so students and tutors can
  complete an entire tutoring relationship — matching, scheduling, messaging,
  payment, live sessions, and history — without exchanging private contact
  information.
- Tutors must not receive unnecessary access to a student's personal email
  address, phone number, payment information, social media information, or
  other private contact details. Students likewise should not need a tutor's
  private contact information.
- Communication, scheduling, payments, and tutoring activity should stay on
  platform by design, not by policy alone.
- Full anti-poaching detection/enforcement is a later phase, but the
  architecture must not create contact exposure that is difficult to remove
  later. See `ARCHITECTURE.md` → "Tutor to Client Circumvention Prevention".

## Roles

- **Student** — books tutoring, pays, attends sessions, views session
  history, accesses recordings, communicates on-platform.
- **Tutor** — manages availability, sees assigned sessions, joins sessions,
  views earnings, communicates on-platform. Deliberately restricted from
  unnecessary student private information.
- **Administrator** — manages students and tutors, approves tutors, manages
  subjects, views bookings and payments, reassigns tutors, views recordings,
  reviews tutor performance and circumvention activity, manages platform
  settings.

Role assignment is never client-chosen. Tutor and administrator privileges
require controlled, server-enforced authorization (see `ARCHITECTURE.md`).

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

Modern, premium, trustworthy, friendly, clean, academic, and mobile-friendly.
Avoid cartoonish or generic-template visuals, heavy traditional African
patterns, charity/nonprofit visual language, and unverified marketing claims
(e.g. tutor counts, results, savings percentages, customer counts).

## Open Items Requiring Owner Input (not yet specified)

- Final pricing model and specific session rates
- Subject catalog and grade/level coverage
- Tutor vetting/approval criteria and process details
- Target countries/regions and any regulatory considerations
- Session length options and cancellation/refund policy
- Legal entity, terms of service, and privacy policy content
- Brand assets (logo, exact color palette, name variations) beyond the
  interim design direction used in this foundation phase
