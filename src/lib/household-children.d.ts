export const MAX_CHILDREN_PER_STUDY_HALL: 3;
export function firstNameOf(fullName: string | null | undefined, fallback?: string): string;
export function formatChildNames(names: Array<string | null | undefined> | null | undefined, fallback?: string): string;
export function possessiveStudyHall(names: Array<string | null | undefined> | null | undefined): string;
export function childCountLabel(count: number): string;
export function uniqueStudentIds(ids: Array<string | null | undefined> | null | undefined): string[];
export function normalizeStudentIds(ids: Array<string | null | undefined> | null | undefined, max?: number): string[];
export function wouldExceedChildLimit(
  selectedIds: Array<string | null | undefined> | null | undefined,
  nextId: string,
  max?: number,
): boolean;
export function bookingChildNames(
  booking: {
    student_first_names?: string[] | null;
    student_first_name?: string | null;
    child_count?: number | null;
    students?: { full_name?: string | null } | null;
  } | null | undefined,
  fallback?: string,
): string;
export function bookingChildCount(booking: { student_first_names?: string[] | null; child_count?: number | null } | null | undefined): number;
