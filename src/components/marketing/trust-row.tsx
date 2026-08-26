import Image from "next/image";

import { Container } from "@/components/ui/container";

/**
 * Visual trust strip — photography, not chips or cards.
 */
export function TrustRow() {
  return (
    <section aria-label="Why families choose Study Hall" className="bg-white">
      <Container size="wide" className="grid gap-px bg-ink-100 py-0 sm:grid-cols-3">
        <figure className="relative min-h-[12rem] overflow-hidden bg-ink-900 sm:min-h-[16rem]">
          <Image
            src="/images/marketing/studyhall-focus-close.webp"
            alt="A student concentrating on homework at home"
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover"
          />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 py-4 text-sm font-medium text-white">
            Child working from home
          </figcaption>
        </figure>
        <figure className="relative min-h-[12rem] overflow-hidden bg-ink-900 sm:min-h-[16rem]">
          <Image
            src="/images/tutor-portrait.jpg"
            alt="A Guide present on a remote video session"
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover object-[50%_18%]"
          />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 py-4 text-sm font-medium text-white">
            Guide present on video
          </figcaption>
        </figure>
        <figure className="relative min-h-[12rem] overflow-hidden bg-ink-900 sm:min-h-[16rem]">
          <Image
            src="/images/marketing/studyhall-hero-desk.webp"
            alt="A home desk set up for a live Study Hall"
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover"
          />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 py-4 text-sm font-medium text-white">
            Sessions recorded for 60 days
          </figcaption>
        </figure>
      </Container>
    </section>
  );
}
