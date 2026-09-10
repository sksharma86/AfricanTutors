import { ParentPortalPreview } from "@/components/marketing/product-showcase";
import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

export const HOME_PORTAL_HEADLINE = "Everything in one place.";
export const HOME_PORTAL_SUPPORT =
  "See what’s coming up, plan the week, join Study Halls, and check in afterward, all from your Parent Portal.";

const ANNOTATIONS = [
  { key: "plan", label: "Plan the week" },
  { key: "join", label: "Join when it’s time" },
  { key: "report", label: "See how it went" },
] as const;

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
            <ul className="sh-home-portal__annos">
              {ANNOTATIONS.map((item) => (
                <li key={item.key} className={`sh-home-portal__anno sh-home-portal__anno--${item.key}`}>
                  <span>{item.label}</span>
                  <span className="sh-home-portal__anno-line" aria-hidden />
                </li>
              ))}
            </ul>
            <div className="sh-home-portal__frame" aria-label="Parent Portal">
              <p className="sr-only">
                Real Parent Portal home: Study Halls for planning the week, next Study Hall and Join,
                and Recent Study Hall reports.
              </p>
              <ParentPortalPreview />
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
