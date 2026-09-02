// src/components/customers/CustomerLedger.tsx
import { useState } from "react";
import { ChevronDown, ChevronRight, XCircle } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { LedgerEntry, Sale } from "@/types";

interface CustomerLedgerProps {
  entries: LedgerEntry[];
  cancelledSales: Sale[];
  isLoading: boolean;
}

export function CustomerLedger({
  entries,
  cancelledSales,
  isLoading,
}: CustomerLedgerProps) {
  const [showCancelled, setShowCancelled] = useState(false);

  const finalBalance = entries.length > 0 ? entries[entries.length - 1].balance : 0;
  const totalDebits  = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredits = entries.reduce((s, e) => s + e.credit, 0);

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 rounded bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-[#6b7280]">
        No transactions recorded yet for this customer.
      </div>
    );
  }

  function entryTypeLabel(entry: LedgerEntry): string {
    switch (entry.type) {
      case "opening":       return "Opening Balance";
      case "sale":          return "Invoice";
      case "payment":       return "Payment";
      case "return_credit": return "Credit Note";
      case "return_cash":   return "Refund";
    }
  }

  function entryTypeBadge(entry: LedgerEntry): string {
    switch (entry.type) {
      case "opening":
        return "bg-[#eff6ff] text-[#1e40af]";
      case "sale":
        return "bg-[#fee2e2] text-[#dc2626]";
      case "payment":
        return "bg-[#dcfce7] text-[#16a34a]";
      case "return_credit":
      case "return_cash":
        return "bg-[#fef3c7] text-[#d97706]";
    }
  }

  return (
    <div>
      {/* Ledger table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#f9fafb] border-b border-[#e4e7ec]">
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">
                Date
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">
                Type
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">
                Description
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">
                Debit (Rs.)
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">
                Credit (Rs.)
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">
                Balance (Rs.)
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => (
              <tr
                key={`${entry.type}-${entry.referenceId}-${idx}`}
                className="border-b border-[#e4e7ec] hover:bg-[#f9fafb]"
              >
                <td className="px-4 py-2.5 text-xs text-[#6b7280] whitespace-nowrap">
                  {formatDate(entry.date)}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${entryTypeBadge(entry)}`}
                  >
                    {entryTypeLabel(entry)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-sm text-[#374151]">
                  {entry.description}
                </td>
                <td className="px-4 py-2.5 text-right text-sm">
                  {entry.debit > 0 ? (
                    <span className="font-medium text-[#dc2626]">
                      {formatCurrency(entry.debit)}
                    </span>
                  ) : (
                    <span className="text-[#9ca3af]">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right text-sm">
                  {entry.credit > 0 ? (
                    <span className="font-medium text-[#16a34a]">
                      {formatCurrency(entry.credit)}
                    </span>
                  ) : (
                    <span className="text-[#9ca3af]">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right text-sm font-semibold">
                  <span
                    className={
                      entry.balance > 0
                        ? "text-[#dc2626]"
                        : entry.balance < 0
                        ? "text-[#16a34a]"
                        : "text-[#6b7280]"
                    }
                  >
                    {formatCurrency(entry.balance)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          {/* Totals footer */}
          <tfoot>
            <tr className="bg-[#f9fafb] border-t-2 border-[#e4e7ec]">
              <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-[#374151] uppercase">
                Totals
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-[#dc2626]">
                {formatCurrency(totalDebits)}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-[#16a34a]">
                {formatCurrency(totalCredits)}
              </td>
              <td className="px-4 py-3 text-right text-sm font-bold">
                <span className={finalBalance > 0 ? "text-[#dc2626]" : "text-[#16a34a]"}>
                  {formatCurrency(finalBalance)}
                </span>
                <p className="text-xs font-normal text-[#6b7280]">
                  {finalBalance > 0
                    ? "Outstanding"
                    : finalBalance < 0
                    ? "Overpaid"
                    : "Settled"}
                </p>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Cancelled transactions — audit section, does NOT affect running balance */}
      {cancelledSales.length > 0 && (
        <div className="mt-4 border-t border-[#e4e7ec] pt-4">
          <button
            onClick={() => setShowCancelled((v) => !v)}
            className="flex items-center gap-2 text-sm text-[#6b7280] hover:text-[#374151] select-none"
          >
            {showCancelled ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <XCircle className="h-3.5 w-3.5 text-[#9ca3af]" />
            Cancelled Transactions ({cancelledSales.length}) — audit only, not included in balance
          </button>

          {showCancelled && (
            <div className="mt-3 overflow-x-auto rounded-lg border border-[#e4e7ec]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f9fafb] border-b border-[#e4e7ec]">
                    <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#9ca3af]">
                      Date
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#9ca3af]">
                      Invoice
                    </th>
                    <th className="text-right px-4 py-2 text-xs font-semibold uppercase text-[#9ca3af]">
                      Amount
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-[#9ca3af]">
                      Cancel Reason
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cancelledSales.map((s) => (
                    <tr key={s.id} className="border-b border-[#e4e7ec] last:border-0">
                      <td className="px-4 py-2 text-xs text-[#9ca3af]">
                        {formatDate(s.saleDate)}
                      </td>
                      <td className="px-4 py-2 text-sm text-[#9ca3af] line-through">
                        {s.invoiceNo}
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-[#9ca3af] line-through">
                        {formatCurrency(s.totalAmount)}
                      </td>
                      <td className="px-4 py-2 text-xs text-[#9ca3af]">
                        {s.cancelReason ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}