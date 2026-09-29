// src/components/shared/DateRangeFilter.tsx
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DateRange {
  from: string; // "yyyy-MM-dd" or "" (no lower bound)
  to: string;   // "yyyy-MM-dd" or "" (no upper bound)
}

export const EMPTY_RANGE: DateRange = { from: "", to: "" };

type Preset = "today" | "week" | "month" | "lastMonth";

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

export function getPresetRange(preset: Preset): DateRange {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: fmt(now), to: fmt(now) };
    case "week":
      return {
        from: fmt(startOfWeek(now, { weekStartsOn: 1 })),
        to: fmt(endOfWeek(now, { weekStartsOn: 1 })),
      };
    case "month":
      return { from: fmt(startOfMonth(now)), to: fmt(endOfMonth(now)) };
    case "lastMonth": {
      const prev = subMonths(now, 1);
      return { from: fmt(startOfMonth(prev)), to: fmt(endOfMonth(prev)) };
    }
  }
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today",     label: "Today" },
  { key: "week",      label: "This Week" },
  { key: "month",     label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
];

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export default function DateRangeFilter({ value, onChange }: Props) {
  const hasValue = value.from !== "" || value.to !== "";
  const inputCls =
    "h-9 rounded-[7px] border border-[#e4e7ec] bg-white px-2 text-sm text-[#111827] focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        aria-label="From date"
        value={value.from}
        max={value.to || undefined}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
        className={inputCls}
      />
      <span className="text-sm text-[#6b7280]">to</span>
      <input
        type="date"
        aria-label="To date"
        value={value.to}
        min={value.from || undefined}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        className={inputCls}
      />
      <div className="flex items-center gap-1">
        {PRESETS.map((p) => {
          const r = getPresetRange(p.key);
          const isActive = r.from === value.from && r.to === value.to;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onChange(r)}
              className={cn(
                "h-9 rounded-[7px] border px-3 text-xs font-medium",
                isActive
                  ? "border-[#2563eb] bg-[#eff6ff] text-[#2563eb]"
                  : "border-[#e4e7ec] bg-white text-[#374151] hover:bg-[#f9fafb]"
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {hasValue && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_RANGE)}
          className="flex h-9 items-center gap-1 rounded-[7px] px-2 text-xs font-medium text-[#6b7280] hover:text-[#dc2626]"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      )}
    </div>
  );
}