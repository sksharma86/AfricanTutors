import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-full bg-ink-50/40">
      <div className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6 lg:px-8">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <div className="mt-8 space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </div>
  );
}
