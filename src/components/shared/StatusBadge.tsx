// src/components/shared/StatusBadge.tsx
// Supports: paid | partial | unpaid only. "credit" is never a valid status.
import { cn } from "@/lib/utils";
import { getStatusColor } from "@/lib/utils";

interface StatusBadgeProps {
  status: "paid" | "partial" | "unpaid";
  className?: string;
}

const STATUS_LABELS: Record<string, string> = {
  paid:    "Paid",
  partial: "Partial",
  unpaid:  "Unpaid",
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const { bg, text, border } = getStatusColor(status);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        className
      )}
      style={{ backgroundColor: bg, color: text, borderColor: border }}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}