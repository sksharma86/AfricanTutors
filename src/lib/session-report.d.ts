export type FocusRating = "great_focus" | "good_focus" | "needed_redirection" | "difficult_session";
export type RedirectionLevel = "none" | "a_little" | "several_times";

export const FOCUS_RATINGS: readonly FocusRating[];
export const FOCUS_LABELS: Readonly<Record<FocusRating, string>>;
export const REDIRECTION_LEVELS: readonly RedirectionLevel[];
export const REDIRECTION_LABELS: Readonly<Record<RedirectionLevel, string>>;
export const WORK_SUMMARY_MAX: number;
export const GUIDE_NOTE_MAX: number;

export function isFocusRating(value: string | null | undefined): value is FocusRating;
export function isRedirectionLevel(value: string | null | undefined): value is RedirectionLevel;
