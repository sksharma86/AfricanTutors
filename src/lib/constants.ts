export const SITE_NAME = "African Tutors";

export const SITE_DESCRIPTION =
  "High-quality online tutoring without the high price. Work one-on-one with carefully approved tutors from Africa. Your first 30-minute session is free — no credit card required.";

/** Absolute base URL for SEO/canonical/OG. Override with NEXT_PUBLIC_SITE_URL. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://africantutors.com";

export const PUBLIC_NAV_LINKS = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "Why African Tutors", href: "/#why" },
  { label: "Pricing", href: "/pricing" },
  { label: "Subjects", href: "/subjects" },
  { label: "FAQ", href: "/faq" },
] as const;

export const FOOTER_SECTIONS = [
  {
    heading: "Company",
    links: [
      { label: "How It Works", href: "/how-it-works" },
      { label: "Pricing", href: "/pricing" },
      { label: "Subjects", href: "/subjects" },
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
    heading: "Educators",
    links: [{ label: "Apply to tutor", href: "/apply-to-tutor" }],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
    ],
  },
] as const;
