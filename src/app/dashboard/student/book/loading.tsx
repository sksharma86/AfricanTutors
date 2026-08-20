import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10 lg:px-8">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-9 w-56" />
      <Skeleton className="mt-3 h-4 w-full max-w-md" />
      <Skeleton className="mt-8 h-72 w-full rounded-2xl" />
    </div>
  );
}
