// src/pages/customers/CustomerDetailPage.tsx
import { useState } from "react";
import { ArrowLeft, Edit, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useNavigate, useCurrentPage } from "@/lib/navigation";
import { useCustomer, useCustomerLedger } from "@/hooks/useCustomers";
import { CustomerLedger } from "@/components/customers/CustomerLedger";
import { formatCurrency, formatDate, isOverdue } from "@/lib/utils";
import { getSqlite } from "@/db";
import {  useEffect } from "react";

// Mini hook: recent sales for this customer
function useCustomerSales(customerId: string) {
  const [data, setData] = useState<{
    id: string; invoice_no: string; sale_date: string; due_date: string;
    total_amount: number; paid_amount: number; payment_status: string; is_cancelled: number;
  }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const sqlite = getSqlite();
        const rows = await sqlite.select<typeof data[number][]>(
          `SELECT id, invoice_no, sale_date, due_date, total_amount, paid_amount,
                  payment_status, is_cancelled
           FROM sales WHERE customer_id = ? ORDER BY sale_date DESC LIMIT 50`,
          [customerId]
        );
        if (!cancelled) setData(rows);
      } catch { /* ignore */ } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [customerId, tick]);

  return { data, isLoading, refetch: () => setTick((t) => t + 1) };
}

export default function CustomerDetailPage() {
  const navigate   = useNavigate();
  const { params } = useCurrentPage();
  const customerId = params.id ?? "";

  const { data: customer, isLoading: customerLoading, error, refetch: refetchCustomer }
    = useCustomer(customerId);
  const { entries, cancelledSales, isLoading: ledgerLoading }
    = useCustomerLedger(customerId);
  const { data: sales, isLoading: salesLoading }
    = useCustomerSales(customerId);

  if (customerLoading) {
    return (
      <div className="p-5 max-w-4xl">
        <div className="h-8 w-32 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="bg-white border border-[#e4e7ec] rounded-lg p-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-9 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-5 max-w-4xl">
        <Button
          variant="ghost"
          className="mb-4 h-8 px-2 text-sm text-[#374151] hover:bg-[#f0f2f5] flex items-center gap-1.5"
          onClick={() => navigate("customers")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="bg-white border border-[#fecaca] rounded-lg p-6 text-center">
          <p className="text-sm text-[#dc2626]">{error ?? "Customer not found."}</p>
          <Button variant="outline" className="mt-3 h-8 text-sm" onClick={refetchCustomer}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const overdueSales = sales.filter(
    (s) => !s.is_cancelled && s.payment_status !== "paid" && s.due_date < today
  );

  function creditLimitLabel() {
    if (customer!.creditLimit === null) return "Unlimited";
    if (customer!.creditLimit === 0)    return "Cash Only";
    return formatCurrency(customer!.creditLimit);
  }

  function statusBadge(status: string, isCancelled: number, dueDate: string) {
    if (isCancelled) {
      return (
        <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-[#f3f4f6] text-[#6b7280]">
          Cancelled
        </span>
      );
    }
    if (isOverdue(dueDate, status)) {
      return (
        <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-[#fee2e2] text-[#dc2626]">
          Overdue
        </span>
      );
    }
    const map: Record<string, string> = {
      paid:    "bg-[#dcfce7] text-[#16a34a]",
      partial: "bg-[#fef3c7] text-[#d97706]",
      unpaid:  "bg-[#fee2e2] text-[#dc2626]",
    };
    return (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? ""}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  return (
    <div className="p-5 max-w-5xl">
      {/* Back */}
      <Button
        variant="ghost"
        className="mb-4 h-8 px-2 text-sm text-[#374151] hover:bg-[#f0f2f5] flex items-center gap-1.5"
        onClick={() => navigate("customers")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Customers
      </Button>

      {/* Customer header card */}
      <div className="bg-white border border-[#e4e7ec] rounded-lg p-5 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eff6ff] text-[#2563eb] text-lg font-bold select-none">
              {customer.shopName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-[#111827]">{customer.shopName}</h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    customer.isActive
                      ? "bg-[#dcfce7] text-[#16a34a]"
                      : "bg-[#f3f4f6] text-[#6b7280]"
                  }`}
                >
                  {customer.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              {customer.ownerName && (
                <p className="text-sm text-[#6b7280]">{customer.ownerName}</p>
              )}
              <div className="flex items-center gap-4 mt-1 text-xs text-[#6b7280]">
                {customer.phone && <span>📞 {customer.phone}</span>}
                {customer.city && <span>📍 {customer.city}{customer.area ? `, ${customer.area}` : ""}</span>}
                <span>Member since {formatDate(customer.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs border-[#2563eb] text-[#2563eb] hover:bg-[#eff6ff] rounded-[7px]"
              onClick={() => navigate("sales/new", { customerId: customer.id })}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Sale
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs rounded-[7px]"
              onClick={() => navigate("customers/add", { id: customer.id })}
            >
              <Edit className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-4 gap-4 mt-5 pt-4 border-t border-[#e4e7ec]">
          <div>
            <p className="text-xs text-[#6b7280]">Outstanding Balance</p>
            <p
              className={`text-xl font-semibold ${
                customer.outstandingBalance > 0
                  ? "text-[#dc2626]"
                  : "text-[#16a34a]"
              }`}
            >
              {formatCurrency(customer.outstandingBalance)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">Credit Limit</p>
            <p className="text-xl font-semibold text-[#111827]">{creditLimitLabel()}</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">Payment Terms</p>
            <p className="text-xl font-semibold text-[#111827]">
              {customer.paymentTerms === 0 ? "Due on receipt" : `Net ${customer.paymentTerms} days`}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">Overdue Invoices</p>
            <p
              className={`text-xl font-semibold ${
                overdueSales.length > 0 ? "text-[#dc2626]" : "text-[#16a34a]"
              }`}
            >
              {overdueSales.length}
            </p>
          </div>
        </div>

        {/* Overdue warning */}
        {overdueSales.length > 0 && (
          <div className="mt-3 rounded-lg bg-[#fff7ed] border border-[#fed7aa] px-4 py-2.5 text-sm text-[#d97706]">
            ⚠ {overdueSales.length} invoice{overdueSales.length !== 1 ? "s are" : " is"} overdue.
            Oldest due: {formatDate(overdueSales[overdueSales.length - 1]?.due_date ?? "")}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ledger">
        <TabsList className="mb-4">
          <TabsTrigger value="ledger">Account Ledger</TabsTrigger>
          <TabsTrigger value="invoices">
            Invoices ({sales.filter((s) => !s.is_cancelled).length})
          </TabsTrigger>
          <TabsTrigger value="info">Details</TabsTrigger>
        </TabsList>

        {/* Ledger Tab */}
        <TabsContent value="ledger">
          <div className="bg-white border border-[#e4e7ec] rounded-lg">
            <div className="flex items-center justify-between p-4 border-b border-[#e4e7ec]">
              <div>
                <h2 className="text-sm font-semibold text-[#111827]">Account Statement</h2>
                <p className="text-xs text-[#6b7280] mt-0.5">
                  Running balance — cancelled sales are excluded
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs rounded-[7px]"
                onClick={() => {
                  // PDF wired in Task 12
                  console.log("Print statement — wired in Task 12");
                }}
              >
                <Printer className="h-3.5 w-3.5 mr-1" />
                Print Statement
              </Button>
            </div>
            <CustomerLedger
              entries={entries}
              cancelledSales={cancelledSales}
              isLoading={ledgerLoading}
            />
          </div>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <div className="bg-white border border-[#e4e7ec] rounded-lg">
            <div className="p-4 border-b border-[#e4e7ec]">
              <h2 className="text-sm font-semibold text-[#111827]">Invoice History</h2>
            </div>
            {salesLoading ? (
              <div className="p-8 text-center text-sm text-[#6b7280]">Loading…</div>
            ) : sales.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#6b7280]">No invoices yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f9fafb] border-b border-[#e4e7ec]">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">Invoice</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">Date</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">Due</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">Total</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">Paid</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">Status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr
                      key={s.id}
                      className={`border-b border-[#e4e7ec] hover:bg-[#f9fafb] ${
                        !s.is_cancelled && isOverdue(s.due_date, s.payment_status)
                          ? "bg-[#fff7ed]"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-2.5 font-medium text-[#2563eb]">
                        {s.invoice_no}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#6b7280]">
                        {formatDate(s.sale_date)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[#6b7280]">
                        {formatDate(s.due_date)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-[#111827]">
                        {formatCurrency(s.total_amount)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[#374151]">
                        {formatCurrency(s.paid_amount)}
                      </td>
                      <td className="px-4 py-2.5">
                        {statusBadge(s.payment_status, s.is_cancelled, s.due_date)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-[#2563eb] hover:bg-[#eff6ff]"
                          onClick={() => navigate("sales", { id: s.id })}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="info">
          <div className="bg-white border border-[#e4e7ec] rounded-lg p-5">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div>
                <p className="text-xs text-[#6b7280] mb-0.5">Business Type</p>
                <p className="text-[#111827] font-medium capitalize">
                  {customer.businessType ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#6b7280] mb-0.5">Discount Group</p>
                <p className="text-[#111827] font-medium capitalize">
                  {customer.discountGroup ?? "Standard"}
                  <span className="ml-1 text-xs font-normal text-[#9ca3af]">
                    (display only)
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-[#6b7280] mb-0.5">WhatsApp</p>
                <p className="text-[#111827]">{customer.whatsapp ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-[#6b7280] mb-0.5">CNIC</p>
                <p className="text-[#111827]">{customer.cnic ?? "—"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-[#6b7280] mb-0.5">Full Address</p>
                <p className="text-[#111827]">{customer.address ?? "—"}</p>
              </div>
              {customer.notes && (
                <div className="col-span-2">
                  <p className="text-xs text-[#6b7280] mb-0.5">Notes</p>
                  <p className="text-[#374151] whitespace-pre-wrap">{customer.notes}</p>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-[#e4e7ec]">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs rounded-[7px]"
                onClick={() => navigate("customers/add", { id: customer.id })}
              >
                <Edit className="h-3.5 w-3.5 mr-1" />
                Edit Customer Details
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}