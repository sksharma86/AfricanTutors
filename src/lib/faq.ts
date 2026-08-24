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
    q: "What is Study Hall at Home?",
    a: "Study Hall at Home is a managed service that provides live, online homework supervision. A trained Guide keeps your children on task by video while they complete their own schoolwork. It's homework accountability, focus, and routine — not subject-by-subject tutoring.",
  },
  {
    q: "Who are the Guides?",
    a: "Guides are trained supervisors who keep children focused, accountable, and encouraged during Study Hall, and give normal redirection when a child drifts off task. Every Guide is reviewed and approved before they work with families.",
  },
  {
    q: "How much does it cost?",
    a: "Sessions are $12 for 30 minutes or $20 for 60 minutes. You can also save with prepaid hours: 10 hours for $190 ($19/hr), 20 hours for $360 ($18/hr), or 40 hours for $680 ($17/hr).",
  },
  {
    q: "Is the first session really free?",
    a: "Yes. Your first 30-minute session is completely free — a real Study Hall session with a Guide, not a sales call.",
  },
  {
    q: "Do I need a credit card for the free session?",
    a: "No. The free session requires no credit card and no payment information.",
  },
  {
    q: "How does Study Hall work?",
    a: "Create a parent account, add your child, and choose a time that works for your family. Your child joins a private, live Study Hall with a Guide from any computer at home, and the Guide keeps them on task while they do their homework.",
  },
  {
    q: "Are sessions recorded?",
    a: "Yes. Sessions are recorded for quality and safety, and to help resolve any issues. Recordings are used internally by Study Hall at Home and are not shared publicly.",
  },
  {
    q: "Can I book for more than one child?",
    a: "Yes. One parent account can manage and book sessions for multiple children. Note that the free session is one per household (one per account), not one per child.",
  },
  {
    q: "Do prepaid hours expire?",
    a: "No. Prepaid hours never expire and are used automatically when they fully cover a session.",
  },
  {
    q: "What happens if I cancel?",
    a: "Cancel 24 or more hours before a session and its value returns to your account. Cancellations within 24 hours of the start time are non-refundable.",
  },
  {
    q: "Can I choose my Guide?",
    a: "Study Hall at Home matches your child with an available, approved Guide for the time you choose, so you don't have to search. Where possible, we keep children with a Guide they've worked with before.",
  },
  {
    q: "What do children work on?",
    a: "Children work on their own homework and assignments — across any subject. Guides provide supervision, focus, and accountability; they are not subject-matter tutors, so there's nothing to tell us in advance.",
  },
  {
    q: "How are Guides approved?",
    a: "Every Guide is recruited and reviewed by Study Hall at Home and must be approved by our team before they can work with families.",
  },
  {
    q: "What happens if I have a problem with a session?",
    a: "You can report an issue with any completed session from your parent portal. Our team reviews every report, and you can see its status move from Received to Under review to Resolved.",
  },
];
