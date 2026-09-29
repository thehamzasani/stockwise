// src/components/settings/DataIntegritySection.tsx
import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReconciliation } from "@/hooks/useReconciliation";
import { getAuditDisplay, useRecentAuditLog } from "@/hooks/useAuditLog";
import { useNavigate } from "@/lib/navigation";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { BalanceMismatch, StockMismatch } from "@/types";

const CARD = "bg-white border border-[#e4e7ec] rounded-lg p-4";
const TH = "px-3 py-2 text-left text-xs font-semibold uppercase text-[#6b7280] bg-[#f9fafb]";
const TD = "px-3 py-2 text-sm text-[#374151]";
const BTN_PRIMARY =
  "bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[7px] h-9 px-4 text-sm font-medium";
const BTN_OUTLINE =
  "border border-[#2563eb] text-[#2563eb] hover:bg-[#eff6ff] rounded-[7px] h-9 px-4 text-sm font-medium bg-white";

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface BalanceTableProps {
  title: string;
  rows: BalanceMismatch[];
  fixingId: string | null;
  disabled: boolean;
  onFix: (id: string) => void;
}

function BalanceTable({ title, rows, fixingId, disabled, onFix }: BalanceTableProps) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-4">
      <h4 className="mb-2 text-sm font-semibold text-[#111827]">{title}</h4>
      <div className="overflow-x-auto rounded-lg border border-[#e4e7ec]">
        <table className="w-full">
          <thead>
            <tr>
              <th className={TH}>Name</th>
              <th className={`${TH} text-right`}>Cached</th>
              <th className={`${TH} text-right`}>Computed</th>
              <th className={`${TH} text-right`}>Difference</th>
              <th className={`${TH} text-right`}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.entityId} className="border-t border-[#e4e7ec] hover:bg-[#f9fafb]">
                <td className={TD}>{m.entityName}</td>
                <td className={`${TD} text-right`}>{formatCurrency(m.cachedBalance)}</td>
                <td className={`${TD} text-right`}>{formatCurrency(m.computedBalance)}</td>
                <td className={`${TD} text-right font-semibold text-[#dc2626]`}>
                  {formatCurrency(m.difference)}
                </td>
                <td className={`${TD} text-right`}>
                  <Button
                    size="sm"
                    className={BTN_PRIMARY}
                    disabled={disabled}
                    onClick={() => onFix(m.entityId)}
                  >
                    {fixingId === m.entityId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Fix"
                    )}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface StockTableProps {
  rows: StockMismatch[];
  fixingId: string | null;
  disabled: boolean;
  onFix: (id: string) => void;
}

