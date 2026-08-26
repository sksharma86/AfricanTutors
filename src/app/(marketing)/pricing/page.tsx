import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { Faq } from "@/components/marketing/faq";
import { PageHeader } from "@/components/marketing/page-header";
import { PricingSection } from "@/components/marketing/pricing-section";
import { Container } from "@/components/ui/container";
import { getCurrentUser } from "@/lib/auth";
import { FAQ_ITEMS } from "@/lib/faq";
import { getGuideApplicantInfo } from "@/lib/guide-applicant";
import { getPublicPackages } from "@/lib/marketing";
import { AS_LOW_AS_LABEL, FREE_TRIAL_CTA, PAYG_PRICE_USD, formatUsd } from "@/lib/pricing";
import { DASHBOARD_PATH_BY_ROLE } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Study Hall pricing: first session free, then ${formatUsd(PAYG_PRICE_USD)}/hour pay as you go — or save with 14-hour and 28-hour prepaid routines (${AS_LOW_AS_LABEL}). Hours never expire.`,
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const [packages, user] = await Promise.all([getPublicPackages(), getCurrentUser()]);
  const applicant = user?.role === "student" ? await getGuideApplicantInfo(user.id) : null;

  const cta = !user
    ? { href: "/signup", label: FREE_TRIAL_CTA, title: "Start with a free hour.", description: "Create an account and book your first Study Hall — on us." }
    : applicant
      ? {
          href: "/dashboard/applicant",
          label: "View application status",
          title: "Your Guide application is in review.",
          description: "Parent booking and prepaid hours unlock after approval. Check your application status anytime.",
        }
      : user.role === "student"
        ? {
            href: "/dashboard/student/packages#prepaid",
            label: "Buy prepaid hours",
            title: "Save with prepaid hours.",
            description: "Prepaid hours never expire. Buy hours in your account, or book a single Study Hall anytime.",
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
        title={`Starting at ${formatUsd(PAYG_PRICE_USD)}/hour. First hour free.`}
        description={`Try a real Study Hall with a highly vetted Guide — no credit card. Then ${formatUsd(PAYG_PRICE_USD)}/hour as you go, or save with prepaid hours that never expire.`}
      />

      <PricingSection packages={packages} withHeader={false} ctaHref={cta.href} ctaLabel={cta.label} />

      <Container size="wide" className="pb-6">
        <p id="prepaid" className="scroll-mt-24 max-w-2xl text-[15px] leading-7 text-ink-500">
          The 14 Hour Routine is ${formatUsd(140)} ({formatUsd(10)}/hour). The 28 Hour Routine is{" "}
          {formatUsd(252)} ({formatUsd(9)}/hour). Prepaid hours never expire — they are not limited to two or four
          weeks of use.
        </p>
      </Container>

      <Faq
        eyebrow="Pricing FAQ"
        title="Pricing questions"
        items={FAQ_ITEMS.filter((f) =>
          [
            "How much does it cost?",
            "Is the first session really free?",
            "Do prepaid hours expire?",
            "What happens if I cancel?",
          ].includes(f.q),
        )}
      />

      <CtaSection title={cta.title} description={cta.description} primaryHref={cta.href} primaryLabel={cta.label} />
    </div>
  );
}
