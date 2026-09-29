// src/components/shared/LoadingSkeleton.tsx
import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 8, columns = 5 }: TableSkeletonProps) {
  return (
    <div className="bg-white border border-[#e4e7ec] rounded-lg overflow-hidden">
      <div className="flex gap-4 bg-[#f9fafb] px-4 py-3 border-b border-[#e4e7ec]">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1 bg-[#e5e7eb]" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex gap-4 px-4 py-3.5 border-b border-[#e4e7ec] last:border-b-0"
        >
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1 bg-[#f3f4f6]" />
          ))}
        </div>
      ))}
    </div>
  );
}

interface CardSkeletonProps {
  count?: number;
}

export function CardSkeleton({ count = 4 }: CardSkeletonProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white border border-[#e4e7ec] rounded-lg p-4 space-y-3"
        >
          <Skeleton className="h-3 w-24 bg-[#e5e7eb]" />
          <Skeleton className="h-7 w-32 bg-[#f3f4f6]" />
          <Skeleton className="h-3 w-20 bg-[#f3f4f6]" />
        </div>
      ))}
    </div>
  );
}

interface FormSkeletonProps {
  fields?: number;
}

export function FormSkeleton({ fields = 6 }: FormSkeletonProps) {
  return (
    <div className="bg-white border border-[#e4e7ec] rounded-lg p-4 space-y-5">
      <Skeleton className="h-4 w-40 bg-[#e5e7eb]" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24 bg-[#e5e7eb]" />
            <Skeleton className="h-9 w-full rounded-[7px] bg-[#f3f4f6]" />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Skeleton className="h-9 w-24 rounded-[7px] bg-[#f3f4f6]" />
        <Skeleton className="h-9 w-28 rounded-[7px] bg-[#dbeafe]" />
      </div>
    </div>
  );
}