// src/pages/sales/SalesPage.tsx
import { useState } from "react";
import { Plus, Printer, XCircle } from "lucide-react";
import { printInvoiceById } from "@/hooks/usePDF";
import { useSales, cancelSale } from "@/hooks/useSales";
import { useNavigate } from "@/lib/navigation";
import { useAppStore } from "@/stores/appStore";
import { DataTable } from "@/components/shared/DataTable";
import  StatusBadge  from "@/components/shared/StatusBadge";
import { formatCurrency, formatDate, isOverdue, daysOverdue } from "@/lib/utils";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { toast } from "sonner";
import type { Sale } from "@/types";

type SaleTab = "all" | "unpaid" | "partial" | "paid" | "overdue";

const TABS: { key: SaleTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unpaid", label: "Unpaid" },
  { key: "partial", label: "Partial" },
  { key: "paid", label: "Paid" },
  { key: "overdue", label: "Overdue" },
];

export function SalesPage() {
  const navigate = useNavigate();
  const { settings } = useAppStore();
  const currency = settings?.currency ?? "Rs.";

  const [tab, setTab] = useState<SaleTab>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const { data, totalCount, isLoading, error, refetch } = useSales({
    page,
    search,
    status: tab,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  function handleTabChange(t: SaleTab) {
    setTab(t);
    setPage(1);
  }

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }

  async function handleConfirmCancel() {
    if (!cancelTarget || !cancelReason.trim()) {
      toast.error("Please enter a cancellation reason.");
      return;
    }
    setCancelling(true);
    try {
      await cancelSale(cancelTarget.id, cancelReason.trim());
      toast.success(`Sale ${cancelTarget.invoiceNo} cancelled.`);
      setCancelTarget(null);
      setCancelReason("");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel sale.");
    } finally {
      setCancelling(false);
    }
  }

  const columns = [
    {
      key: "invoiceNo",
      header: "Invoice",
      render: (row: Sale) => (
        <span className="font-medium text-[#2563eb]">{row.invoiceNo}</span>
      ),
    },
    {
      key: "saleDate",
      header: "Date",
      render: (row: Sale) => (
        <span className="text-sm text-[#374151]">{formatDate(row.saleDate)}</span>
      ),
    },
    {
      key: "dueDate",
      header: "Due",
      render: (row: Sale) => {
        const overdue = isOverdue(row.dueDate, row.paymentStatus, row.isCancelled);
        return (
          <div>
            <span className={`text-sm ${overdue ? "text-[#dc2626] font-medium" : "text-[#374151]"}`}>
              {formatDate(row.dueDate)}
            </span>
            {overdue && (
              <div className="text-xs text-[#dc2626]">{daysOverdue(row.dueDate)}d overdue</div>
            )}
          </div>
        );
      },
    },
    {
      key: "totalAmount",
      header: "Total",
      render: (row: Sale) => (
        <span className="text-sm font-semibold text-[#111827]">
          {formatCurrency(row.totalAmount, currency)}
        </span>
      ),
    },
    {
      key: "paidAmount",
      header: "Paid",
      render: (row: Sale) => (
        <span className="text-sm text-[#16a34a]">
          {formatCurrency(row.paidAmount, currency)}
        </span>
      ),
    },
    {
      key: "paymentStatus",
      header: "Status",
      render: (row: Sale) =>
        row.isCancelled ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#f3f4f6] text-[#6b7280]">
            Cancelled
          </span>
        ) : (
          <StatusBadge status={row.paymentStatus as "paid" | "partial" | "unpaid"} />
        ),
    },
    {
      key: "actions",
      header: "",
      render: (row: Sale) => (
        <div
          className="flex items-center gap-1 justify-end"
          onClick={(e) => e.stopPropagation()}
        >
          <button
  onClick={() => void printInvoiceById(row.id)}
  className="p-1.5 rounded-[7px] text-[#6b7280] hover:text-[#2563eb] hover:bg-[#eff6ff] transition-colors"
  title="View / Print invoice"
>
  <Printer size={14} />
</button>
          {!row.isCancelled && row.paymentStatus === "unpaid" && (
            <button
              onClick={() => { setCancelTarget(row); setCancelReason(""); }}
              className="p-1.5 rounded-[7px] text-[#6b7280] hover:text-[#dc2626] hover:bg-[#fee2e2] transition-colors"
              title="Cancel sale"
            >
              <XCircle size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-[#111827]">Sales</h1>
          <p className="text-sm text-[#6b7280]">All invoices and transactions</p>
        </div>
        <button
          onClick={() => navigate("sales/new")}
          className="flex items-center gap-2 h-9 px-4 rounded-[7px] bg-[#2563eb] hover:bg-[#1d4ed8]
                     text-white text-sm font-medium transition-colors"
        >
          <Plus size={14} />
          New Sale
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#e4e7ec]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? "border-[#2563eb] text-[#2563eb]"
                : "border-transparent text-[#6b7280] hover:text-[#374151]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date filters — inline until DateRangeFilter is built in Task 18 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#6b7280]">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-8 rounded-[7px] border border-[#e4e7ec] px-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#6b7280]">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="h-8 rounded-[7px] border border-[#e4e7ec] px-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}
            className="text-xs text-[#6b7280] hover:text-[#dc2626]"
          >
            Clear
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-[#fecaca] bg-[#fee2e2] px-4 py-3 text-sm text-[#dc2626]">
          {error}
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        emptyMessage={tab === "overdue" ? "No overdue invoices." : "No sales found."}
        searchValue={search}
        onSearchChange={handleSearch}
        pagination={{
          page,
          totalPages,
          totalCount,
          onPageChange: setPage,
        }}
        onRowClick={(row) => void printInvoiceById(row.id)}
        rowClassName={(row: Sale) =>
          isOverdue(row.dueDate, row.paymentStatus, row.isCancelled)
            ? "bg-[#fff7ed]"
            : ""
        }
      />

      {/* Cancel dialog */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg border border-[#e4e7ec] shadow-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-base font-semibold text-[#111827] mb-1">Cancel Sale</h2>
            <p className="text-sm text-[#6b7280] mb-4">
              Cancel invoice{" "}
              <span className="font-medium text-[#111827]">{cancelTarget.invoiceNo}</span>?
              Stock will be restored. This cannot be undone.
            </p>
            <label className="text-xs font-medium text-[#374151] mb-1 block">Reason *</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder="Enter cancellation reason…"
              className="w-full rounded-[7px] border border-[#e4e7ec] px-3 py-2 text-sm resize-none
                         focus:outline-none focus:ring-2 focus:ring-[#dc2626] focus:border-transparent mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setCancelTarget(null)}
                className="h-9 px-4 rounded-[7px] border border-[#e4e7ec] text-sm text-[#374151]
                           hover:bg-[#f9fafb] transition-colors"
              >
                Keep Sale
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={cancelling || !cancelReason.trim()}
                className="h-9 px-4 rounded-[7px] bg-[#dc2626] hover:bg-[#b91c1c] text-white
                           text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {cancelling ? "Cancelling…" : "Cancel Sale"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}