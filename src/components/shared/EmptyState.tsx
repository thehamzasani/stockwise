// src/components/shared/EmptyState.tsx
import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  message: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  title,
  message,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-14 text-center",
        className
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f0f2f5] text-[#9ca3af]">
        {icon ?? <Inbox size={22} />}
      </div>
      {title && (
        <p className="mb-1 text-sm font-semibold text-[#111827]">{title}</p>
      )}
      <p className="max-w-xs text-sm text-[#6b7280]">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}