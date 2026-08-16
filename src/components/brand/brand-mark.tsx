import Image from "next/image";

/**
 * The African Tutors graphic mark: the silhouette of Africa merged with a
 * human profile wearing a graduation cap. This is the primary visual
 * identity of the brand (see DECISIONS.md) — the typography beside it is
 * not part of the mark itself and can be set in whatever type system suits
 * the surface (see BrandLockup for the icon + wordmark pairing used in the
 * navbar/footer).
 *
 * Source: public/brand/mark.png — a cleaned, transparent-background crop
 * derived from the supplied brand reference image. If a vector (SVG) or
 * higher-resolution production asset is produced later, it should replace
 * this file directly; every consumer references this one path.
 */
export function BrandMark({
  size = 36,
  className,
  priority,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/mark.png"
      alt=""
      width={size}
      height={size}
      priority={priority}
      className={className}
    />
  );
}
