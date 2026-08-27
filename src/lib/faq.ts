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
    a: "Live online homework supervision. A highly vetted Guide stays with your child on video while they do their own work — so they stay focused, and you get the evening back.",
  },
  {
    q: "Is this tutoring?",
    a: "No. Study Hall (at home) provides live homework supervision and accountability rather than subject instruction.",
  },
  {
    q: "What does the Guide actually do?",
    a: "Guides create the structure that helps kids start, stay focused, and finish their work independently.",
  },
  {
    q: "Can my child ask for homework help?",
    a: "Children should bring their own homework and work independently. Guides may encourage them to try the next step, but they do not tutor, teach lessons, or provide answers.",
  },
  {
    q: "Who are the Guides?",
    a: "Every Guide is reviewed and approved before working with families. They stay present, encourage focus, and keep the hour moving.",
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
    q: "How does the free first session work?",
    a: "Create a parent account, add your child, and book a 60-minute Study Hall. Eligible new accounts get the first hour free — no credit card. The free session is one per account, not one per child.",
  },
  {
    q: "How long can I access recordings?",
    a: "Recordings stay available for 60 days after the session. They are not stored permanently.",
  },
  {
    q: "Can siblings participate?",
    a: "You can book separate Study Halls for siblings from the same parent account. Each session is one child with one Guide. The free first session applies once per account.",
  },
  {
    q: "Can I cancel?",
    a: "Yes. Cancel 24 or more hours before a session and the session value returns to your account. Cancellations within 24 hours of the start time are non-refundable.",
  },
  {
    q: "What equipment does my child need?",
    a: "A computer or tablet with a camera and microphone, a reliable internet connection, and their homework. They join from home through Study Hall (at home).",
  },
  {
    q: "Do I need a credit card for the free session?",
    a: "No. The free session requires no credit card and no payment information.",
  },
  {
    q: "How does Study Hall work?",
    a: "Create a parent account, add your child, and pick a time. Your child joins a private live Study Hall from home. Afterward, you get a short report. Recordings stay available for 60 days.",
  },
  {
    q: "Are sessions recorded?",
    a: "Yes. Sessions are recorded for safety and parent review. Parents can access recordings in their account for 60 days after the Study Hall.",
  },
  {
    q: "What if my child needs me during Study Hall?",
    a: "If a Guide needs you during Study Hall, they can contact your phone directly through the platform. Guides never see your phone number.",
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
