// src/pages/customers/AddCustomerPage.tsx
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useCurrentPage } from "@/lib/navigation";
import {
  CustomerForm,
  type CustomerFormValues,
  parseCreditLimit,
} from "@/components/customers/CustomerForm";
import {
  useCustomer,
  createCustomer,
  updateCustomer,
  deactivateCustomer,
} from "@/hooks/useCustomers";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function AddCustomerPage() {
  const navigate       = useNavigate();
  const { params }     = useCurrentPage();
  const customerId     = params.id ?? "";
  const isEditMode     = !!customerId;

  const { data: customer, isLoading, error, refetch } = useCustomer(customerId);

  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  async function handleSubmit(values: CustomerFormValues) {
    setIsSubmitting(true);
    try {
      const creditLimit = parseCreditLimit(values.creditLimitRaw);

      if (isEditMode) {
        await updateCustomer(customerId, {
          shopName:      values.shopName,
          ownerName:     values.ownerName     || null,
          phone:         values.phone         || null,
          whatsapp:      values.whatsapp      || null,
          city:          values.city          || null,
          area:          values.area          || null,
          address:       values.address       || null,
          businessType:  values.businessType,
          creditLimit,
          paymentTerms:  values.paymentTerms,
          discountGroup: values.discountGroup,
          notes:         values.notes         || null,
          cnic:          values.cnic          || null,
          isActive:      values.isActive,
        });
        toast.success("Customer updated.");
        refetch();
      } else {
        await createCustomer({
          shopName:          values.shopName,
          ownerName:         values.ownerName     || null,
          phone:             values.phone         || null,
          whatsapp:          values.whatsapp      || null,
          city:              values.city          || null,
          area:              values.area          || null,
          address:           values.address       || null,
          businessType:      values.businessType,
          creditLimit,
          paymentTerms:      values.paymentTerms,
          discountGroup:     values.discountGroup,
          outstandingBalance: 0,
          notes:             values.notes         || null,
          cnic:              values.cnic          || null,
          isActive:          true,
        });
        toast.success("Customer added.");
        navigate("customers");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save customer.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeactivate() {
    if (!customerId) return;
    setIsDeactivating(true);
    try {
      await deactivateCustomer(customerId);
      toast.success("Customer deactivated.");
      navigate("customers");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deactivate customer.");
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
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-9 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isEditMode && (error || !customer)) {
    return (
      <div className="p-5 max-w-2xl">
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
        onClick={() => navigate(isEditMode ? "customers/detail" : "customers", { id: customerId })}
      >
        <ArrowLeft className="h-4 w-4" />
        {isEditMode ? "Back to Customer" : "Back to Customers"}
      </Button>

      {/* Balance banner — edit mode */}
      {isEditMode && customer && (
        <div className="mb-4 bg-white border border-[#e4e7ec] rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div>
              <p className="text-xs text-[#6b7280]">Outstanding Balance</p>
              <p
                className={`text-xl font-semibold ${
                  customer.outstandingBalance > 0 ? "text-[#dc2626]" : "text-[#16a34a]"
                }`}
              >
                {formatCurrency(customer.outstandingBalance)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#6b7280]">Status</p>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full text-xs font-medium px-2 py-0.5 mt-0.5 ${
                  customer.isActive
                    ? "bg-[#dcfce7] text-[#16a34a]"
                    : "bg-[#f3f4f6] text-[#6b7280]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    customer.isActive ? "bg-[#16a34a]" : "bg-[#6b7280]"
                  }`}
                />
                {customer.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <div>
              <p className="text-xs text-[#6b7280]">Customer since</p>
              <p className="text-sm text-[#374151]">{formatDate(customer.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs text-[#2563eb] hover:bg-[#eff6ff] flex items-center gap-1.5"
              onClick={() => navigate("customers/detail", { id: customerId })}
            >
              <Eye className="h-3.5 w-3.5" />
              View Ledger
            </Button>
            {customer.isActive && (
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
        </div>
      )}

      <div className="bg-white border border-[#e4e7ec] rounded-lg p-6">
        <div className="mb-6">
          <h1 className="text-base font-semibold text-[#111827]">
            {isEditMode ? `Edit — ${customer?.shopName}` : "Add New Customer"}
          </h1>
          {!isEditMode && (
            <p className="text-sm text-[#6b7280] mt-0.5">
              Opening balances can be set from the Opening Balances page after adding the customer.
            </p>
          )}
        </div>

        <CustomerForm
          defaultValues={customer ?? undefined}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          submitLabel={isEditMode ? "Save Changes" : "Add Customer"}
        />
      </div>

      <ConfirmDialog
        open={showDeactivate}
        onOpenChange={(v) => { if (!v) setShowDeactivate(false); }}
        title="Deactivate Customer"
        description={`Are you sure you want to deactivate "${customer?.shopName}"? They will be hidden from sale forms. All historical data is preserved.`}
        confirmLabel="Deactivate"
        variant="danger"
        isLoading={isDeactivating}
        onConfirm={handleDeactivate}
      />
    </div>
  );
}