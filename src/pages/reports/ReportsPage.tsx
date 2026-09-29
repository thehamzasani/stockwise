// src/pages/reports/ReportsPage.tsx
// Tabs: P&L | Stock | Products | Receivables | Sales by City
// Page title/action come from AppLayout (App.tsx), so no PageHeader here.
// Loading/error handling is local for now; Task 16 swaps it for PageWrapper.

import { useState } from "react";
import {
  endOfMonth, format, startOfMonth, startOfYear, subDays, subMonths,
} from "date-fns";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useAppStore } from "@/stores/appStore";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  usePayablesReport, useProfitLoss, useReceivablesReport, useSalesByCity,
  useSlowProducts, useStockValuation, useTopProducts,
} from "@/hooks/useReports";
import type { AgingBucket } from "@/hooks/useReports";

// ─── SMALL SHARED PIECES ─────────────────────────────────────────────────────

const TH = "h-9 bg-[#f9fafb] text-xs font-semibold uppercase text-[#6b7280]";
const CARD = "rounded-lg border border-[#e4e7ec] bg-white p-4";
const HEADING = "text-sm font-semibold uppercase tracking-wide text-[#111827]";

type Tone = "default" | "green" | "red" | "amber" | "blue";
const TONE_CLASS: Record<Tone, string> = {
  default: "text-[#111827]",
  green: "text-[#16a34a]",
  red: "text-[#dc2626]",
  amber: "text-[#d97706]",
  blue: "text-[#2563eb]",
};

function Stat({ label, value, tone = "default", hint }: {
  label: string; value: string; tone?: Tone; hint?: string;
}) {
  return (
    <div className={CARD}>
      <p className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold", TONE_CLASS[tone])}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[#6b7280]">{hint}</p>}
    </div>
  );
}

function StateView({ isLoading, error, onRetry }: {
  isLoading: boolean; error: string | null; onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-[#fecaca] bg-white p-6 text-center">
      <AlertCircle className="mx-auto mb-2 h-6 w-6 text-[#dc2626]" />
      <p className="text-sm font-medium text-[#111827]">Could not load this report</p>
      <p className="mt-1 text-xs text-[#6b7280] break-all">{error ?? "No data returned."}</p>
      <Button
        onClick={onRetry}
        className="mt-3 h-9 rounded-[7px] bg-[#2563eb] px-4 text-sm font-medium text-white hover:bg-[#1d4ed8]"
      >
        Retry
      </Button>
    </div>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="py-8 text-center text-sm text-[#6b7280]">{children}</p>;
}

function useMoney() {
  const currency = useAppStore((s) => s.settings?.currency ?? "Rs.");
  return (n: number) => formatCurrency(n, currency);
}

// ─── DATE RANGE BAR (Task 18 replaces this with the shared DateRangeFilter) ──

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

function RangeBar({ from, to, onChange }: {
  from: string; to: string; onChange: (from: string, to: string) => void;
}) {
  const now = new Date();
  const presets: { label: string; from: string; to: string }[] = [
    { label: "This Month", from: fmt(startOfMonth(now)), to: fmt(now) },
    {
      label: "Last Month",
      from: fmt(startOfMonth(subMonths(now, 1))),
      to: fmt(endOfMonth(subMonths(now, 1))),
    },
    { label: "Last 30 Days", from: fmt(subDays(now, 29)), to: fmt(now) },
    { label: "This Year", from: fmt(startOfYear(now)), to: fmt(now) },
  ];
  return (
    <div className={cn(CARD, "flex flex-wrap items-center gap-3")}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[#6b7280]">From</span>
        <Input type="date" value={from} onChange={(e) => onChange(e.target.value, to)} className="h-9 w-40" />
        <span className="text-xs font-medium text-[#6b7280]">To</span>
        <Input type="date" value={to} onChange={(e) => onChange(from, e.target.value)} className="h-9 w-40" />
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Button
            key={p.label}
            variant="outline"
            onClick={() => onChange(p.from, p.to)}
            className={cn(
              "h-9 rounded-[7px] border-[#2563eb] px-3 text-xs text-[#2563eb] hover:bg-[#eff6ff]",
              p.from === from && p.to === to && "bg-[#eff6ff] font-medium"
            )}
          >
            {p.label}
          </Button>
        ))}
      </div>
      {from > to && (
        <span className="text-xs font-medium text-[#dc2626]">"From" date must not be after "To" date.</span>
      )}
    </div>
  );
}

