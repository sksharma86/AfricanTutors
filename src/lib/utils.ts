type ClassValue = string | number | null | false | undefined;

/** Minimal class-name joiner so components can conditionally combine Tailwind classes. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
