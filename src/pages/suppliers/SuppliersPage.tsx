// src/pages/suppliers/SuppliersPage.tsx
import { useState } from "react";
import { Plus, Building2, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@/lib/navigation";
import { useSuppliers, deleteSupplier } from "@/hooks/useSuppliers";
import { DataTable } from "@/components/shared/DataTable";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { formatCurrency } from "@/lib/utils";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { toast } from "sonner";
import type { Supplier } from "@/types";
import type { ColumnDef } from "@/components/shared/DataTable";

export default function SuppliersPage() {
  const navigate = useNavigate();

  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [isDeleting, setIsDeleting]     = useState(false);

  const { data: suppliers, totalCount, isLoading, error, refetch } = useSuppliers({
    search,
    page,
  });

  const totalPayable = suppliers.reduce(
    (sum, s) => sum + (s.outstandingBalance > 0 ? s.outstandingBalance : 0),
    0
  );

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteSupplier(deleteTarget.id);
      toast.success(`${deleteTarget.name} deactivated.`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deactivate supplier.");
    } finally {
      setIsDeleting(false);
    }
  }

  const columns: ColumnDef<Supplier>[] = [
    {
      key: "name",
      header: "Supplier",
      render: (s) => (
        <div>
          <p className="font-medium text-[#111827] text-sm">{s.name}</p>
          {s.contactPerson && (
            <p className="text-xs text-[#6b7280]">{s.contactPerson}</p>
          )}
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (s) => (
        <div className="text-sm text-[#374151]">
          {s.phone ? (
            <p>{s.phone}</p>
          ) : (
            <span className="text-[#9ca3af]">—</span>
          )}
          {s.city && <p className="text-xs text-[#6b7280]">{s.city}</p>}
        </div>
      ),
    },
    {
      key: "outstandingBalance",
      header: "Balance Owed",
      render: (s) => {
        const bal = s.outstandingBalance;
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
      render: (s) => (
        <div
          className="flex items-center gap-2 justify-end"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-[#2563eb] hover:bg-[#eff6ff]"
            onClick={() => navigate("purchases/new")}
          >
            New Purchase
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-[#374151] hover:bg-[#f0f2f5]"
            onClick={() => navigate("suppliers/add", { id: s.id })}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-[#dc2626] hover:bg-[#fee2e2]"
            onClick={() => setDeleteTarget(s)}
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
          <h1 className="text-lg font-semibold text-[#111827]">Suppliers</h1>
          <p className="text-sm text-[#6b7280]">
            Manage suppliers and track what you owe them
          </p>
        </div>
        <Button
          onClick={() => navigate("suppliers/add")}
          className="h-9 px-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[7px] text-sm font-medium flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-white border border-[#e4e7ec] rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eff6ff]">
              <Building2 className="h-5 w-5 text-[#2563eb]" />
            </div>
            <div>
              <p className="text-xs text-[#6b7280]">Total Suppliers</p>
              <p className="text-xl font-semibold text-[#111827]">{totalCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-[#e4e7ec] rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#fee2e2]">
              <TrendingDown className="h-5 w-5 text-[#dc2626]" />
            </div>
            <div>
              <p className="text-xs text-[#6b7280]">Total Payables</p>
              <p className="text-xl font-semibold text-[#dc2626]">
                {formatCurrency(totalPayable)}
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
            placeholder="Search suppliers…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-64 rounded-[7px] border border-[#e4e7ec] px-3 text-sm placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
          />
        </div>

        <DataTable
          columns={columns}
          data={suppliers}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          emptyMessage="No suppliers yet. Add your first supplier to start recording purchases."
          onRowClick={(s) => navigate("suppliers/add", { id: s.id })}
          keyExtractor={(s) => s.id}
          pagination={{
            page,
            totalPages: Math.ceil(totalCount / ITEMS_PER_PAGE),
            totalCount,
            onPageChange: setPage,
          }}
        />
      </div>

      {/* Deactivate confirm dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        title="Deactivate Supplier"
        description={
          deleteTarget
            ? `Are you sure you want to deactivate "${deleteTarget.name}"? They will be hidden from purchase forms. This can be reversed by editing the supplier.`
            : ""
        }
        confirmLabel="Deactivate"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}