function Segmented<T extends number>({ value, options, onChange }: {
  value: T; options: T[]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cn(
            "h-8 rounded-[7px] border px-3 text-xs font-medium",
            o === value
              ? "border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]"
              : "border-[#e4e7ec] bg-white text-[#374151] hover:bg-[#f9fafb]"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

// ─── TAB: P&L ────────────────────────────────────────────────────────────────

function ProfitLossTab({ from, to }: { from: string; to: string }) {
  const money = useMoney();
  const expensesEnabled = useAppStore((s) => s.settings?.expensesEnabled ?? false);
  const q = useProfitLoss(from, to);

  if (q.isLoading || q.error || !q.data) {
    return <StateView isLoading={q.isLoading} error={q.error} onRetry={q.refetch} />;
  }
  const d = q.data;
  const grossTone: Tone = d.grossProfit >= 0 ? "green" : "red";
  const netTone: Tone = d.netProfit >= 0 ? "green" : "red";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total Sales" value={money(d.totalSales)} tone="blue" />
        <Stat label="Cost of Goods Sold" value={money(d.totalCOGS)} hint="Uses cost locked at time of sale" />
        <Stat label="Gross Profit" value={money(d.grossProfit)} tone={grossTone} />
        <Stat label="Gross Margin" value={`${d.grossMarginPct.toFixed(1)}%`} tone={grossTone} />
      </div>

      {expensesEnabled ? (
        <div className={CARD}>
          <h3 className={cn(HEADING, "mb-3")}>Net Profit</h3>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="text-sm text-[#374151]">Gross Profit</TableCell>
                <TableCell className={cn("text-right text-sm font-semibold", TONE_CLASS[grossTone])}>
                  {money(d.grossProfit)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-sm text-[#374151]">Less: Expenses</TableCell>
                <TableCell className="text-right text-sm font-semibold text-[#dc2626]">
                  {money(d.totalExpenses)}
                </TableCell>
              </TableRow>
              <TableRow className="bg-[#f9fafb]">
                <TableCell className="text-sm font-semibold text-[#111827]">Net Profit</TableCell>
                <TableCell className={cn("text-right text-base font-semibold", TONE_CLASS[netTone])}>
                  {money(d.netProfit)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563eb]" />
          <p className="text-sm text-[#1e40af]">
            Expense tracking is turned off, so only gross profit is shown. Enable it in
            Settings to see net profit.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── TAB: STOCK ──────────────────────────────────────────────────────────────

function StockTab() {
  const money = useMoney();
  const q = useStockValuation();

  if (q.isLoading || q.error || !q.data) {
    return <StateView isLoading={q.isLoading} error={q.error} onRetry={q.refetch} />;
  }
  const d = q.data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Sellable Stock Value" value={money(d.sellableValue)} tone="blue"
              hint={`${d.sellableUnits.toLocaleString()} units`} />
        <Stat label="Damaged Stock Value" value={money(d.damagedValue)} tone={d.damagedValue > 0 ? "red" : "default"}
              hint={`${d.damagedUnits.toLocaleString()} units (written off)`} />
        <Stat label="Total Value" value={money(d.totalValue)} />
        <Stat label="Categories" value={String(d.byCategory.length)} />
      </div>

      <div className={CARD}>
        <h3 className={cn(HEADING, "mb-3")}>Valuation by Category</h3>
        {d.byCategory.length === 0 ? (
          <Empty>No products yet.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={TH}>Category</TableHead>
                <TableHead className={cn(TH, "text-right")}>Products</TableHead>
                <TableHead className={cn(TH, "text-right")}>Sellable Units</TableHead>
                <TableHead className={cn(TH, "text-right")}>Sellable Value</TableHead>
                <TableHead className={cn(TH, "text-right")}>Damaged Units</TableHead>
                <TableHead className={cn(TH, "text-right")}>Damaged Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.byCategory.map((c) => (
                <TableRow key={c.category} className="hover:bg-[#f9fafb]">
                  <TableCell className="text-sm font-medium text-[#111827]">{c.category}</TableCell>
                  <TableCell className="text-right text-sm">{c.productCount}</TableCell>
                  <TableCell className="text-right text-sm">{c.sellableUnits.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{money(c.sellableValue)}</TableCell>
                  <TableCell className="text-right text-sm">{c.damagedUnits.toLocaleString()}</TableCell>
                  <TableCell className={cn("text-right text-sm", c.damagedValue > 0 && "text-[#dc2626]")}>
                    {money(c.damagedValue)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-[#f9fafb]">
                <TableCell className="text-sm font-semibold">Total</TableCell>
                <TableCell />
                <TableCell className="text-right text-sm font-semibold">{d.sellableUnits.toLocaleString()}</TableCell>
                <TableCell className="text-right text-sm font-semibold">{money(d.sellableValue)}</TableCell>
                <TableCell className="text-right text-sm font-semibold">{d.damagedUnits.toLocaleString()}</TableCell>
                <TableCell className="text-right text-sm font-semibold">{money(d.damagedValue)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

// ─── TAB: PRODUCTS (top + slow) ──────────────────────────────────────────────

function TopProductsCard({ from, to }: { from: string; to: string }) {
  const money = useMoney();
  const [limit, setLimit] = useState<10 | 20>(10);
  const q = useTopProducts(limit, from, to);

  return (
    <div className={CARD}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className={HEADING}>Top Products</h3>
        <Segmented<10 | 20> value={limit} options={[10, 20]} onChange={setLimit} />
      </div>
      {q.isLoading || q.error || !q.data ? (
        <StateView isLoading={q.isLoading} error={q.error} onRetry={q.refetch} />
      ) : q.data.length === 0 ? (
        <Empty>No sales in this period.</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={TH}>#</TableHead>
              <TableHead className={TH}>Product</TableHead>
              <TableHead className={cn(TH, "text-right")}>Qty Sold</TableHead>
              <TableHead className={cn(TH, "text-right")}>Revenue</TableHead>
              <TableHead className={cn(TH, "text-right")}>Profit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.map((p, i) => (
              <TableRow key={p.productId} className="hover:bg-[#f9fafb]">
                <TableCell className="text-sm text-[#6b7280]">{i + 1}</TableCell>
                <TableCell className="text-sm font-medium text-[#111827]">{p.productName}</TableCell>
                <TableCell className="text-right text-sm">{p.totalQuantity.toLocaleString()}</TableCell>
                <TableCell className="text-right text-sm">{money(p.totalRevenue)}</TableCell>
                <TableCell
                  className={cn("text-right text-sm font-semibold",
                    p.totalProfit >= 0 ? "text-[#16a34a]" : "text-[#dc2626]")}
                >
                  {money(p.totalProfit)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function SlowProductsCard() {
  const money = useMoney();
  const [days, setDays] = useState<30 | 60 | 90>(30);
  const q = useSlowProducts(days);

  return (
    <div className={CARD}>
      <div className="mb-1 flex items-center justify-between">
        <h3 className={HEADING}>Slow-Moving Stock</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6b7280]">No sales in last</span>
          <Segmented<30 | 60 | 90> value={days} options={[30, 60, 90]} onChange={setDays} />
          <span className="text-xs text-[#6b7280]">days</span>
        </div>
      </div>
      <p className="mb-4 text-xs text-[#6b7280]">
        Active products with stock on hand and no sales in this window. Not affected by the date range above.
      </p>
      {q.isLoading || q.error || !q.data ? (
        <StateView isLoading={q.isLoading} error={q.error} onRetry={q.refetch} />
      ) : q.data.length === 0 ? (
        <Empty>No slow-moving products. Everything in stock has sold recently.</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={TH}>Product</TableHead>
              <TableHead className={TH}>Category</TableHead>
              <TableHead className={cn(TH, "text-right")}>Stock</TableHead>
              <TableHead className={cn(TH, "text-right")}>Value Tied Up</TableHead>
              <TableHead className={TH}>Last Sold</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.map((p) => (
              <TableRow key={p.id} className="hover:bg-[#f9fafb]">
                <TableCell className="text-sm font-medium text-[#111827]">{p.name}</TableCell>
                <TableCell className="text-sm text-[#6b7280]">{p.category}</TableCell>
                <TableCell className="text-right text-sm">{p.stock.toLocaleString()}</TableCell>
                <TableCell className="text-right text-sm font-medium text-[#d97706]">{money(p.stockValue)}</TableCell>
                <TableCell className="text-sm text-[#374151]">
                  {p.lastSoldDate
                    ? `${formatDate(p.lastSoldDate)} (${p.daysSinceSold}d ago)`
                    : "Never sold"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function ProductsTab({ from, to }: { from: string; to: string }) {
  return (
    <div className="space-y-4">
      <TopProductsCard from={from} to={to} />
      <SlowProductsCard />
    </div>
  );
}

// ─── TAB: RECEIVABLES (+ PAYABLES) ───────────────────────────────────────────

const BUCKETS: { key: AgingBucket; label: string; tone: Tone }[] = [
  { key: "current", label: "Not Overdue", tone: "default" },
  { key: "1-30", label: "1–30 Days", tone: "amber" },
  { key: "31-60", label: "31–60 Days", tone: "amber" },
  { key: "61-90", label: "61–90 Days", tone: "red" },
  { key: "90+", label: "90+ Days", tone: "red" },
];

const BUCKET_BADGE: Record<AgingBucket, string> = {
  current: "bg-[#f3f4f6] text-[#6b7280]",
  "1-30": "bg-[#fef3c7] text-[#d97706]",
  "31-60": "bg-[#fef3c7] text-[#d97706]",
  "61-90": "bg-[#fee2e2] text-[#dc2626]",
  "90+": "bg-[#fee2e2] text-[#dc2626]",
};

function ReceivablesSection() {
  const money = useMoney();
  const q = useReceivablesReport();

  if (q.isLoading || q.error || !q.data) {
    return <StateView isLoading={q.isLoading} error={q.error} onRetry={q.refetch} />;
  }
  const d = q.data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Stat label="Total Receivable" value={money(d.totalOutstanding)} tone="blue" />
        {BUCKETS.map((b) => (
          <Stat
            key={b.key}
            label={b.label}
            value={money(d.buckets[b.key].amount)}
            tone={d.buckets[b.key].amount > 0 ? b.tone : "default"}
            hint={`${d.buckets[b.key].count} customer${d.buckets[b.key].count === 1 ? "" : "s"}`}
          />
        ))}
      </div>

      <div className={CARD}>
        <h3 className={cn(HEADING, "mb-1")}>Receivables (Customers Owe You)</h3>
        <p className="mb-4 text-xs text-[#6b7280]">
          Aged by each customer's oldest overdue invoice due date. Walk-in customers are excluded.
        </p>
        {d.rows.length === 0 ? (
          <Empty>No outstanding receivables.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={TH}>Customer</TableHead>
                <TableHead className={TH}>City</TableHead>
                <TableHead className={TH}>Phone</TableHead>
                <TableHead className={cn(TH, "text-right")}>Outstanding</TableHead>
                <TableHead className={cn(TH, "text-right")}>Overdue Invoices</TableHead>
                <TableHead className={TH}>Oldest Due</TableHead>
                <TableHead className={TH}>Aging</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.rows.map((r) => (
                <TableRow
                  key={r.customerId}
                  className={cn("hover:bg-[#f9fafb]", r.bucket !== "current" && "bg-[#fff7ed]")}
                >
                  <TableCell className="text-sm font-medium text-[#111827]">{r.shopName}</TableCell>
                  <TableCell className="text-sm text-[#6b7280]">{r.city ?? "—"}</TableCell>
                  <TableCell className="text-sm text-[#6b7280]">{r.phone ?? "—"}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{money(r.outstandingBalance)}</TableCell>
                  <TableCell className="text-right text-sm">{r.overdueInvoices}</TableCell>
                  <TableCell className="text-sm text-[#374151]">
                    {r.oldestDueDate ? formatDate(r.oldestDueDate) : "—"}
                  </TableCell>
                  <TableCell>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", BUCKET_BADGE[r.bucket])}>
                      {r.bucket === "current" ? "Not overdue" : `${r.daysOverdue}d overdue`}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-[#f9fafb]">
                <TableCell className="text-sm font-semibold">Total</TableCell>
                <TableCell colSpan={2} />
                <TableCell className="text-right text-sm font-semibold">{money(d.totalOutstanding)}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function PayablesSection() {
  const money = useMoney();
  const q = usePayablesReport();

  return (
    <div className={CARD}>
      <h3 className={cn(HEADING, "mb-1")}>Payables (You Owe Suppliers)</h3>
      <p className="mb-4 text-xs text-[#6b7280]">
        Unpaid and partially paid purchases, grouped by supplier.
      </p>
      {q.isLoading || q.error || !q.data ? (
        <StateView isLoading={q.isLoading} error={q.error} onRetry={q.refetch} />
      ) : q.data.rows.length === 0 ? (
        <Empty>No unpaid purchases.</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={TH}>Supplier</TableHead>
              <TableHead className={TH}>Phone</TableHead>
              <TableHead className={cn(TH, "text-right")}>Unpaid Purchases</TableHead>
              <TableHead className={TH}>Oldest Purchase</TableHead>
              <TableHead className={cn(TH, "text-right")}>Amount Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.rows.map((r) => (
              <TableRow key={r.supplierId ?? "none"} className="hover:bg-[#f9fafb]">
                <TableCell className="text-sm font-medium text-[#111827]">{r.supplierName}</TableCell>
                <TableCell className="text-sm text-[#6b7280]">{r.phone ?? "—"}</TableCell>
                <TableCell className="text-right text-sm">{r.unpaidCount}</TableCell>
                <TableCell className="text-sm text-[#374151]">{formatDate(r.oldestPurchaseDate)}</TableCell>
                <TableCell className="text-right text-sm font-semibold text-[#dc2626]">{money(r.amountDue)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-[#f9fafb]">
              <TableCell className="text-sm font-semibold">Total</TableCell>
              <TableCell colSpan={3} />
              <TableCell className="text-right text-sm font-semibold text-[#dc2626]">
                {money(q.data.totalDue)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function ReceivablesTab() {
  return (
    <div className="space-y-4">
      <ReceivablesSection />
      <PayablesSection />
    </div>
  );
}

// ─── TAB: SALES BY CITY ──────────────────────────────────────────────────────

function SalesByCityTab({ from, to }: { from: string; to: string }) {
  const money = useMoney();
  const q = useSalesByCity(from, to);

  if (q.isLoading || q.error || !q.data) {
    return <StateView isLoading={q.isLoading} error={q.error} onRetry={q.refetch} />;
  }
  const rows = q.data;
  if (rows.length === 0) {
    return (
      <div className={CARD}>
        <Empty>No sales to registered customers in this period. Walk-in sales are excluded.</Empty>
      </div>
    );
  }

  const totals = rows.reduce(
    (t, r) => ({
      invoices: t.invoices + r.invoiceCount,
      revenue: t.revenue + r.revenue,
      profit: t.profit + r.profit,
    }),
    { invoices: 0, revenue: 0, profit: 0 }
  );
  const chartData = rows.slice(0, 8).map((r) => ({
    city: r.city, revenue: r.revenue, profit: r.profit,
  }));

  return (
    <div className="space-y-4">
      <div className={CARD}>
        <h3 className={cn(HEADING, "mb-4")}>Revenue & Profit by City (Top 8)</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e7ec" />
            <XAxis dataKey="city" tick={{ fontSize: 12, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} />
            <Tooltip formatter={(value) => money(Number(value))} />
            <Bar dataKey="revenue" name="Revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
            <Bar dataKey="profit" name="Profit" fill="#16a34a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className={CARD}>
        <h3 className={cn(HEADING, "mb-1")}>Sales by City</h3>
        <p className="mb-4 text-xs text-[#6b7280]">Walk-in sales are excluded.</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={TH}>City</TableHead>
              <TableHead className={cn(TH, "text-right")}>Customers</TableHead>
              <TableHead className={cn(TH, "text-right")}>Invoices</TableHead>
              <TableHead className={cn(TH, "text-right")}>Revenue</TableHead>
              <TableHead className={cn(TH, "text-right")}>Profit</TableHead>
              <TableHead className={cn(TH, "text-right")}>Margin</TableHead>
              <TableHead className={cn(TH, "text-right")}>Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.city} className="hover:bg-[#f9fafb]">
                <TableCell className="text-sm font-medium text-[#111827]">{r.city}</TableCell>
                <TableCell className="text-right text-sm">{r.customerCount}</TableCell>
                <TableCell className="text-right text-sm">{r.invoiceCount}</TableCell>
                <TableCell className="text-right text-sm font-medium">{money(r.revenue)}</TableCell>
                <TableCell
                  className={cn("text-right text-sm font-semibold",
                    r.profit >= 0 ? "text-[#16a34a]" : "text-[#dc2626]")}
                >
                  {money(r.profit)}
                </TableCell>
                <TableCell className="text-right text-sm">{r.marginPct.toFixed(1)}%</TableCell>
                <TableCell className="text-right text-sm text-[#6b7280]">{r.sharePct.toFixed(1)}%</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-[#f9fafb]">
              <TableCell className="text-sm font-semibold">Total</TableCell>
              <TableCell />
              <TableCell className="text-right text-sm font-semibold">{totals.invoices}</TableCell>
              <TableCell className="text-right text-sm font-semibold">{money(totals.revenue)}</TableCell>
              <TableCell
                className={cn("text-right text-sm font-semibold",
                  totals.profit >= 0 ? "text-[#16a34a]" : "text-[#dc2626]")}
              >
                {money(totals.profit)}
              </TableCell>
              <TableCell colSpan={2} />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── PAGE ────────────────────────────────────────────────────────────────────

type ReportTab = "pl" | "stock" | "products" | "receivables" | "city";
const RANGE_TABS: ReportTab[] = ["pl", "products", "city"];

export function ReportsPage() {
  const now = new Date();
  const [tab, setTab] = useState<ReportTab>("pl");
  const [from, setFrom] = useState(fmt(startOfMonth(now)));
  const [to, setTo] = useState(fmt(now));

  return (
    <div className="space-y-4 bg-[#f0f2f5] p-5">
      <Tabs value={tab} onValueChange={(v) => setTab(v as ReportTab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="pl">P&L</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="receivables">Receivables</TabsTrigger>
          <TabsTrigger value="city">Sales by City</TabsTrigger>
        </TabsList>

        {RANGE_TABS.includes(tab) && (
          <div className="mb-4">
            <RangeBar from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
          </div>
        )}

        <TabsContent value="pl"><ProfitLossTab from={from} to={to} /></TabsContent>
        <TabsContent value="stock"><StockTab /></TabsContent>
        <TabsContent value="products"><ProductsTab from={from} to={to} /></TabsContent>
        <TabsContent value="receivables"><ReceivablesTab /></TabsContent>
        <TabsContent value="city"><SalesByCityTab from={from} to={to} /></TabsContent>
      </Tabs>
    </div>
  );
}

export default ReportsPage;