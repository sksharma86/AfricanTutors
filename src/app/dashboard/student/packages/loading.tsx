import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-8">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-9 w-64" />
      <Skeleton className="mt-3 h-4 w-full max-w-lg" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-60 rounded-2xl" />
        <Skeleton className="h-60 rounded-2xl" />
        <Skeleton className="h-60 rounded-2xl" />
      </div>
    </div>
  );
}
