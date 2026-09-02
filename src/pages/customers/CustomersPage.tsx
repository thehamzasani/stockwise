// src/pages/customers/CustomersPage.tsx
import { useState } from "react";
import { Plus, Users,  TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@/lib/navigation";
import { useCustomers, useCustomerCities, deactivateCustomer } from "@/hooks/useCustomers";
import { DataTable } from "@/components/shared/DataTable";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { formatCurrency } from "@/lib/utils";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { toast } from "sonner";
import type { Customer } from "@/types";
import type { ColumnDef } from "@/components/shared/DataTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CustomersPage() {
  const navigate = useNavigate();

  const [search, setSearch]             = useState("");
  const [cityFilter, setCityFilter]     = useState("");
  const [page, setPage]                 = useState(1);
  const [deactivateTarget, setDeactivateTarget] = useState<Customer | null>(null);
  const [isDeactivating, setIsDeactivating]     = useState(false);

  const { data: customers, totalCount, isLoading, error, refetch } = useCustomers({
    search,
    city: cityFilter,
    page,
  });
  const cities = useCustomerCities();

  const totalReceivables = customers.reduce(
    (sum, c) => sum + (c.outstandingBalance > 0 ? c.outstandingBalance : 0),
    0
  );

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    setIsDeactivating(true);
    try {
      await deactivateCustomer(deactivateTarget.id);
      toast.success(`${deactivateTarget.shopName} deactivated.`);
      setDeactivateTarget(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deactivate customer.");
    } finally {
      setIsDeactivating(false);
    }
  }

  const columns: ColumnDef<Customer>[] = [
    {
      key: "shopName",
      header: "Customer",
      render: (c) => (
        <div>
          <p className="font-medium text-[#111827] text-sm">{c.shopName}</p>
          <p className="text-xs text-[#6b7280]">
            {c.ownerName ?? ""}
            {c.ownerName && c.city ? " · " : ""}
            {c.city ?? ""}
          </p>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (c) => (
        <span className="text-sm text-[#374151]">
          {c.phone ?? <span className="text-[#9ca3af]">—</span>}
        </span>
      ),
    },
    {
      key: "creditLimit",
      header: "Credit Limit",
      render: (c) => {
        if (c.creditLimit === null) {
          return <span className="text-xs text-[#6b7280]">Unlimited</span>;
        }
        if (c.creditLimit === 0) {
          return (
            <span className="text-xs font-medium text-[#d97706]">Cash Only</span>
          );
        }
        return (
          <span className="text-sm text-[#374151]">{formatCurrency(c.creditLimit)}</span>
        );
      },
    },
    {
      key: "outstandingBalance",
      header: "Balance",
      render: (c) => {
        const bal = c.outstandingBalance;
        if (bal <= 0) {
          return <span className="text-sm text-[#16a34a] font-medium">Settled</span>;
        }
        return (
          <span className="text-sm font-semibold text-[#dc2626]">
            {formatCurrency(bal)}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      render: (c) => (
        <div
          className="flex items-center gap-2 justify-end"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-[#2563eb] hover:bg-[#eff6ff]"
            onClick={() => navigate("sales/new", { customerId: c.id })}
          >
            New Sale
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-[#374151] hover:bg-[#f0f2f5]"
            onClick={() => navigate("customers/detail", { id: c.id })}
          >
            View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-[#dc2626] hover:bg-[#fee2e2]"
            onClick={() => setDeactivateTarget(c)}
          >
            Deactivate
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-[#111827]">Customers</h1>
          <p className="text-sm text-[#6b7280]">
            Manage customer accounts and track receivables
          </p>
        </div>
        <Button
          onClick={() => navigate("customers/add")}
          className="h-9 px-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[7px] text-sm font-medium flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-white border border-[#e4e7ec] rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eff6ff]">
              <Users className="h-5 w-5 text-[#2563eb]" />
            </div>
            <div>
              <p className="text-xs text-[#6b7280]">Total Customers</p>
              <p className="text-xl font-semibold text-[#111827]">{totalCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-[#e4e7ec] rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#dcfce7]">
              <TrendingUp className="h-5 w-5 text-[#16a34a]" />
            </div>
            <div>
              <p className="text-xs text-[#6b7280]">Total Receivables</p>
              <p className="text-xl font-semibold text-[#16a34a]">
                {formatCurrency(totalReceivables)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#e4e7ec] rounded-lg">
        <div className="flex items-center gap-3 p-4 border-b border-[#e4e7ec]">
          <input
            type="text"
            placeholder="Search customers…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-64 rounded-[7px] border border-[#e4e7ec] px-3 text-sm placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
          />
          {cities.length > 0 && (
            <Select
              value={cityFilter || "all"}
              onValueChange={(v) => { setCityFilter(v === "all" ? "" : v); setPage(1); }}
            >
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder="All Cities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DataTable
          columns={columns}
          data={customers}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          emptyMessage="No customers found. Add your first customer to get started."
          onRowClick={(c) => navigate("customers/detail", { id: c.id })}
          keyExtractor={(c) => c.id}
          pagination={{
            page,
            totalPages: Math.ceil(totalCount / ITEMS_PER_PAGE),
            totalCount,
            onPageChange: setPage,
          }}
        />
      </div>

      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(v) => { if (!v) setDeactivateTarget(null); }}
        title="Deactivate Customer"
        description={
          deactivateTarget
            ? `Are you sure you want to deactivate "${deactivateTarget.shopName}"? They will be hidden from sale forms. Historical data is preserved.`
            : ""
        }
        confirmLabel="Deactivate"
        variant="danger"
        isLoading={isDeactivating}
        onConfirm={handleDeactivate}
      />
    </div>
  );
}