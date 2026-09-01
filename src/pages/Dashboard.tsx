// src/pages/Dashboard.tsx
import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  Package,
  Clock,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { KPICard } from "@/components/reports/KPICard";
import { SalesChart } from "@/components/reports/SalesChart";
import { LowStockAlert } from "@/components/reports/LowStockAlert";
import { useDashboardStats, useLowStockProducts, useRecentSales } from "@/hooks/useReports";
import { useAppStore } from "@/stores/appStore";
import { useNavigate } from "@/lib/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getSqlite } from "@/db";
import { WALKIN_CUSTOMER_ID } from "@/lib/constants";

// ─── Balance mismatch lightweight check ──────────────────────────────────────
async function checkMismatchCount(): Promise<number> {
  try {
    const sqlite = getSqlite();

    // Quick check: compare customer cached balances vs computed
    const customers = await sqlite.select<{
      id: string;
      outstanding_balance: number;
    }[]>(`
      SELECT id, outstanding_balance FROM customers
      WHERE id != ? AND is_active = 1
    `, [WALKIN_CUSTOMER_ID]);

    let count = 0;
    for (const c of customers) {
      const salesRes = await sqlite.select<{ total: number }[]>(`
        SELECT COALESCE(SUM(total_amount), 0) AS total
        FROM sales WHERE customer_id = ? AND is_cancelled = 0
      `, [c.id]);
      const paymentsRes = await sqlite.select<{ total: number }[]>(`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM payments WHERE type = 'customer' AND party_id = ? AND is_reversed = 0
      `, [c.id]);
      const creditRes = await sqlite.select<{ total: number }[]>(`
        SELECT COALESCE(SUM(sr.refund_amount), 0) AS total
        FROM sale_returns sr
        JOIN sales s ON s.id = sr.sale_id
        WHERE s.customer_id = ? AND sr.refund_method = 'credit_note'
      `, [c.id]);
      const openingRes = await sqlite.select<{ amount: number }[]>(`
        SELECT COALESCE(SUM(amount), 0) AS amount
        FROM opening_balances WHERE entity_type = 'customer' AND entity_id = ?
      `, [c.id]);

      const computed =
        (openingRes[0]?.amount ?? 0) +
        (salesRes[0]?.total ?? 0) -
        (paymentsRes[0]?.total ?? 0) -
        (creditRes[0]?.total ?? 0);
      if (Math.abs(computed - c.outstanding_balance) > 0.01) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

// ─── RecentSalesTable ─────────────────────────────────────────────────────────
interface RecentSaleRow {
  id: string;
  invoiceNo: string;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  saleDate: string;
}

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    paid:    { bg: "#dcfce7", text: "#16a34a", label: "Paid" },
    partial: { bg: "#fef3c7", text: "#d97706", label: "Partial" },
    unpaid:  { bg: "#fee2e2", text: "#dc2626", label: "Unpaid" },
  };
  const style = map[status] ?? { bg: "#f3f4f6", text: "#6b7280", label: status };
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  );
}

