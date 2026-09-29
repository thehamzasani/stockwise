// src/components/shared/PageWrapper.tsx
import type { ReactNode } from "react";
import { ErrorMessage } from "@/components/shared/ErrorMessage";
import {
  TableSkeleton,
  CardSkeleton,
  FormSkeleton,
} from "@/components/shared/LoadingSkeleton";

export type PageSkeletonType = "table" | "cards" | "form" | "dashboard";

interface PageWrapperProps {
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  skeleton?: PageSkeletonType;
  children: ReactNode;
}

export function PageWrapper({
  isLoading,
  error,
  onRetry,
  skeleton = "table",
  children,
}: PageWrapperProps) {
  if (error) {
    return (
      <div className="bg-[#f0f2f5] p-5">
        <ErrorMessage message={error} onRetry={onRetry} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-[#f0f2f5] p-5 space-y-4">
        {skeleton === "table" && <TableSkeleton />}
        {skeleton === "cards" && <CardSkeleton />}
        {skeleton === "form" && <FormSkeleton />}
        {skeleton === "dashboard" && (
          <>
            <CardSkeleton count={4} />
            <TableSkeleton rows={5} columns={4} />
          </>
        )}
      </div>
    );
  }

  return <>{children}</>;
}