import { LinkButton } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export function CtaSection({
  title,
  description,
  primaryHref = "/signup",
  primaryLabel = "Try 30 Minutes Free",
  secondaryHref = "/contact",
  secondaryLabel = "Contact Us",
}: {
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="py-20">
      <Container>
        <div className="flex flex-col items-start justify-between gap-8 rounded-3xl bg-ink-900 p-10 sm:p-14 md:flex-row md:items-center">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">
              {title}
            </h2>
            <p className="mt-3 text-base leading-7 text-ink-200">{description}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <LinkButton href={primaryHref} variant="secondary" size="lg">
              {primaryLabel}
            </LinkButton>
            <LinkButton
              href={secondaryHref}
              variant="outline"
              size="lg"
              className="border-white/20 text-white hover:border-white/40 hover:bg-white/5"
            >
              {secondaryLabel}
            </LinkButton>
          </div>
        </div>
      </Container>
    </section>
  );
}
