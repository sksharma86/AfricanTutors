/**
 * Public marketing offer architecture (PR 1).
 *
 * Presentation only. These ids are stable so PR 2 can attach real purchasing.
 * Do NOT import this module from checkout, Stripe, or booking services.
 * Do NOT add checkout hrefs here until those products exist.
 */

export const STUDY_HALL_HOUR_MINUTES = 60;

/** Anonymous and marketing CTAs stay on the existing free-first-Study-Hall funnel. */
export const PUBLIC_OFFER_CTA_HREF = "/signup";

export const STUDY_HALL_365_MONTHLY_USD = 149;
export const STUDY_HALL_365_EXAMPLE_DAYS = 31;
export const STUDY_HALL_365_PER_HALL_USD = "4.81";
export const STUDY_HALL_365_PER_CHILD_USD = "1.60";
export const MAX_SIBLINGS_PER_STUDY_HALL = 3;

export const ALACARTE_STUDY_HALLS = 10;
export const ALACARTE_PRICE_USD = 100;
export const ALACARTE_EACH_USD = 10;

export type PublicOfferId = "payg" | "alacarte" | "study-hall-365";

export interface PublicOffer {
  id: PublicOfferId;
  name: string;
  priceLabel: string;
  unit: string;
  detail: string;
  note: string;
  featured?: boolean;
}

export const PUBLIC_OFFERS: readonly PublicOffer[] = [
  {
    id: "payg",
    name: "Pay as you go",
    priceLabel: "$12",
    unit: "1 Study Hall",
    detail: "60 minutes",
    note: "Book an hour when you need one.",
  },
  {
    id: "alacarte",
    name: "À la carte",
    priceLabel: "$100",
    unit: "10 Study Halls",
    detail: "$10 each",
    note: "Study Halls never expire.",
  },
  {
    id: "study-hall-365",
    name: "Study Hall 365",
    priceLabel: "$149",
    unit: "per month",
    detail: "One Study Hall available every calendar day",
    note: "Unused days do not roll over. Available every day does not mean required every day.",
    featured: true,
  },
];

export function publicOfferById(id: PublicOfferId): PublicOffer {
  const offer = PUBLIC_OFFERS.find((item) => item.id === id);
  if (!offer) throw new Error(`Unknown public offer: ${id}`);
  return offer;
}
