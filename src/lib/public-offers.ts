/**
 * Public marketing offer architecture. Presentation only.
 * PR 2 can attach purchasing to these ids. Do not add checkout hrefs here.
 */

export const PUBLIC_OFFER_CTA_HREF = "/signup";
export const START_FREE_CTA = "Start free";

export const STUDY_HALL_365_MONTHLY_USD = 149;
export const STUDY_HALL_365_EXAMPLE_DAYS = 31;
export const STUDY_HALL_365_PER_HALL = "4.81";
export const STUDY_HALL_365_PER_CHILD = "1.60";

export const PUBLIC_OFFERS = [
  {
    id: "payg",
    name: "Pay as you go",
    price: "$12",
    detail: "1 Study Hall · 60 minutes",
  },
  {
    id: "alacarte",
    name: "À la carte",
    price: "$100",
    detail: "10 Study Halls · never expire",
  },
  {
    id: "study-hall-365",
    name: "Study Hall 365",
    price: "$149",
    unit: "/month",
    detail: "One Study Hall available every calendar day",
    featured: true,
  },
] as const;
