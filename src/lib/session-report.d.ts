export type FocusRating = "great_focus" | "good_focus" | "needed_redirection" | "difficult_session";
export type RedirectionLevel = "none" | "a_little" | "several_times";

export const FOCUS_RATINGS: readonly FocusRating[];
export const FOCUS_LABELS: Readonly<Record<FocusRating, string>>;
export const REDIRECTION_LEVELS: readonly RedirectionLevel[];
export const REDIRECTION_LABELS: Readonly<Record<RedirectionLevel, string>>;
export const PARENT_FOCUS_LABELS: Readonly<Record<FocusRating, string>>;
export const WORK_SUMMARY_MAX: number;
export const GUIDE_NOTE_MAX: number;
export const WORK_COMPLETED_PLACEHOLDER: string;
export const WORK_COMPLETED_HINT: string;
export function parentFocusLabel(value: string | null | undefined): string;

export function isFocusRating(value: string | null | undefined): value is FocusRating;
export function isRedirectionLevel(value: string | null | undefined): value is RedirectionLevel;
