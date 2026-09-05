/**
 * Qualified family-value copy. Do not advertise a bare per-child rate.
 * Study Hall 365 math is only true at maximum use in a 31-day month,
 * and the $1.60 figure additionally assumes three siblings sharing the hour.
 */

export const HERO_HOUSEHOLD_CUE = "Up to 3 siblings can join one Study Hall.";

export const HOUSEHOLD_VALUE_EYEBROW = "One Study Hall. One price.";

export const HOUSEHOLD_VALUE_HEADLINE = "Up to 3 siblings can join together.";

export const HOUSEHOLD_VALUE_BODY =
  "Have more than one child? Put them in the same Study Hall with one live Guide. You pay for the Study Hall, not per child.";

export const HOUSEHOLD_VALUE_STEPS = Object.freeze([
  { count: "1 child", price: "Same Study Hall price" },
  { count: "2 siblings", price: "Same Study Hall price" },
  { count: "3 siblings", price: "Same Study Hall price" },
]);

export const FAMILY_VALUE_EYEBROW = "One price. Up to three siblings.";

export const FAMILY_VALUE_BODY =
  "Up to three children from the same household can attend a Study Hall together at no additional cost per child. You pay for the Study Hall, not per child.";

export const FAMILY_VALUE_RATE =
  "At maximum use in a 31-day month, Study Hall 365 is about $4.81 per Study Hall — or about $1.60 per child-hour when three siblings share that hour.";

export const FAMILY_VALUE_MATH = Object.freeze([
  "Study Hall 365 · $149/month · one Study Hall available each calendar day",
  "In a 31-day month at daily use: about $4.81 per Study Hall",
  "With three siblings in that same Study Hall: about $1.60 per child-hour",
]);

export const FREE_STUDY_HALL_HOUSEHOLD =
  "60 minutes. Up to three siblings can join. One free Study Hall per account — not one per child.";

export const BOOKING_SAME_PRICE_NOTE = "Up to 3 siblings can join for the same Study Hall price.";

export const INFOGRAPHIC_BOOK_BODY = "One child or up to three siblings can join.";

export const INFOGRAPHIC_STUDY_BODY = "One live Guide keeps the Study Hall focused.";

export const INFOGRAPHIC_REPORT_BODY = "Useful feedback for each child who attended.";

export const HOW_IT_WORKS_HOUSEHOLD =
  "Book one Study Hall, select up to three children, join one Guide, and receive feedback for each child. You pay for the Study Hall, not per child.";

/** Future multi-child campaign copy. Not rendered on the general homepage. */
export const MULTI_CHILD_CAMPAIGN = Object.freeze({
  headline: "Three kids. One Study Hall. One price.",
  support: "Up to three siblings can join the same live Study Hall with one Guide — for one Study Hall price.",
  price: "With three kids using Study Hall 365 every day in a 31-day month, the hour can work out to about $1.60 each.",
  cta: "Try your first Study Hall free.",
  altHeadline: "Got 2 or 3 kids who need the hour?",
  altSupport: "Put them in the same Study Hall for one price.",
});
