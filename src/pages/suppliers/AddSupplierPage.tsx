// src/pages/suppliers/AddSupplierPage.tsx
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useCurrentPage } from "@/lib/navigation";
import { SupplierForm, type SupplierFormValues } from "@/components/suppliers/SupplierForm";
import {
  useSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "@/hooks/useSuppliers";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function AddSupplierPage() {
  const navigate       = useNavigate();
  const { params }     = useCurrentPage();
  const supplierId     = params.id ?? "";
  const isEditMode     = !!supplierId;

  const { data: supplier, isLoading, error, refetch } = useSupplier(supplierId);

  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  async function handleSubmit(values: SupplierFormValues) {
    setIsSubmitting(true);
    try {
      if (isEditMode) {
        await updateSupplier(supplierId, {
          name:          values.name,
          contactPerson: values.contactPerson || null,
          phone:         values.phone         || null,
          city:          values.city          || null,
          address:       values.address       || null,
          notes:         values.notes         || null,
          isActive:      values.isActive,
        });
        toast.success("Supplier updated.");
        refetch();
      } else {
        await createSupplier({
          name:               values.name,
          contactPerson:      values.contactPerson || null,
          phone:              values.phone         || null,
          city:               values.city          || null,
          address:            values.address       || null,
          notes:              values.notes         || null,
          outstandingBalance: 0,
          isActive:           true,
        });
        toast.success("Supplier added.");
        navigate("suppliers");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save supplier.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeactivate() {
    if (!supplierId) return;
    setIsDeactivating(true);
    try {
      await deleteSupplier(supplierId);
      toast.success("Supplier deactivated.");
      navigate("suppliers");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deactivate supplier.");
    } finally {
      setIsDeactivating(false);
      setShowDeactivate(false);
    }
  }

  if (isEditMode && isLoading) {
    return (
      <div className="p-5 max-w-2xl">
        <div className="h-8 w-32 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="bg-white border border-[#e4e7ec] rounded-lg p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-9 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isEditMode && (error || !supplier)) {
    return (
      <div className="p-5 max-w-2xl">
        <Button
          variant="ghost"
          className="mb-4 h-8 px-2 text-sm text-[#374151] hover:bg-[#f0f2f5] flex items-center gap-1.5"
          onClick={() => navigate("suppliers")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="bg-white border border-[#fecaca] rounded-lg p-6 text-center">
          <p className="text-sm text-[#dc2626]">{error ?? "Supplier not found."}</p>
          <Button variant="outline" className="mt-3 h-8 text-sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 max-w-2xl">
      <Button
        variant="ghost"
        className="mb-4 h-8 px-2 text-sm text-[#374151] hover:bg-[#f0f2f5] flex items-center gap-1.5"
        onClick={() => navigate("suppliers")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Suppliers
      </Button>

      {/* Balance info banner — edit mode only */}
      {isEditMode && supplier && (
        <div className="mb-4 bg-white border border-[#e4e7ec] rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div>
              <p className="text-xs text-[#6b7280]">Outstanding Balance</p>
              <p
                className={`text-xl font-semibold ${
                  supplier.outstandingBalance > 0 ? "text-[#dc2626]" : "text-[#16a34a]"
                }`}
              >
                {formatCurrency(supplier.outstandingBalance)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#6b7280]">Status</p>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full text-xs font-medium px-2 py-0.5 mt-0.5 ${
                  supplier.isActive
                    ? "bg-[#dcfce7] text-[#16a34a]"
                    : "bg-[#f3f4f6] text-[#6b7280]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    supplier.isActive ? "bg-[#16a34a]" : "bg-[#6b7280]"
                  }`}
                />
                {supplier.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <div>
              <p className="text-xs text-[#6b7280]">Added</p>
              <p className="text-sm text-[#374151]">{formatDate(supplier.createdAt)}</p>
            </div>
          </div>
          {supplier.isActive && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs text-[#dc2626] hover:bg-[#fee2e2] flex items-center gap-1.5"
              onClick={() => setShowDeactivate(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Deactivate
            </Button>
          )}
        </div>
      )}

      <div className="bg-white border border-[#e4e7ec] rounded-lg p-6">
        <div className="mb-6">
          <h1 className="text-base font-semibold text-[#111827]">
            {isEditMode ? "Edit Supplier" : "Add New Supplier"}
          </h1>
          {!isEditMode && (
            <p className="text-sm text-[#6b7280] mt-0.5">
              Opening balances can be set from the Opening Balances page after adding the supplier.
            </p>
          )}
        </div>

        <SupplierForm
          defaultValues={supplier ?? undefined}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          submitLabel={isEditMode ? "Save Changes" : "Add Supplier"}
        />
      </div>

      <ConfirmDialog
        open={showDeactivate}
        onOpenChange={(v) => { if (!v) setShowDeactivate(false); }}
        title="Deactivate Supplier"
        description={`Are you sure you want to deactivate "${supplier?.name}"? They will be hidden from purchase forms. Your historical data is preserved.`}
        confirmLabel="Deactivate"
        variant="danger"
        isLoading={isDeactivating}
        onConfirm={handleDeactivate}
      />
    </div>
  );
}