import { PortalReveal } from "@/components/marketing/home/portal-reveal";
import { PortalStage } from "@/components/marketing/home/portal-stage";
import { Container } from "@/components/ui/container";

export const HOME_PORTAL_HEADLINE = "Everything in one place.";
export const HOME_PORTAL_SUPPORT =
  "See what’s coming up, plan the week, join Study Halls, and check in afterward, all from your Parent Portal.";

/**
 * Moment 4 — the product reveal. The site turns near-black and the real
 * Parent Portal becomes the hero object, unveiled step by step.
 */
export function HomePortal() {
  return (
    <section id="home-portal" className="sh-home-portal" aria-labelledby="home-portal-title">
      <Container size="wide">
        <div className="sh-home-portal__intro sh-rise">
          <p className="sh-home-kicker sh-home-kicker--light">The Parent Portal</p>
          <h2 id="home-portal-title" className="sh-home-display sh-home-portal__title">
            {HOME_PORTAL_HEADLINE}
          </h2>
          <p className="sh-home-portal__lede">{HOME_PORTAL_SUPPORT}</p>
        </div>

        <p className="sr-only">
          Real Parent Portal home: your Study Hall week with Plan my week, the next Study Hall with Join,
          household hours, and the most recent Study Hall with its report and recording.
        </p>
        <PortalReveal stage={<PortalStage />} />
      </Container>
    </section>
  );
}
