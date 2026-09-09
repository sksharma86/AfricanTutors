import { Reveal } from "@/components/marketing/reveal";
import { Container } from "@/components/ui/container";

export function Phase1PersonalBeat() {
  return (
    <section className="phase1-personal" aria-labelledby="phase1-personal-title">
      <Container size="wide">
        <Reveal>
          <h2 id="phase1-personal-title" className="phase1-display phase1-personal__title">
            <span className="block">Their homework.</span>
            <span className="block">Their Study Hall.</span>
            <span className="block text-ink-500">Their Guide.</span>
          </h2>
        </Reveal>
        <Reveal delay={60}>
          <p className="phase1-personal__lede">
            Every Study Hall is a private, one-to-one session with a dedicated Guide—not a group classroom.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
