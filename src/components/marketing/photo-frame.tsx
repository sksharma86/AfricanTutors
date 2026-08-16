import Image from "next/image";

export function PhotoFrame({
  src,
  alt,
  caption,
  priority,
}: {
  src: string;
  alt: string;
  caption?: string;
  priority?: boolean;
}) {
  return (
    <figure className="relative">
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-ink-100">
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
      {caption ? (
        <figcaption className="mt-3 text-sm text-ink-400">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
