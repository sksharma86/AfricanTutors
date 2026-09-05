/**
 * Public FAQ content. Every answer must match the actual implemented business
 * rules (current booking, one-free-session-per-account/household, 24-hour
 * cancellation, recorded on-platform sessions, managed availability-based
 * matching). Do not add policy the product doesn't enforce.
 *
 * Public offer architecture (Pay as you go / À la carte / Study Hall 365) is
 * marketing presentation. Purchasing for Study Hall 365 and the 10-Study-Hall
 * à la carte offer is not live yet — do not describe a checkout path.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "What is Study Hall (at home)?",
    a: "Live online Study Hall. A highly vetted Guide stays with your child on video during one dedicated hour of focused academic time — homework, studying, reading, test preparation, or whatever will move them forward — so they stay on track, and you get the hour back.",
  },
  {
    q: "Is this tutoring?",
    a: "No. Study Hall is focused academic time with human accountability. Guides do not tutor, teach lessons, provide answers, or complete the work.",
  },
  {
    q: "What does the Guide actually do?",
    a: "At the start, the Guide helps your child identify what needs to get done and set a simple plan for the hour. Then they stay present: keeping the student accountable, checking progress, encouraging them to keep going, and redirecting attention when it drifts. At the end, they review what got done and write a short parent report.",
  },
  {
    q: "Can my child ask for homework help?",
    a: "Children should bring their own work and do it independently. Guides may encourage them to try the next step, but they do not tutor, teach lessons, or provide answers.",
  },
  {
    q: "What if my child doesn’t have homework?",
    a: "Homework is only one use of the hour. A Study Hall can be used for studying, reading, reviewing, test preparation, projects, research, catching up, working ahead, or school organization. There may not be homework every day. There is always an opportunity to build the habit. When nothing else is waiting, reading is a reliable, productive use of the hour.",
  },
  {
    q: "Does my child need to be struggling in school?",
    a: "Not at all. Study Hall is for students at every level. Some use the hour to catch up. Others use it for homework, reading, or test preparation. Students already doing well can review, work ahead, or strengthen the habits that help them remain successful. Study Hall isn’t about where your child is starting. It’s about building the routine that helps them keep moving forward.",
  },
  {
    q: "Do I have to book a Study Hall every day?",
    a: "No. Study Hall 365 gives your family the option to use one 60-minute Study Hall every calendar day, but you decide which days work. We encourage consistency because that’s how routines become habits, but there is no requirement to attend every day. 365 means available every day. It doesn’t mean required every day.",
  },
  {
    q: "Do I have to book at the same time every day?",
    a: "No. A consistent time can make building a routine easier, but family schedules change. A family might book 4 PM Monday, 7 PM Tuesday, skip Wednesday, and return Thursday. Study Hall 365 is designed to create structure without taking away flexibility.",
  },
  {
    q: "Who are the Guides?",
    a: "Every Guide is reviewed and approved before working with families. They stay present, encourage focus, and keep the hour moving.",
  },
  {
    q: "Where do Guides work from?",
    a: "Guides work remotely from Kenya. They’re carefully vetted and trained for Study Hall (at home). Their role is presence, encouragement, redirection, and accountability — not tutoring.",
  },
  {
    q: "How much does it cost?",
    a: "Your first 60-minute Study Hall is free — no credit card. Pay as you go is $12 for one 60-minute Study Hall. À la carte is $100 for 10 Study Halls that never expire. Study Hall 365 is $149/month for one 60-minute Study Hall available every calendar day. Unused days do not accumulate. Start with your first Study Hall free.",
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
    q: "Can siblings join the same Study Hall?",
    a: "Yes. Up to three children from the same household can join one Study Hall together at no additional cost per child. All participating children should remain visible on camera during the session. You receive a short report with feedback for each child.",
  },
  {
    q: "Can I cancel?",
    a: "Yes. Cancel 24 or more hours before a session and the session value returns to your account. Cancellations within 24 hours of the start time are non-refundable.",
  },
  {
    q: "What equipment does my child need?",
    a: "A computer or tablet with a camera and microphone, a reliable internet connection, and whatever they plan to work on. They join from home through Study Hall (at home).",
  },
  {
    q: "Do I need a credit card for the free session?",
    a: "No. The free session requires no credit card and no payment information.",
  },
  {
    q: "How does Study Hall work?",
    a: "Create a parent account, add your child, and pick a time. Your child joins a private live Study Hall from home. The hour follows Plan, Focus, and Finish. Afterward, you get a short report. Recordings stay available for 60 days.",
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
    a: "Yes. One parent account can book for one, two, or three children. The free first Study Hall is one per account, not one per child — and up to three siblings can join that one Study Hall.",
  },
  {
    q: "Do prepaid Study Halls expire?",
    a: "À la carte Study Halls never expire and apply when they cover a booking. Study Hall 365 is different: unused days do not accumulate and do not roll over to the next month.",
  },
  {
    q: "What happens if I cancel?",
    a: "Cancel 24 or more hours before a session and its value returns to your account. Cancellations within 24 hours of the start time are non-refundable.",
  },
  {
    q: "Can I choose my Guide?",
    a: "We match your child with an available, highly vetted Guide for the time you choose. Where we can, we keep children with a Guide they’ve worked with before.",
  },
  {
    q: "What do children work on?",
    a: "Their own academic work — homework, studying, reading, test preparation, projects, research, review, catching up, working ahead, or school organization. Guides provide presence and accountability, not subject tutoring, so there’s nothing to prepare in advance beyond bringing the work.",
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
