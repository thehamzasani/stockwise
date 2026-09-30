// src/pages/Dashboard.tsx
import { useCallback, useEffect, useState } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, Banknote, Boxes, ClipboardList, PackageX, Plus,
  TrendingUp, Wallet, Receipt, ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import { getSqlite } from "@/db";
import { useAppStore } from "@/stores/appStore";
import { useNavigate } from "@/lib/navigation";
import { WALKIN_CUSTOMER_ID } from "@/lib/constants";
import { recalculateCustomerBalance } from "@/lib/balanceRecalc";
import { cn, formatCurrency, formatDate, getStatusColor } from "@/lib/utils";
import { useDashboardStats, useLowStockProducts, useProfitLoss } from "@/hooks/useReports";

// ─── helpers ─────────────────────────────────────────────────────────────────
interface RecentSale {
  id: string;
  invoice_no: string;
  shop_name: string;
  total_amount: number;
  payment_status: string;
  sale_date: string;
}

// Mirrors checkCustomerBalances(): cached vs recomputed, tolerance Rs. 0.01.
async function countCustomerMismatches(): Promise<number> {
  const sqlite = getSqlite();
  const rows = await sqlite.select<{ id: string; outstanding_balance: number }[]>(
    "SELECT id, outstanding_balance FROM customers WHERE id != ?",
    [WALKIN_CUSTOMER_ID]
  );
  let mismatches = 0;
  for (const r of rows) {
    const computed = await recalculateCustomerBalance(r.id);
    if (Math.abs(computed - r.outstanding_balance) > 0.01) mismatches++;
  }
  return mismatches;
}

type Tone = "default" | "green" | "red" | "amber";
const TONE_TEXT: Record<Tone, string> = {
  default: "text-[#111827]",
  green: "text-[#16a34a]",
  red: "text-[#dc2626]",
  amber: "text-[#d97706]",
};

