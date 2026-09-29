// src/pages/payments/PaymentsPage.tsx
import { useEffect, useState } from "react";
import { Plus, Undo2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentForm, type PaymentFormDefaults } from "@/components/payments/PaymentForm";
import {
  getPaymentLabel,
  isReversalEntry,
  reversePayment,
  useOverdueInvoices,
  usePayments,
  type PaymentRow,
} from "@/hooks/usePayments";
import { useCurrentPage } from "@/lib/navigation";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils";

// ─── LOCAL HELPERS ───────────────────────────────────────────────────────────

function Pager({
  page,
  totalCount,
  onChange,
}: {
  page: number;
  totalCount: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
  return (
    <div className="flex items-center justify-between border-t border-[#e4e7ec] px-4 py-3">
      <span className="text-sm text-[#6b7280]">
        {totalCount} record{totalCount === 1 ? "" : "s"}
      </span>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          className="h-8 rounded-[7px] px-3 text-sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Prev
        </Button>
        <span className="text-sm text-[#374151]">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          className="h-8 rounded-[7px] px-3 text-sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function TableSkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, r) => (
        <TableRow key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <TableCell key={c}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="m-4 flex items-center justify-between rounded-lg border border-[#fecaca] bg-[#fef2f2] p-4">
      <p className="text-sm text-[#dc2626]">{message}</p>
      <Button variant="outline" className="h-8 rounded-[7px] text-sm" onClick={onRetry}>
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
        Retry
      </Button>
    </div>
  );
}

const HEAD_CLASS = "bg-[#f9fafb] text-xs font-semibold uppercase text-[#6b7280]";

// ─── PAGE ────────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const { params } = useCurrentPage();

  const [tab, setTab] = useState<"history" | "overdue">("history");
  const [typeFilter, setTypeFilter] = useState<"all" | "customer" | "supplier">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [overduePage, setOverduePage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [formDefaults, setFormDefaults] = useState<PaymentFormDefaults | undefined>(undefined);

  const [reverseTarget, setReverseTarget] = useState<PaymentRow | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reversing, setReversing] = useState(false);

  const history = usePayments({ type: typeFilter, search, page: historyPage });
  const overdue = useOverdueInvoices(overduePage);

  // Deep links: customerId param opens the form pre-filled; tab param selects a tab.
  useEffect(() => {
    if (params.customerId) {
      setFormDefaults({ partyType: "customer", partyId: params.customerId });
      setFormOpen(true);
    }
    if (params.tab === "overdue") setTab("overdue");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setHistoryPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  function openForm(defaults?: PaymentFormDefaults) {
    setFormDefaults(defaults);
    setFormOpen(true);
  }

  function refetchAll() {
    history.refetch();
    overdue.refetch();
  }

  async function confirmReverse() {
    if (!reverseTarget) return;
    setReversing(true);
    try {
      await reversePayment(reverseTarget.id, reverseReason);
      toast.success("Payment reversed");
      setReverseTarget(null);
      setReverseReason("");
      refetchAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reverse payment");
    } finally {
      setReversing(false);
    }
  }

  const historyRows = history.data ?? [];
  const overdueRows = overdue.data ?? [];

  return (
    <div className="bg-[#f0f2f5] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#111827]">Payments</h2>
          <p className="text-sm text-[#6b7280]">
            Money received from customers, paid to suppliers, and overdue invoices.
          </p>
        </div>
        <Button
          onClick={() => openForm()}
          className="h-9 rounded-[7px] bg-[#2563eb] px-4 text-sm font-medium text-white hover:bg-[#1d4ed8]"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Record Payment
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "history" | "overdue")}>
        <TabsList className="mb-4">
          <TabsTrigger value="history">Payment History</TabsTrigger>
          <TabsTrigger value="overdue">
            Overdue Invoices
            {overdue.totalCount > 0 && (
              <span className="ml-2 rounded-full bg-[#fee2e2] px-2 py-0.5 text-xs font-medium text-[#dc2626]">
                {overdue.totalCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── PAYMENT HISTORY ─────────────────────────────────────────────── */}
        <TabsContent value="history">
          <div className="rounded-lg border border-[#e4e7ec] bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-[#e4e7ec] p-4">
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search party, invoice or cheque no…"
                className="h-9 w-72"
              />
              <Select
                value={typeFilter}
                onValueChange={(v) => {
                  setTypeFilter(v as "all" | "customer" | "supplier");
                  setHistoryPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All payments</SelectItem>
                  <SelectItem value="customer">Customers only</SelectItem>
                  <SelectItem value="supplier">Suppliers only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {history.error ? (
              <ErrorCard message={history.error} onRetry={history.refetch} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={HEAD_CLASS}>Date</TableHead>
                    <TableHead className={HEAD_CLASS}>Party</TableHead>
                    <TableHead className={HEAD_CLASS}>Description</TableHead>
                    <TableHead className={HEAD_CLASS}>Invoice</TableHead>
                    <TableHead className={`${HEAD_CLASS} text-right`}>Amount</TableHead>
                    <TableHead className={`${HEAD_CLASS} text-right`}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.isLoading ? (
                    <TableSkeletonRows cols={6} />
                  ) : historyRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-[#6b7280]">
                        No payments found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    historyRows.map((p) => {
                      const counter = isReversalEntry(p);
                      const incoming = p.type === "customer" && !p.isRefund && !counter;
                      const amountColor = p.isReversed
                        ? "text-[#9ca3af] line-through"
                        : incoming
                          ? "text-[#16a34a]"
                          : "text-[#dc2626]";
                      return (
                        <TableRow key={p.id} className="hover:bg-[#f9fafb]">
                          <TableCell className="text-sm text-[#374151]">
                            {formatDate(p.paymentDate)}
                          </TableCell>
                          <TableCell className="text-sm text-[#111827]">
                            <div className="font-medium">{p.partyName}</div>
                            <span
                              className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                p.type === "customer"
                                  ? "bg-[#eff6ff] text-[#2563eb]"
                                  : "bg-[#f3f4f6] text-[#6b7280]"
                              }`}
                            >
                              {p.type === "customer" ? "Customer" : "Supplier"}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-[#374151]">
                            <div>{getPaymentLabel(p)}</div>
                            {p.chequeNo && (
                              <div className="text-xs text-[#6b7280]">Cheque #{p.chequeNo}</div>
                            )}
                            {p.bankName && (
                              <div className="text-xs text-[#6b7280]">{p.bankName}</div>
                            )}
                            {p.isReversed && !counter && (
                              <span
                                className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{
                                  background: getStatusColor("unpaid").bg,
                                  color: getStatusColor("unpaid").text,
                                }}
                              >
                                Reversed
                              </span>
                            )}
                            {counter && p.notes && (
                              <div className="text-xs text-[#6b7280]">
                                {p.notes.includes(" — ")
                                  ? p.notes.slice(p.notes.indexOf(" — ") + 3)
                                  : ""}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-[#374151]">
                            {p.referenceNo ?? <span className="text-[#9ca3af]">—</span>}
                          </TableCell>
                          <TableCell className={`text-right text-sm font-semibold ${amountColor}`}>
                            {incoming ? "+ " : "− "}
                            {formatCurrency(p.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {!p.isReversed && (
                              <Button
                                variant="outline"
                                className="h-8 rounded-[7px] px-3 text-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReverseReason("");
                                  setReverseTarget(p);
                                }}
                              >
                                <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                                Reverse
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}

            {!history.error && (
              <Pager
                page={historyPage}
                totalCount={history.totalCount}
                onChange={setHistoryPage}
              />
            )}
          </div>
        </TabsContent>

        {/* ── OVERDUE INVOICES ────────────────────────────────────────────── */}
        <TabsContent value="overdue">
          <div className="rounded-lg border border-[#e4e7ec] bg-white">
            {overdue.error ? (
              <ErrorCard message={overdue.error} onRetry={overdue.refetch} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={HEAD_CLASS}>Invoice</TableHead>
                    <TableHead className={HEAD_CLASS}>Customer</TableHead>
                    <TableHead className={HEAD_CLASS}>Due Date</TableHead>
                    <TableHead className={HEAD_CLASS}>Overdue</TableHead>
                    <TableHead className={`${HEAD_CLASS} text-right`}>Total</TableHead>
                    <TableHead className={`${HEAD_CLASS} text-right`}>Paid</TableHead>
                    <TableHead className={`${HEAD_CLASS} text-right`}>Balance</TableHead>
                    <TableHead className={`${HEAD_CLASS} text-right`}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdue.isLoading ? (
                    <TableSkeletonRows cols={8} />
                  ) : overdueRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-[#6b7280]">
                        No overdue invoices. 🎉
                      </TableCell>
                    </TableRow>
                  ) : (
                    overdueRows.map((inv) => {
                      const c = getStatusColor(inv.paymentStatus);
                      return (
                        <TableRow key={inv.id} className="bg-[#fff7ed] hover:bg-[#ffedd5]">
                          <TableCell className="text-sm font-medium text-[#111827]">
                            {inv.invoiceNo}
                            <span
                              className="ml-2 rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{ background: c.bg, color: c.text }}
                            >
                              {inv.paymentStatus === "partial" ? "Partial" : "Unpaid"}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-[#374151]">
                            {inv.customerName}
                          </TableCell>
                          <TableCell className="text-sm text-[#374151]">
                            {formatDate(inv.dueDate)}
                          </TableCell>
                          <TableCell className="text-sm font-medium text-[#dc2626]">
                            {inv.daysOverdue} day{inv.daysOverdue === 1 ? "" : "s"}
                          </TableCell>
                          <TableCell className="text-right text-sm text-[#374151]">
                            {formatCurrency(inv.totalAmount)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-[#374151]">
                            {formatCurrency(inv.paidAmount)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold text-[#dc2626]">
                            {formatCurrency(inv.balance)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              className="h-8 rounded-[7px] border-[#2563eb] px-3 text-sm text-[#2563eb] hover:bg-[#eff6ff]"
                              onClick={(e) => {
                                e.stopPropagation();
                                openForm({
                                  partyType: "customer",
                                  partyId: inv.customerId,
                                  referenceId: inv.id,
                                });
                              }}
                            >
                              Record Payment
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}

            {!overdue.error && (
              <Pager
                page={overduePage}
                totalCount={overdue.totalCount}
                onChange={setOverduePage}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Record payment dialog */}
      <PaymentForm
        open={formOpen}
        onOpenChange={setFormOpen}
        defaults={formDefaults}
        onSaved={refetchAll}
      />

      {/* Reverse payment dialog */}
      <Dialog
        open={reverseTarget !== null}
        onOpenChange={(o) => {
          if (!o && !reversing) setReverseTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reverse this payment?</DialogTitle>
            <DialogDescription>
              The payment is never deleted. A counter-entry is added, the outstanding balance is
              restored
              {reverseTarget?.referenceNo ? ` and invoice ${reverseTarget.referenceNo} is re-opened` : ""}
              .
            </DialogDescription>
          </DialogHeader>
          {reverseTarget && (
            <div className="space-y-3">
              <div className="rounded-lg border border-[#e4e7ec] bg-[#f9fafb] p-3 text-sm text-[#374151]">
                <div className="font-medium text-[#111827]">{reverseTarget.partyName}</div>
                <div>{getPaymentLabel(reverseTarget)}</div>
                <div className="font-semibold">{formatCurrency(reverseTarget.amount)}</div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rv-reason">Reason (optional)</Label>
                <Textarea
                  id="rv-reason"
                  rows={2}
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  placeholder="e.g. Cheque bounced"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="h-9 rounded-[7px]"
              disabled={reversing}
              onClick={() => setReverseTarget(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={reversing}
              onClick={() => void confirmReverse()}
              className="h-9 rounded-[7px] bg-[#dc2626] px-4 text-sm font-medium text-white hover:bg-[#b91c1c]"
            >
              {reversing ? "Reversing…" : "Reverse Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}