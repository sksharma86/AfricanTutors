import { cn } from "@/lib/utils";

/** A single shimmering placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-ink-100", className)} />;
}

/** A contextual loading placeholder shaped like a session/summary card. */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-ink-100 bg-white p-5", className)}>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-3 w-56" />
      <Skeleton className="mt-2 h-3 w-40" />
      <Skeleton className="mt-5 h-9 w-28 rounded-full" />
    </div>
  );
}
