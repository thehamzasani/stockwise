// src/components/reports/KPICard.tsx
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: {
    value: string;
    positive: boolean;
    label?: string;
  };
  onClick?: () => void;
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = "#2563eb",
  iconBg = "#eff6ff",
  trend,
  onClick,
  className,
}: KPICardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-lg border border-[#e4e7ec] bg-white p-4",
        onClick ? "cursor-pointer hover:border-[#bfdbfe] hover:shadow-sm transition-all" : "",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">{title}</p>
          <p className="mt-1.5 text-2xl font-bold text-[#111827] leading-none">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-[#6b7280]">{subtitle}</p>
          )}
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={cn(
                  "text-xs font-medium",
                  trend.positive ? "text-[#16a34a]" : "text-[#dc2626]"
                )}
              >
                {trend.positive ? "↑" : "↓"} {trend.value}
              </span>
              {trend.label && (
                <span className="text-xs text-[#9ca3af]">{trend.label}</span>
              )}
            </div>
          )}
        </div>
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ml-3"
          style={{ backgroundColor: iconBg }}
        >
          <Icon className="h-5 w-5" style={{ color: iconColor }} />
        </div>
      </div>
    </div>
  );
}