/**
 * Public FAQ. Answers must match implemented rules.
 * Offer architecture is marketing presentation; 365 checkout is not live.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "What is Study Hall (at home)?",
    a: "A 60-minute live Study Hall. Your child sits down to work on their academic life while a highly vetted Guide stays present on video — for accountability, encouragement, and redirection.",
  },
  {
    q: "Is this tutoring?",
    a: "No. The child does their own work. Guides do not tutor, teach lessons, provide answers, or complete assignments.",
  },
  {
    q: "What can they work on?",
    a: "Homework, studying, reading, test preparation, projects, research, reviewing, catching up, working ahead, or school organization.",
  },
  {
    q: "What if my child doesn’t have homework?",
    a: "They can read, review, prepare for a test, catch up, work ahead, or organize. Study Hall does not require an emergency.",
  },
  {
    q: "Does my child need to be struggling in school?",
    a: "No. Study Hall is for students across academic levels — catching up, staying current, or protecting what’s already going well. Grades 3–12.",
  },
  {
    q: "Do I have to use Study Hall every day?",
    a: "No. Study Hall 365 makes one hour available every calendar day. You choose which days to use.",
  },
  {
    q: "Do I have to book the same time every day?",
    a: "No. A consistent time can help, but days and times can change.",
  },
  {
    q: "How are Guides vetted?",
    a: "Study Hall (at home) recruits, reviews, and trains every Guide. They must be approved before they work with families. They work remotely from Kenya.",
  },
  {
    q: "Are sessions recorded?",
    a: "Yes. Sessions are recorded for quality and safety. Parents can access recordings for 60 days after the Study Hall.",
  },
  {
    q: "How does the first free Study Hall work?",
    a: "Create a parent account, add your child, and book a 60-minute Study Hall. Eligible new accounts get the first 1-hour Study Hall session free — no credit card. One per account, not one per child.",
  },
  {
    q: "How much does it cost?",
    a: "Your first 60-minute Study Hall is free. Pay as you go is $12 for one hour. À la carte is $100 for 10 Study Halls that never expire. Study Hall 365 is $149/month for one hour available every calendar day. Start with the free hour — 365 checkout is not live yet.",
  },
  {
    q: "Can siblings join the same Study Hall?",
    a: "Yes. Up to three children from the same household can join one Study Hall at no additional cost per child. All participating children should remain visible on camera. You receive feedback for each child.",
  },
  {
    q: "Can I cancel?",
    a: "Yes. Cancel 24 or more hours before a session and the session value returns to your account. Cancellations within 24 hours of the start time are non-refundable.",
  },
  {
    q: "What equipment does my child need?",
    a: "A computer or tablet with a camera and microphone, a reliable internet connection, and whatever they plan to work on.",
  },
  {
    q: "What if my child needs me during Study Hall?",
    a: "A Guide can Call Parent through the platform. Guides never see your phone number.",
  },
  {
    q: "Do prepaid Study Halls expire?",
    a: "À la carte Study Halls never expire. Study Hall 365 unused days do not roll over.",
  },
  {
    q: "Can I choose my Guide?",
    a: "We match your child with an available, highly vetted Guide for the time you choose. Where we can, we keep children with a Guide they’ve worked with before.",
  },
  {
    q: "What happens if I have a problem with a session?",
    a: "Report any completed session from your parent portal. Our team reviews every report.",
  },
];
