import {
  CHAIR_BACK,
  CHAIR_SEAT,
  DESK_COMPACT,
  DESK_LEG_L,
  DESK_LEG_R,
  DESK_TOP,
  HOUSE_PATH,
  LAMP_CORD,
  LAMP_SHADE,
  LIGHT_CONE,
  MARK_VIEWBOX,
  markColors,
  resolveMarkDetail,
  type StudyHallMarkDetail,
  type StudyHallMarkVariant,
} from "@/lib/brand/study-hall-mark";
import { cn } from "@/lib/utils";

/**
 * Official Study Hall (at home) mark: house + desk/chair + hanging lamp.
 * Decorative by default. Linked lockups supply the accessible name.
 */
export function StudyHallMark({
  size = 32,
  variant = "light",
  detail = "auto",
  className,
  title,
}: {
  size?: number;
  variant?: StudyHallMarkVariant;
  detail?: StudyHallMarkDetail;
  className?: string;
  /** When set, the SVG is announced as an image. Otherwise it is decorative. */
  title?: string;
}) {
  const resolved = resolveMarkDetail(size, detail);
  const { line, gold } = markColors(variant);
  const stroke = resolved === "compact" ? 2 : 1.65;
  const labelled = Boolean(title);

  return (
    <svg
      viewBox={MARK_VIEWBOX}
      width={size}
      height={size}
      fill="none"
      className={cn("shrink-0", className)}
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
      aria-label={labelled ? title : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path
        d={HOUSE_PATH}
        stroke={line}
        strokeWidth={stroke}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {resolved === "compact" ? (
        <>
          <circle cx="16" cy="11.15" r="1.45" fill={gold} />
          <path d={DESK_COMPACT} stroke={line} strokeWidth={stroke} strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d={LAMP_CORD} stroke={line} strokeWidth={1.35} strokeLinecap="round" />
          <path d={LAMP_SHADE} fill={gold} />
          <path d={LIGHT_CONE} fill={gold} opacity={variant === "mono" ? 0.22 : 0.28} />
          <path d={DESK_TOP} stroke={line} strokeWidth={1.7} strokeLinecap="round" />
          <path d={DESK_LEG_L} stroke={line} strokeWidth={1.5} strokeLinecap="round" />
          <path d={DESK_LEG_R} stroke={line} strokeWidth={1.5} strokeLinecap="round" />
          <path d={CHAIR_BACK} stroke={line} strokeWidth={1.5} strokeLinecap="round" />
          <path d={CHAIR_SEAT} stroke={line} strokeWidth={1.5} strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
