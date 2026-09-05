import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { Faq } from "@/components/marketing/faq";
import { PageHeader } from "@/components/marketing/page-header";
import { PricingSection } from "@/components/marketing/pricing-section";
import { StudyHall365 } from "@/components/marketing/study-hall-365";
import { getCurrentUser } from "@/lib/auth";
import { FAQ_ITEMS } from "@/lib/faq";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { FREE_TRIAL_CTA } from "@/lib/pricing";
import { DASHBOARD_PATH_BY_ROLE } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Study Hall pricing: first session free, then Pay as you go at $12 for one hour, À la carte at $100 for 10 Study Halls, or Study Hall 365 at $149/month.",
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const user = await getCurrentUser();
  const applicant = user?.role === "student" ? await getGuideApplicantInfo(user.id) : null;

  const cta = !user
    ? { href: "/signup", label: FREE_TRIAL_CTA, title: "Start with a free hour.", description: "Create an account and book your first Study Hall — on us." }
    : applicant
      ? {
          href: "/dashboard/applicant",
          label: "View application status",
          title: "Your Guide application is in review.",
          description: "Parent booking unlocks after approval. Check your application status anytime.",
        }
      : user.role === "student"
        ? {
            href: "/dashboard/student/book",
            label: "Book a Study Hall",
            title: "Continue in your account.",
            description: "Book a Study Hall from your parent portal. Prepaid hours you already own still apply.",
          }
        : {
            href: DASHBOARD_PATH_BY_ROLE[user.role],
            label: "Go to dashboard",
            title: "You’re signed in.",
            description: "Open your dashboard to continue.",
          };

  return (
    <div className="mkt-atmosphere">
      <PageHeader
        eyebrow="Pricing"
        title="One Study Hall is one hour."
        description="Try a real Study Hall with a highly vetted Guide — no credit card. Then choose how your family continues."
      />

      <StudyHall365 />
      <PricingSection withHeader={false} ctaHref={cta.href} ctaLabel={cta.label} />

      <Faq
        eyebrow="Pricing FAQ"
        title="Pricing questions"
        items={FAQ_ITEMS.filter((f) =>
          [
            "How much does it cost?",
            "Is the first session really free?",
            "Do I have to book a Study Hall every day?",
            "Do I have to book at the same time every day?",
            "Can siblings join the same Study Hall?",
            "Do prepaid Study Halls expire?",
            "What happens if I cancel?",
          ].includes(f.q),
        )}
      />

      <CtaSection title={cta.title} description={cta.description} primaryHref={cta.href} primaryLabel={cta.label} />
    </div>
  );
}