function RecentSalesTable({
  rows,
  isLoading,
}: {
  rows: RecentSaleRow[];
  isLoading: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div className="rounded-lg border border-[#e4e7ec] bg-white">
      <div className="flex items-center justify-between border-b border-[#e4e7ec] px-4 py-3">
        <h3 className="text-sm font-semibold text-[#111827]">Recent Sales</h3>
        <button
          onClick={() => navigate("sales")}
          className="flex items-center gap-1 text-xs text-[#2563eb] hover:underline"
        >
          View all <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      {isLoading ? (
        <div className="space-y-0 divide-y divide-[#e4e7ec]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-4 w-24 rounded bg-gray-100 animate-pulse" />
              <div className="h-4 flex-1 rounded bg-gray-100 animate-pulse" />
              <div className="h-4 w-16 rounded bg-gray-100 animate-pulse" />
              <div className="h-5 w-14 rounded-full bg-gray-100 animate-pulse" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <TrendingUp className="mb-2 h-8 w-8 text-[#d1d5db]" />
          <p className="text-sm text-[#6b7280]">No sales yet</p>
          <p className="mt-0.5 text-xs text-[#9ca3af]">Sales will appear here once created</p>
        </div>
      ) : (
        <div className="divide-y divide-[#e4e7ec]">
          {rows.map((row) => (
            <div
              key={row.id}
              onClick={() => navigate("sales", { id: row.id })}
              className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-[#f9fafb]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[#2563eb]">{row.invoiceNo}</span>
                  <span className="text-xs text-[#6b7280]">·</span>
                  <span className="truncate text-xs text-[#374151]">{row.customerName}</span>
                </div>
                <p className="mt-0.5 text-xs text-[#9ca3af]">{formatDate(row.saleDate)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-[#111827]">
                  {formatCurrency(row.totalAmount)}
                </p>
              </div>
              <PaymentBadge status={row.paymentStatus} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { settings } = useAppStore();
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: lowStock, isLoading: lowStockLoading } = useLowStockProducts();
  const { data: recentSales, isLoading: recentLoading } = useRecentSales(5);
  const [mismatchCount, setMismatchCount] = useState(0);

  // Lightweight mismatch check on mount
  useEffect(() => {
    checkMismatchCount().then(setMismatchCount).catch(() => setMismatchCount(0));
  }, []);

  const currency = settings?.currency ?? "Rs.";

  return (
    <div className="space-y-5 p-5">
      {/* Balance mismatch banner */}
      {mismatchCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-[#fde68a] bg-[#fefce8] px-4 py-3">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-[#d97706]" />
          <p className="flex-1 text-sm text-[#92400e]">
            <span className="font-semibold">
              {mismatchCount} balance mismatch{mismatchCount !== 1 ? "es" : ""} detected
            </span>{" "}
            — customer balances may be out of sync.
          </p>
          <button
            onClick={() => navigate("settings", { tab: "integrity" })}
            className="flex items-center gap-1 rounded-[7px] bg-[#d97706] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#b45309]"
          >
            Fix in Settings <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KPICard
          title="Today's Sales"
          value={statsLoading ? "—" : formatCurrency(stats?.todaySales ?? 0, currency)}
          icon={TrendingUp}
          iconColor="#2563eb"
          iconBg="#eff6ff"
          onClick={() => navigate("sales")}
        />
        <KPICard
          title="Today's Profit"
          value={
            statsLoading
              ? "—"
              : formatCurrency(stats?.todayProfit ?? 0, currency)
          }
          icon={stats?.todayProfit !== undefined && stats.todayProfit < 0 ? TrendingDown : TrendingUp}
          iconColor={stats?.todayProfit !== undefined && stats.todayProfit < 0 ? "#dc2626" : "#16a34a"}
          iconBg={stats?.todayProfit !== undefined && stats.todayProfit < 0 ? "#fee2e2" : "#dcfce7"}
        />
        {settings?.expensesEnabled && (
          <KPICard
            title="Net Profit"
            value="—"
            subtitle="Enable in Reports"
            icon={DollarSign}
            iconColor="#16a34a"
            iconBg="#dcfce7"
            onClick={() => navigate("reports")}
          />
        )}
        <KPICard
          title="Receivables"
          value={statsLoading ? "—" : formatCurrency(stats?.totalReceivables ?? 0, currency)}
          subtitle="Outstanding from customers"
          icon={DollarSign}
          iconColor="#d97706"
          iconBg="#fef3c7"
          onClick={() => navigate("reports")}
        />
        <KPICard
          title="Payables"
          value={statsLoading ? "—" : formatCurrency(stats?.totalPayables ?? 0, currency)}
          subtitle="Owed to suppliers"
          icon={DollarSign}
          iconColor="#dc2626"
          iconBg="#fee2e2"
          onClick={() => navigate("suppliers")}
        />
        <KPICard
          title="Stock Value"
          value={statsLoading ? "—" : formatCurrency(stats?.stockValue ?? 0, currency)}
          subtitle="Sellable inventory"
          icon={Package}
          iconColor="#6b7280"
          iconBg="#f3f4f6"
          onClick={() => navigate("inventory")}
        />
        <KPICard
          title="Overdue Invoices"
          value={statsLoading ? "—" : String(stats?.overdueCount ?? 0)}
          subtitle="Past due date"
          icon={Clock}
          iconColor={stats?.overdueCount ? "#dc2626" : "#16a34a"}
          iconBg={stats?.overdueCount ? "#fee2e2" : "#dcfce7"}
          onClick={() => navigate("sales")}
        />
        <KPICard
          title="Low Stock Items"
          value={statsLoading ? "—" : String(stats?.lowStockCount ?? 0)}
          subtitle="At or below minimum"
          icon={AlertCircle}
          iconColor={stats?.lowStockCount ? "#d97706" : "#16a34a"}
          iconBg={stats?.lowStockCount ? "#fef3c7" : "#dcfce7"}
          onClick={() => navigate("inventory")}
        />
      </div>

      {/* Sales Chart */}
      <SalesChart
        data={stats?.monthlySalesData ?? []}
        isLoading={statsLoading}
      />

      {/* Bottom row: Recent Sales + Low Stock */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentSalesTable rows={recentSales} isLoading={recentLoading} />
        </div>
        <div>
          <LowStockAlert products={lowStock} isLoading={lowStockLoading} />
        </div>
      </div>
    </div>
  );
}