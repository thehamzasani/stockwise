// src/components/shared/CurrencyDisplay.tsx
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";

interface CurrencyDisplayProps {
  amount: number;
  /** Override the symbol (defaults to settings.currency or "Rs.") */
  symbol?: string;
  /** If true, color the amount: green if positive, red if negative */
  colored?: boolean;
  /** If true, always show red for negative, green for zero/positive */
  profitMode?: boolean;
  className?: string;
  size?: "xs" | "sm" | "base" | "lg";
}

const SIZE_CLASS: Record<string, string> = {
  xs:   "text-xs",
  sm:   "text-sm",
  base: "text-base",
  lg:   "text-lg font-semibold",
};

export default function CurrencyDisplay({
  amount,
  symbol,
  colored = false,
  profitMode = false,
  className,
  size = "sm",
}: CurrencyDisplayProps) {
  const settings = useAppStore((s) => s.settings);
  const sym      = symbol ?? settings?.currency ?? "Rs.";

  let colorClass = "";
  if (colored || profitMode) {
    if (amount < 0) colorClass = "text-[#dc2626]";
    else if (amount === 0) colorClass = profitMode ? "text-[#6b7280]" : "";
    else colorClass = "text-[#16a34a]";
  }

  return (
    <span className={cn(SIZE_CLASS[size], colorClass, className)}>
      {formatCurrency(amount, sym)}
    </span>
  );
}