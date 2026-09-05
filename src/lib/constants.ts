export const SITE_NAME = "Study Hall (at home)";

export const SITE_DESCRIPTION =
  "Live online Study Hall that helps children build consistent academic habits with focused time and a real human Guide. First 60 minutes free.";

/** Absolute base URL for SEO/canonical/OG. Override with NEXT_PUBLIC_SITE_URL. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://studyhallathome.com";

export const PUBLIC_NAV_LINKS = [
  { label: "How it works", href: "/how-it-works" },
  { label: "The Study Hall Hour", href: "/the-study-hall-hour" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/faq" },
] as const;

export const FOOTER_SECTIONS = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "/how-it-works" },
      { label: "The Study Hall Hour", href: "/the-study-hall-hour" },
      { label: "Pricing", href: "/pricing" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    heading: "Company",
    links: [
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
    links: [{ label: "Become a Guide", href: "/guides/apply" }],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
    ],
  },
] as const;
