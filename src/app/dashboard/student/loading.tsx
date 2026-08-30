import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="parent-app min-h-full">
      <div className="flex min-h-full">
        <div className="hidden w-[15.5rem] shrink-0 border-r border-[#1c1915]/[0.06] bg-[#f3eee4] px-4 py-5 lg:block">
          <Skeleton className="h-7 w-36" />
          <div className="mt-8 space-y-2">
            <Skeleton className="h-11 w-full rounded-[12px]" />
            <Skeleton className="h-11 w-full rounded-[12px]" />
            <Skeleton className="h-11 w-full rounded-[12px]" />
          </div>
        </div>
        <div className="min-w-0 flex-1 px-5 py-6 sm:px-7 sm:py-8">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-6 h-56 w-full max-w-3xl rounded-[22px]" />
          <Skeleton className="mt-4 h-24 w-full max-w-3xl rounded-[18px]" />
        </div>
      </div>
    </div>
  );
}
