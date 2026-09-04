/**
 * Canonical Study Hall (at home) mark geometry.
 * House outline + study desk/chair + hanging lamp. No raster, no fonts.
 */

export const MARK_VIEWBOX = "0 0 32 32";

export const MARK_INK = "#0c0c0b";
export const MARK_PAPER = "#f7f7f5";
export const MARK_GOLD = "#c98816";
export const MARK_GOLD_DARK = "#e9b754";

export type StudyHallMarkVariant = "light" | "dark" | "mono";
export type StudyHallMarkDetail = "auto" | "full" | "compact";

export function resolveMarkDetail(size: number, detail: StudyHallMarkDetail): "full" | "compact" {
  if (detail === "full" || detail === "compact") return detail;
  return size <= 24 ? "compact" : "full";
}

export function markColors(variant: StudyHallMarkVariant): { line: string; gold: string } {
  if (variant === "dark") return { line: MARK_PAPER, gold: MARK_GOLD_DARK };
  if (variant === "mono") return { line: "currentColor", gold: "currentColor" };
  return { line: MARK_INK, gold: MARK_GOLD };
}

/** Closed house silhouette — dominant at every size. */
export const HOUSE_PATH = "M5 14.15 16 5.45 27 14.15V26.15H5Z";

/** Compact desk: one shelf line. */
export const DESK_COMPACT = "M10.6 20.35H21.4";

export const LAMP_CORD = "M16 7.35V10.55";
export const LAMP_SHADE = "M13.85 10.55H18.15L17.35 12.85H14.65Z";
export const LIGHT_CONE = "M14.45 12.9H17.55L19.55 19.85H12.45Z";
export const DESK_TOP = "M10.4 19.95H21.6";
export const DESK_LEG_L = "M12.15 19.95V24.15";
export const DESK_LEG_R = "M19.85 19.95V24.15";
export const CHAIR_BACK = "M9.15 17.55V23.55";
export const CHAIR_SEAT = "M9.15 21.05H12.35";

export function compactLampVisible(size: number): boolean {
  return size >= 20;
}
