export const SITE_NAME = "Study Hall at Home";

export const SITE_DESCRIPTION =
  "Affordable live homework supervision for families. A trained Guide keeps your children on task by video while they do their schoolwork — accountability, routine, and evening relief for parents. Your first session is free, no credit card required.";

/** Absolute base URL for SEO/canonical/OG. Override with NEXT_PUBLIC_SITE_URL. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://studyhallathome.com";

export const PUBLIC_NAV_LINKS = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "Why Study Hall", href: "/#why" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/faq" },
] as const;

export const FOOTER_SECTIONS = [
  {
    heading: "Company",
    links: [
      { label: "How It Works", href: "/how-it-works" },
      { label: "Pricing", href: "/pricing" },
      { label: "FAQ", href: "/faq" },
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Start free", href: "/signup" },
      { label: "Sign in", href: "/login" },
    ],
  },
  {
    heading: "Guides",
    links: [{ label: "Become a Guide", href: "/apply-to-tutor" }],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
    ],
  },
] as const;
