/**
 * Public FAQ content. Every answer must match the actual implemented business
 * rules (pricing, one-free-trial-per-account, non-expiring package hours, the
 * 24-hour cancellation policy, recorded on-platform sessions, managed matching).
 * Do not add policy here that the product does not enforce.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "What is African Tutors?",
    a: "African Tutors is a managed online tutoring service. We recruit, review, and approve every tutor, then match your student with one for live, one-on-one sessions. It is not an open marketplace — you buy tutoring from African Tutors, and we stand behind every session.",
  },
  {
    q: "Who are the tutors?",
    a: "Our tutors are talented, highly educated academics from across Africa. Every tutor is reviewed and approved by our team before they teach a single session on the platform.",
  },
  {
    q: "How much does tutoring cost?",
    a: "Standard sessions are $12 for 30 minutes or $20 for 60 minutes. You can also save with prepaid hours: 10 hours for $190 ($19/hr), 20 hours for $360 ($18/hr), or 40 hours for $680 ($17/hr).",
  },
  {
    q: "Is the first session really free?",
    a: "Yes. Your first 30-minute session is completely free — a real one-on-one session with an approved tutor, not a sales call.",
  },
  {
    q: "Do I need a credit card for the free trial?",
    a: "No. The free 30-minute session requires no credit card and no payment information.",
  },
  {
    q: "How does online tutoring work?",
    a: "Create an account, choose the subject and a time that works for you, and join a private, live session with your tutor directly through African Tutors from any computer at home.",
  },
  {
    q: "Are sessions recorded?",
    a: "Yes. Sessions are recorded for quality and safety, and to help resolve any issues. Recordings are used internally by African Tutors and are not shared publicly.",
  },
  {
    q: "Can I book for more than one child?",
    a: "Yes. One account can manage and book sessions for multiple students. Note that the free trial is one per account, not one per child.",
  },
  {
    q: "Do tutoring hours expire?",
    a: "No. Prepaid package hours never expire and are used automatically when they fully cover a session.",
  },
  {
    q: "What happens if I cancel?",
    a: "Cancel 24 or more hours before a session and its value returns to your account. Cancellations within 24 hours of the start time are non-refundable.",
  },
  {
    q: "Can I choose my tutor?",
    a: "African Tutors matches your student with an approved tutor for the subject and time you choose, so you do not have to search and vet tutors yourself. Where possible, we keep students with a tutor they have worked with before.",
  },
  {
    q: "What subjects are available?",
    a: "We support core academics and test prep — including Math, Science, English & Writing, Test Prep, and select college courses. Tell us what you need when you book and we will match a qualified tutor.",
  },
  {
    q: "How are tutors approved?",
    a: "Every tutor is recruited and reviewed by African Tutors and must be approved by our team before they can teach on the platform.",
  },
  {
    q: "What happens if I have a problem with a session?",
    a: "You can report an issue with any completed session from your dashboard. Our team reviews every report, and you can see its status move from Received to Under review to Resolved.",
  },
];
