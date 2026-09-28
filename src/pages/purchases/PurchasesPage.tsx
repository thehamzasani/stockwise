// src/pages/purchases/PurchasesPage.tsx
// import { useState, useCallback } from "react";
import { useState } from "react";
import { Plus, Eye, XCircle, DollarSign, ChevronLeft, ChevronRight } from "lucide-react";
import { usePurchases, cancelPurchase, recordPurchasePayment } from "@/hooks/usePurchases";
import { useNavigate } from "@/lib/navigation";
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/utils";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import type { PurchaseWithItems } from "@/types";
import { toast } from "sonner";

type TabFilter = "all" | "unpaid" | "partial" | "paid";

export default function PurchasesPage() {
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabFilter>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [cancelTarget, setCancelTarget] = useState<PurchaseWithItems | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [payTarget, setPayTarget] = useState<PurchaseWithItems | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payLoading, setPayLoading] = useState(false);

  const { data, totalCount, isLoading, error, refetch } = usePurchases({
    page,
    search,
    status: tab === "all" ? undefined : tab,
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  function handleTabChange(t: TabFilter) {
    setTab(t);
    setPage(1);
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      await cancelPurchase(cancelTarget.id, cancelReason);
      toast.success("Purchase cancelled.");
      setCancelTarget(null);
      setCancelReason("");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel purchase.");
    } finally {
      setCancelLoading(false);
    }
  }

  async function handlePaySubmit() {
    if (!payTarget || !payTarget.supplierId) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount."); return; }
    setPayLoading(true);
    try {
      await recordPurchasePayment({
        purchaseId: payTarget.id,
        supplierId: payTarget.supplierId,
        amount,
        paymentMethod: payMethod,
        paymentDate: new Date().toISOString().split("T")[0],
      });
      toast.success(`Payment of ${formatCurrency(amount)} recorded.`);
      setPayTarget(null);
      setPayAmount("");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setPayLoading(false);
    }
  }

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "unpaid", label: "Unpaid" },
    { key: "partial", label: "Partial" },
    { key: "paid", label: "Paid" },
  ];

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#111827]">Purchases</h1>
          <p className="text-sm text-[#6b7280]">Track stock purchases from suppliers</p>
        </div>
        <button
          onClick={() => navigate("purchases/new")}
          className="flex items-center gap-2 h-9 px-4 rounded-[7px] bg-[#2563eb] text-white
                     text-sm font-medium hover:bg-[#1d4ed8] transition-colors"
        >
          <Plus size={15} />
          New Purchase
        </button>
      </div>

      {/* Main card */}
      <div className="bg-white border border-[#e4e7ec] rounded-lg overflow-hidden">
        {/* Tabs + search */}
        <div className="flex items-center justify-between px-4 pt-3 border-b border-[#e4e7ec]">
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => handleTabChange(t.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${
                  tab === t.key
                    ? "text-[#2563eb] border-b-2 border-[#2563eb]"
                    : "text-[#6b7280] hover:text-[#374151]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="pb-2">
            <input
              type="text"
              placeholder="Search by invoice # or supplier…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="h-8 w-56 rounded-[7px] border border-[#e4e7ec] px-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
            />
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-8 text-center text-sm text-[#6b7280]">Loading purchases…</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-[#dc2626]">{error}</div>
        ) : data.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-3xl mb-2">📦</div>
            <p className="text-sm text-[#6b7280]">No purchases found</p>
            <button
              onClick={() => navigate("purchases/new")}
              className="mt-3 h-8 px-4 rounded-[7px] bg-[#2563eb] text-white text-xs font-medium hover:bg-[#1d4ed8]"
            >
              Record First Purchase
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f9fafb]">
                  {["Date", "Supplier", "Invoice #", "Items", "Total", "Paid", "Status", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-[#6b7280]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((purchase) => {
                  const statusColors: Record<string, string> = {
                    paid: "bg-[#dcfce7] text-[#16a34a]",
                    partial: "bg-[#fef3c7] text-[#d97706]",
                    unpaid: "bg-[#fee2e2] text-[#dc2626]",
                  };
                  return (
                    <tr
                      key={purchase.id}
                      className={`border-t border-[#f3f4f6] hover:bg-[#f9fafb] ${
                        purchase.isCancelled ? "opacity-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-sm text-[#374151]">
                        <div>{formatDate(purchase.purchaseDate)}</div>
                        <div className="text-xs text-[#9ca3af]">{formatRelativeTime(purchase.createdAt)}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#374151]">
                        {purchase.supplier?.name ?? (
                          <span className="text-[#9ca3af] italic">No supplier</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#374151]">
                        {purchase.invoiceNo || <span className="text-[#9ca3af]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#374151]">
                        {purchase.items.length} item{purchase.items.length !== 1 ? "s" : ""}
                        <div className="text-xs text-[#9ca3af]">
                          {purchase.items.reduce((s, i) => s + i.quantity, 0)} units
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-[#111827]">
                        {formatCurrency(purchase.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#16a34a] font-medium">
                        {formatCurrency(purchase.paidAmount)}
                      </td>
                      <td className="px-4 py-3">
                        {purchase.isCancelled ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#f3f4f6] text-[#6b7280]">
                            Cancelled
                          </span>
                        ) : (
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              statusColors[purchase.paymentStatus] ?? ""
                            }`}
                          >
                            {purchase.paymentStatus.charAt(0).toUpperCase() + purchase.paymentStatus.slice(1)}
                          </span>
                        )}
                      </td>
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1">
                          <button
                            title="View Details"
                            className="p-1.5 rounded hover:bg-[#eff6ff] text-[#6b7280] hover:text-[#2563eb] transition-colors"
                          >
                            <Eye size={14} />
                          </button>
                          {!purchase.isCancelled && purchase.paymentStatus !== "paid" && purchase.supplierId && (
                            <button
                              title="Record Payment"
                              onClick={() => {
                                setPayTarget(purchase);
                                setPayAmount(String((purchase.totalAmount - purchase.paidAmount).toFixed(2)));
                              }}
                              className="p-1.5 rounded hover:bg-[#dcfce7] text-[#6b7280] hover:text-[#16a34a] transition-colors"
                            >
                              <DollarSign size={14} />
                            </button>
                          )}
                          {!purchase.isCancelled && purchase.paymentStatus === "unpaid" && (
                            <button
                              title="Cancel Purchase"
                              onClick={() => setCancelTarget(purchase)}
                              className="p-1.5 rounded hover:bg-[#fee2e2] text-[#6b7280] hover:text-[#dc2626] transition-colors"
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalCount > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#e4e7ec]">
            <span className="text-xs text-[#6b7280]">
              Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded border border-[#e4e7ec] disabled:opacity-40 hover:bg-[#f9fafb]"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-[#374151]">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 rounded border border-[#e4e7ec] disabled:opacity-40 hover:bg-[#f9fafb]"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cancel Dialog */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-semibold text-[#111827] mb-2">Cancel Purchase?</h3>
            <p className="text-sm text-[#6b7280] mb-4">
              This will reverse all stock movements for this purchase.
              <strong className="text-[#111827]"> Stock will be decremented.</strong>
              WAC will not change.
            </p>
            <p className="text-sm text-[#374151] mb-1">
              Purchase: {cancelTarget.invoiceNo || cancelTarget.id}
            </p>
            <p className="text-sm text-[#374151] mb-4">
              Total: {formatCurrency(cancelTarget.totalAmount)}
            </p>
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#374151] mb-1">
                Reason for cancellation
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Optional reason…"
                className="w-full h-9 rounded-[7px] border border-[#e4e7ec] px-3 text-sm
                           focus:outline-none focus:ring-2 focus:ring-[#dc2626]"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setCancelTarget(null); setCancelReason(""); }}
                disabled={cancelLoading}
                className="flex-1 h-9 rounded-[7px] border border-[#e4e7ec] text-sm text-[#374151]
                           hover:bg-[#f9fafb] disabled:opacity-50"
              >
                Keep Purchase
              </button>
              <button
                onClick={() => void handleCancel()}
                disabled={cancelLoading}
                className="flex-1 h-9 rounded-[7px] bg-[#dc2626] text-white text-sm font-medium
                           hover:bg-[#b91c1c] disabled:opacity-50"
              >
                {cancelLoading ? "Cancelling…" : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Dialog */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-semibold text-[#111827] mb-2">Record Payment to Supplier</h3>
            <p className="text-sm text-[#6b7280] mb-1">Supplier: {payTarget.supplier?.name}</p>
            <p className="text-sm text-[#6b7280] mb-4">
              Remaining: {formatCurrency(payTarget.totalAmount - payTarget.paidAmount)}
            </p>
            <div className="mb-3">
              <label className="block text-xs font-medium text-[#374151] mb-1">Amount (Rs.)</label>
              <input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full h-9 rounded-[7px] border border-[#e4e7ec] px-3 text-sm
                           focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#374151] mb-1">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {["cash", "bank", "cheque"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayMethod(m)}
                    className={`h-8 rounded-[7px] text-xs font-medium border transition-colors ${
                      payMethod === m
                        ? "bg-[#2563eb] text-white border-[#2563eb]"
                        : "border-[#e4e7ec] text-[#374151] hover:border-[#2563eb]"
                    }`}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setPayTarget(null); setPayAmount(""); }}
                disabled={payLoading}
                className="flex-1 h-9 rounded-[7px] border border-[#e4e7ec] text-sm text-[#374151]
                           hover:bg-[#f9fafb] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handlePaySubmit()}
                disabled={payLoading}
                className="flex-1 h-9 rounded-[7px] bg-[#2563eb] text-white text-sm font-medium
                           hover:bg-[#1d4ed8] disabled:opacity-50"
              >
                {payLoading ? "Saving…" : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}