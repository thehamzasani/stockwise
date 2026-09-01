// src/components/reports/SalesChart.tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface SalesChartProps {
  data: { date: string; sales: number; profit: number }[];
  isLoading?: boolean;
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-[#e4e7ec] bg-white p-3 shadow-md text-xs">
      <p className="mb-2 font-semibold text-[#111827]">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[#6b7280] capitalize">{entry.name}:</span>
          <span className="font-medium text-[#111827]">
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex h-full items-end gap-2 px-4 pb-6">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-gray-100 animate-pulse"
          style={{ height: `${Math.random() * 60 + 20}%` }}
        />
      ))}
    </div>
  );
}

export function SalesChart({ data, isLoading = false }: SalesChartProps) {
  const isEmpty = !isLoading && data.every((d) => d.sales === 0 && d.profit === 0);

  return (
    <div className="rounded-lg border border-[#e4e7ec] bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#111827]">Sales & Profit</h3>
          <p className="text-xs text-[#6b7280]">Last 30 days</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#2563eb]" />
            <span className="text-[#6b7280]">Sales</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#16a34a]" />
            <span className="text-[#6b7280]">Profit</span>
          </div>
        </div>
      </div>

      <div className="h-56">
        {isLoading ? (
          <ChartSkeleton />
        ) : isEmpty ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-[#9ca3af]">No sales data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              barCategoryGap="30%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => {
                  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                  return String(v);
                }}
                width={36}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="sales" name="Sales" fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={24} />
              <Bar dataKey="profit" name="Profit" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}