import { ParentPortalPreview } from "@/components/marketing/product-showcase";
import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

export const HOME_PORTAL_HEADLINE = "Everything in one place.";
export const HOME_PORTAL_SUPPORT =
  "See what’s coming up, plan the week, join Study Halls, and check in afterward, all from your Parent Portal.";

export function HomePortal() {
  return (
    <section id="home-portal" className="sh-home-portal">
      <Container size="wide">
        <div className="sh-home-portal__intro">
          <Reveal>
            <p className="sh-home-kicker">Built for real life</p>
            <h2 className="sh-home-display sh-home-portal__title">{HOME_PORTAL_HEADLINE}</h2>
            <p className="sh-home-portal__lede">{HOME_PORTAL_SUPPORT}</p>
          </Reveal>
        </div>

        <Reveal delay={60}>
          <div className="sh-home-portal__stage">
            <div className="sh-home-portal__frame" aria-label="Parent Portal">
              <p className="sr-only">
                Real Parent Portal home: next Study Hall, join, reports, recordings, and hours.
              </p>
              <ParentPortalPreview />
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
