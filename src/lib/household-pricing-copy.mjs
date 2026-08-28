/**
 * Qualified family-value copy. Do not advertise a bare "$3/hour".
 * The $3 figure is only true when three siblings share a 28-hour package hour.
 */

export const HERO_HOUSEHOLD_CUE = "Up to 3 siblings can join one Study Hall.";

export const HOUSEHOLD_VALUE_EYEBROW = "One Study Hall. One price.";

export const HOUSEHOLD_VALUE_HEADLINE = "Up to 3 siblings can join together.";

export const HOUSEHOLD_VALUE_BODY =
  "Have more than one child with homework? Put them in the same Study Hall with one live Guide. You pay for the Study Hall, not per child.";

export const HOUSEHOLD_VALUE_STEPS = Object.freeze([
  { count: "1 child", price: "Same Study Hall price" },
  { count: "2 siblings", price: "Same Study Hall price" },
  { count: "3 siblings", price: "Same Study Hall price" },
]);

export const FAMILY_VALUE_EYEBROW = "One price. Up to three siblings.";

export const FAMILY_VALUE_BODY =
  "Up to three children from the same household can attend a Study Hall together at no additional cost per child. You pay for the Study Hall, not per child.";

export const FAMILY_VALUE_RATE =
  "With three siblings in the same Study Hall, our 28-hour package works out to $3 per child/hour.";

export const FAMILY_VALUE_MATH = Object.freeze([
  "Pay as you go · $12/hour · with 3 children: $4 per child/hour",
  "14 hours · $10/hour · with 3 children: about $3.33 per child/hour",
  "28 hours · $9/hour · with 3 children: $3 per child/hour",
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
  headline: "Three kids. Three sets of homework. One Study Hall.",
  support: "Up to three siblings can join the same live Study Hall with one Guide — for one Study Hall price.",
  price: "With three kids, our largest package works out to $3 each per hour.",
  cta: "Try your first Study Hall free.",
  altHeadline: "Got 2 or 3 kids with homework?",
  altSupport: "Put them in the same Study Hall for one price.",
});
