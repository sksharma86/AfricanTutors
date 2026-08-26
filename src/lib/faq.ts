/**
 * Public FAQ content. Every answer must match the actual implemented business
 * rules (current pricing, one-free-session-per-account/household, non-expiring
 * package hours, the 24-hour cancellation policy, recorded on-platform sessions,
 * managed availability-based matching). Do not add policy the product doesn't
 * enforce. (Study Hall is homework supervision, not subject-by-subject tutoring.)
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "What is Study Hall (at home)?",
    a: "Live online Study Hall for kids. A highly vetted Guide stays with your child on video while they do their own homework — supervision, focus, and accountability, not tutoring.",
  },
  {
    q: "Who are the Guides?",
    a: "Guides are highly vetted supervisors. They keep children focused, accountable, and encouraged — and redirect calmly when attention drifts. Every Guide is reviewed and approved before working with families.",
  },
  {
    q: "Where do Guides work from?",
    a: "Guides work remotely from Kenya. They’re carefully vetted and trained for Study Hall (at home). Their role is supervision, encouragement, redirection, and accountability — not tutoring.",
  },
  {
    q: "How much does it cost?",
    a: "Pay as you go is $12/hour. Prepaid routines save more: 14 hours for $140 ($10/hour), or 28 hours for $252 ($9/hour). Prepaid hours never expire.",
  },
  {
    q: "Is the first session really free?",
    a: "Yes. Your first 1-hour Study Hall session is free — a real session with a Guide, not a sales call. No credit card required. The free session is one per account.",
  },
  {
    q: "Do I need a credit card for the free session?",
    a: "No. The free session requires no credit card and no payment information.",
  },
  {
    q: "How does Study Hall work?",
    a: "Create a parent account, add your child, and pick a time. Your child joins a private live Study Hall from home. The Guide keeps them on task while they do their homework. Afterward, you get a short report — and a recording available for 60 days.",
  },
  {
    q: "Are sessions recorded?",
    a: "Yes. Sessions are recorded for quality and safety. Parents can review recordings in their account for 60 days after the session.",
  },
  {
    q: "What if my child needs me during Study Hall?",
    a: "Their Guide can use Call Parent. Study Hall (at home) contacts your phone. You don’t need to keep an app or portal open — and Guides never see your private number.",
  },
  {
    q: "Can I book for more than one child?",
    a: "Yes. One parent account can book for multiple children. The free session is one per household (one per account), not one per child.",
  },
  {
    q: "Do prepaid hours expire?",
    a: "No. Prepaid hours never expire and apply automatically when they fully cover a session.",
  },
  {
    q: "What happens if I cancel?",
    a: "Cancel 24 or more hours before a session and its value returns to your account. Cancellations within 24 hours of the start time are non-refundable.",
  },
  {
    q: "Can I choose my Guide?",
    a: "We match your child with an available, approved Guide for the time you choose. Where we can, we keep children with a Guide they’ve worked with before.",
  },
  {
    q: "What do children work on?",
    a: "Their own homework — any subject. Guides provide supervision and accountability, not subject tutoring, so there’s nothing to prepare in advance.",
  },
  {
    q: "How are Guides approved?",
    a: "Every Guide is recruited, carefully vetted, and trained by Study Hall (at home), and must be approved before working with families.",
  },
  {
    q: "What happens if I have a problem with a session?",
    a: "Report any completed session from your parent portal. Our team reviews every report, and you can track status from Received to Resolved.",
  },
];