function StatCard(props: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: Tone;
  onClick?: () => void;
}) {
  const { label, value, sub, icon: Icon, tone = "default", onClick } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-[#e4e7ec] bg-white p-4 text-left transition-colors hover:border-[#bfdbfe] hover:bg-[#f9fafb]"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">{label}</span>
        <Icon className="h-4 w-4 text-[#9ca3af]" />
      </div>
      <div className={cn("text-xl font-semibold", TONE_TEXT[tone])}>{value}</div>
      {sub && <div className="mt-1 text-xs text-[#6b7280]">{sub}</div>}
    </button>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const settings = useAppStore((s) => s.settings);
  const currency = settings?.currency ?? "Rs.";
  const money = (n: number) => formatCurrency(n, currency);

  const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats();
  const { data: lowStock } = useLowStockProducts();

  // Net Profit = this month's P&L. Hook is always called (rules of hooks);
  // the card only renders when expenses are enabled.
  const now = new Date();
  const { data: pnl } = useProfitLoss(
    format(startOfMonth(now), "yyyy-MM-dd"),
    format(endOfMonth(now), "yyyy-MM-dd")
  );

  // Recent 5 non-cancelled sales
  const [recent, setRecent] = useState<RecentSale[]>([]);
  const loadRecent = useCallback(async () => {
    try {
      const rows = await getSqlite().select<RecentSale[]>(
        `SELECT s.id, s.invoice_no, c.shop_name, s.total_amount, s.payment_status, s.sale_date
           FROM sales s JOIN customers c ON c.id = s.customer_id
          WHERE s.is_cancelled = 0
          ORDER BY s.created_at DESC LIMIT 5`
      );
      setRecent(rows);
    } catch (err) {
      console.error("[Dashboard] Failed to load recent sales:", err);
    }
  }, []);
  useEffect(() => { void loadRecent(); }, [loadRecent]);

  // Balance mismatch banner — runs once on mount
  const [mismatches, setMismatches] = useState(0);
  useEffect(() => {
    let cancelled = false;
    countCustomerMismatches()
      .then((n) => { if (!cancelled) setMismatches(n); })
      .catch((err) => console.error("[Dashboard] Mismatch check failed:", err));
    return () => { cancelled = true; };
  }, []);

  if (statsError) {
    return (
      <div className="p-5">
        <div className="rounded-lg border border-[#fecaca] bg-white p-4 text-sm text-[#dc2626]">
          Failed to load dashboard: {statsError}
        </div>
      </div>
    );
  }

  if (statsLoading || !stats) {
    return (
      <div className="grid grid-cols-4 gap-4 p-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border border-[#e4e7ec] bg-white" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5 p-5">
      {mismatches > 0 && (
        <button
          type="button"
          onClick={() => navigate("settings", { tab: "integrity" })}
          className="flex w-full items-center gap-2 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-left text-sm font-medium text-[#92400e] hover:bg-[#fef3c7]"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-[#d97706]" />
          ⚠ {mismatches} balance mismatch{mismatches === 1 ? "" : "es"} detected → Settings → Data Integrity
        </button>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => navigate("sales/new")}
          className="inline-flex h-9 items-center gap-1.5 rounded-[7px] bg-[#2563eb] px-4 text-sm font-medium text-white hover:bg-[#1d4ed8]"
        >
          <Plus className="h-4 w-4" /> New Sale
        </button>
        <button
          type="button"
          onClick={() => navigate("purchases/new")}
          className="inline-flex h-9 items-center gap-1.5 rounded-[7px] border border-[#2563eb] px-4 text-sm font-medium text-[#2563eb] hover:bg-[#eff6ff]"
        >
          <ShoppingBag className="h-4 w-4" /> New Purchase
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Today's Sales" icon={Banknote}
          value={money(stats.todaySales)}
          onClick={() => navigate("sales")}
        />
        <StatCard
          label="Today's Profit" icon={TrendingUp}
          value={money(stats.todayProfit)}
          tone={stats.todayProfit >= 0 ? "green" : "red"}
          onClick={() => navigate("reports")}
        />
        <StatCard
          label="Receivables" icon={Wallet}
          value={money(stats.totalReceivables)}
          sub="Owed by customers"
          onClick={() => navigate("customers")}
        />
        <StatCard
          label="Payables" icon={ClipboardList}
          value={money(stats.totalPayables)}
          sub="Owed to suppliers"
          onClick={() => navigate("suppliers")}
        />
        <StatCard
          label="Stock Value" icon={Boxes}
          value={money(stats.stockValue)}
          sub="At weighted average cost"
          onClick={() => navigate("inventory")}
        />
        <StatCard
          label="Overdue Invoices" icon={Receipt}
          value={String(stats.overdueCount)}
          tone={stats.overdueCount > 0 ? "red" : "default"}
          onClick={() => navigate("sales", { tab: "overdue" })}
        />
        <StatCard
          label="Low Stock Items" icon={PackageX}
          value={String(stats.lowStockCount)}
          tone={stats.lowStockCount > 0 ? "amber" : "default"}
          onClick={() => navigate("inventory")}
        />
        {settings?.expensesEnabled && (
          <StatCard
            label="Net Profit (This Month)" icon={TrendingUp}
            value={money(pnl?.netProfit ?? 0)}
            tone={(pnl?.netProfit ?? 0) >= 0 ? "green" : "red"}
            onClick={() => navigate("reports")}
          />
        )}
      </div>

      <div className="rounded-lg border border-[#e4e7ec] bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#111827]">
            Sales & Profit — Last 30 Days
          </h2>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.monthlySalesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e7ec" />
              <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => money(Number(v))} />
              <Legend />
              <Bar dataKey="sales" name="Sales" fill="#2563eb" radius={[3, 3, 0, 0]} />
              <Bar dataKey="profit" name="Profit" fill="#16a34a" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-[#e4e7ec] bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#111827]">Recent Sales</h2>
            <button type="button" onClick={() => navigate("sales")} className="text-xs font-medium text-[#2563eb] hover:underline">
              View all
            </button>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-[#6b7280]">No sales yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f9fafb] text-left text-xs font-semibold uppercase text-[#6b7280]">
                  <th className="px-2 py-2">Invoice</th>
                  <th className="px-2 py-2">Customer</th>
                  <th className="px-2 py-2 text-right">Total</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => {
                  const c = getStatusColor(s.payment_status);
                  return (
                    <tr
                      key={s.id}
                      onClick={() => navigate("sales")}
                      className="cursor-pointer border-t border-[#e4e7ec] hover:bg-[#f9fafb]"
                    >
                      <td className="px-2 py-2">
                        <div className="font-medium text-[#111827]">{s.invoice_no}</div>
                        <div className="text-xs text-[#6b7280]">{formatDate(s.sale_date)}</div>
                      </td>
                      <td className="px-2 py-2 text-[#374151]">{s.shop_name}</td>
                      <td className="px-2 py-2 text-right font-medium text-[#111827]">{money(s.total_amount)}</td>
                      <td className="px-2 py-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
                          style={{ background: c.bg, color: c.text }}
                        >
                          {s.payment_status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-lg border border-[#e4e7ec] bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#111827]">Low Stock</h2>
            <button type="button" onClick={() => navigate("inventory")} className="text-xs font-medium text-[#2563eb] hover:underline">
              View inventory
            </button>
          </div>
          {!lowStock || lowStock.length === 0 ? (
            <p className="text-sm text-[#6b7280]">All products are sufficiently stocked.</p>
          ) : (
            <ul className="divide-y divide-[#e4e7ec]">
              {lowStock.map((p) => (
                <li
                  key={p.id}
                  onClick={() => navigate("inventory/edit", { id: p.id })}
                  className="flex cursor-pointer items-center justify-between py-2 hover:bg-[#f9fafb]"
                >
                  <div>
                    <div className="text-sm font-medium text-[#111827]">{p.name}</div>
                    <div className="text-xs text-[#6b7280]">Minimum: {p.minStock} {p.unit}</div>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      p.stock === 0 ? "bg-[#fee2e2] text-[#dc2626]" : "bg-[#fef3c7] text-[#d97706]"
                    )}
                  >
                    {p.stock} {p.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}