function StockTable({ rows, fixingId, disabled, onFix }: StockTableProps) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-4">
      <h4 className="mb-2 text-sm font-semibold text-[#111827]">Stock levels</h4>
      <div className="overflow-x-auto rounded-lg border border-[#e4e7ec]">
        <table className="w-full">
          <thead>
            <tr>
              <th className={TH}>Product</th>
              <th className={`${TH} text-right`}>Cached</th>
              <th className={`${TH} text-right`}>Computed</th>
              <th className={`${TH} text-right`}>Difference</th>
              <th className={`${TH} text-right`}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.productId} className="border-t border-[#e4e7ec] hover:bg-[#f9fafb]">
                <td className={TD}>{m.productName}</td>
                <td className={`${TD} text-right`}>{m.systemStock}</td>
                <td className={`${TD} text-right`}>{m.computedStock}</td>
                <td className={`${TD} text-right font-semibold text-[#dc2626]`}>
                  {m.difference > 0 ? `+${m.difference}` : m.difference}
                </td>
                <td className={`${TD} text-right`}>
                  <Button
                    size="sm"
                    className={BTN_PRIMARY}
                    disabled={disabled}
                    onClick={() => onFix(m.productId)}
                  >
                    {fixingId === m.productId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Fix"
                    )}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DataIntegritySection() {
  const navigate = useNavigate();
  const rec = useReconciliation();
  const recent = useRecentAuditLog(10);
  const [confirmFixAll, setConfirmFixAll] = useState(false);

  const balanceCount = rec.customerMismatches.length + rec.supplierMismatches.length;
  const stockCount = rec.stockMismatches.length;
  const totalMismatches = balanceCount + stockCount;
  const busy = rec.isCheckingBalances || rec.isCheckingStock || rec.isFixingAll || rec.fixingId !== null;

  async function handleCheckBalances() {
    setConfirmFixAll(false);
    const n = await rec.runBalanceCheck();
    if (n === 0) toast.success("All balances match.");
    else toast.warning(`${n} balance mismatch${n === 1 ? "" : "es"} found.`);
  }

  async function handleCheckStock() {
    setConfirmFixAll(false);
    const n = await rec.runStockCheck();
    if (n === 0) toast.success("All stock levels match.");
    else toast.warning(`${n} stock mismatch${n === 1 ? "" : "es"} found.`);
  }

  async function runFix(fn: () => Promise<unknown>, okMessage: string) {
    try {
      await fn();
      toast.success(okMessage);
      recent.refetch();
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  async function handleFixAll() {
    setConfirmFixAll(false);
    try {
      let fixed = 0;
      if (balanceCount > 0) fixed += await rec.fixAllBalances();
      if (stockCount > 0) fixed += await rec.fixAllStock();
      toast.success(`Fixed ${fixed} record${fixed === 1 ? "" : "s"}.`);
      recent.refetch();
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  return (
    <div className={CARD}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[#111827]">
          Data Integrity
        </h3>
      </div>

      <p className="mb-4 text-sm text-[#6b7280]">
        Compares cached balances and stock counts against values recomputed from the
        underlying transactions. Fixing a mismatch updates the cached value and writes an
        audit log entry.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button className={BTN_OUTLINE} disabled={busy} onClick={() => void handleCheckBalances()}>
          {rec.isCheckingBalances && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Check Balances
        </Button>
        <Button className={BTN_OUTLINE} disabled={busy} onClick={() => void handleCheckStock()}>
          {rec.isCheckingStock && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Check Stock
        </Button>

        {totalMismatches > 0 && !confirmFixAll && (
          <Button className={BTN_PRIMARY} disabled={busy} onClick={() => setConfirmFixAll(true)}>
            Fix All ({totalMismatches})
          </Button>
        )}
        {totalMismatches > 0 && confirmFixAll && (
          <>
            <Button className={BTN_PRIMARY} disabled={busy} onClick={() => void handleFixAll()}>
              {rec.isFixingAll && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm: overwrite {totalMismatches} cached value{totalMismatches === 1 ? "" : "s"}
            </Button>
            <Button variant="ghost" className="h-9 text-sm" onClick={() => setConfirmFixAll(false)}>
              Cancel
            </Button>
          </>
        )}
      </div>

      {rec.error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3 text-sm text-[#dc2626]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{rec.error}</span>
        </div>
      )}

      {rec.balancesChecked && balanceCount === 0 && (
        <div className="mt-4 flex items-center gap-2 text-sm text-[#16a34a]">
          <CheckCircle2 className="h-4 w-4" /> Customer and supplier balances are all consistent.
        </div>
      )}
      {rec.stockChecked && stockCount === 0 && (
        <div className="mt-2 flex items-center gap-2 text-sm text-[#16a34a]">
          <CheckCircle2 className="h-4 w-4" /> Stock levels are all consistent.
        </div>
      )}

      <BalanceTable
        title="Customer balances"
        rows={rec.customerMismatches}
        fixingId={rec.fixingId}
        disabled={busy}
        onFix={(id) =>
          void runFix(() => rec.fixCustomer(id), "Customer balance fixed.")
        }
      />
      <BalanceTable
        title="Supplier balances"
        rows={rec.supplierMismatches}
        fixingId={rec.fixingId}
        disabled={busy}
        onFix={(id) =>
          void runFix(() => rec.fixSupplier(id), "Supplier balance fixed.")
        }
      />
      <StockTable
        rows={rec.stockMismatches}
        fixingId={rec.fixingId}
        disabled={busy}
        onFix={(id) => void runFix(() => rec.fixProduct(id), "Stock level fixed.")}
      />

      {/* Recent audit entries */}
      <div className="mt-6 border-t border-[#e4e7ec] pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-[#111827]">Recent activity</h4>
          <button
            type="button"
            className="text-sm font-medium text-[#2563eb] hover:underline"
            onClick={() => navigate("audit-log")}
          >
            View Full Audit Log
          </button>
        </div>

        {recent.isLoading && <p className="text-sm text-[#6b7280]">Loading…</p>}
        {recent.error && <p className="text-sm text-[#dc2626]">{recent.error}</p>}
        {!recent.isLoading && !recent.error && (recent.data?.length ?? 0) === 0 && (
          <p className="text-sm text-[#6b7280]">No audit entries yet.</p>
        )}

        <ul className="divide-y divide-[#e4e7ec]">
          {(recent.data ?? []).map((entry) => {
            const d = getAuditDisplay(entry);
            return (
              <li key={entry.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <span
                    className={
                      d.isRefund
                        ? "mr-2 rounded-full bg-[#fef3c7] px-2 py-0.5 text-xs font-medium text-[#d97706]"
                        : "mr-2 rounded-full bg-[#eff6ff] px-2 py-0.5 text-xs font-medium text-[#1e40af]"
                    }
                  >
                    {d.label}
                  </span>
                  <span className="text-sm text-[#374151]">{d.description}</span>
                </div>
                <span className="shrink-0 text-xs text-[#6b7280]">
                  {formatRelativeTime(entry.createdAt)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default DataIntegritySection;