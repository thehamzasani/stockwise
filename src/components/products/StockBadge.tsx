// src/components/products/StockBadge.tsx
import { cn } from "@/lib/utils";

interface StockBadgeProps {
  stock: number;
  minStock: number;
  showCount?: boolean;
}

export function StockBadge({ stock, minStock, showCount = true }: StockBadgeProps) {
  const isOut     = stock === 0;
  const isLow     = stock > 0 && stock <= minStock;
  const isOk      = stock > minStock;

  const label = isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock";

  const classes = cn(
    "inline-flex items-center gap-1.5 rounded-full text-xs font-medium px-2 py-0.5",
    isOut && "bg-[#fee2e2] text-[#dc2626]",
    isLow && "bg-[#fef3c7] text-[#d97706]",
    isOk  && "bg-[#dcfce7] text-[#16a34a]"
  );

  return (
    <span className={classes}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isOut && "bg-[#dc2626]",
          isLow && "bg-[#d97706]",
          isOk  && "bg-[#16a34a]"
        )}
      />
      {showCount ? `${stock} — ${label}` : label}
    </span>
  );
}