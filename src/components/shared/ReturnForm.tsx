// src/components/shared/ReturnForm.tsx
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { REFUND_METHODS, RETURN_CONDITIONS, WALKIN_CUSTOMER_ID } from "@/lib/constants";
import { formatCurrency, todayDate } from "@/lib/utils";
import {
  createPurchaseReturn, createSaleReturn,
  usePurchaseReturnableItems, useSaleReturnableItems,
} from "@/hooks/useReturns";

const returnSchema = z.object({
  productId: z.string().min(1, "Select a product"),
  quantity: z
    .number({ invalid_type_error: "Enter a quantity" })
    .int("Whole units only")
    .min(1, "Minimum 1"),
  returnCondition: z.enum(["sellable", "damaged"]),
  refundMethod: z.enum(["credit_note", "cash", "bank", "cheque"]),
  reason: z.string().max(300, "Max 300 characters").optional(),
  returnDate: z.string().min(1, "Select a date"),
});
type ReturnFormValues = z.infer<typeof returnSchema>;

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}
interface SaleProps extends BaseProps {
  mode: "sale";
  saleId: string;
  invoiceNo: string;
  customerId: string;
}
interface PurchaseProps extends BaseProps {
  mode: "purchase";
  purchaseId: string;
  invoiceNo: string | null;
}
export type ReturnFormProps = SaleProps | PurchaseProps;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function ReturnForm(props: ReturnFormProps) {
  const { open, onOpenChange, onSuccess } = props;
  const isSale = props.mode === "sale";
  const isWalkin = props.mode === "sale" && props.customerId === WALKIN_CUSTOMER_ID;

  const saleItems = useSaleReturnableItems(
    props.mode === "sale" && open ? props.saleId : null
  );
  const purchaseItems = usePurchaseReturnableItems(
    props.mode === "purchase" && open ? props.purchaseId : null
  );
  const { data: items, isLoading, error } = isSale ? saleItems : purchaseItems;

  const availableItems = useMemo(
    () => (items ?? []).filter((i) => i.returnable > 0),
    [items]
  );

  const form = useForm<ReturnFormValues>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      productId: "",
      quantity: 1,
      returnCondition: "sellable",
      refundMethod: "credit_note",
      reason: "",
      returnDate: todayDate(),
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      productId: availableItems[0]?.productId ?? "",
      quantity: 1,
      returnCondition: "sellable",
      refundMethod: isWalkin ? "cash" : "credit_note",
      reason: "",
      returnDate: todayDate(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, availableItems, isWalkin]);

  const watchedProductId = form.watch("productId");
  const watchedQty = form.watch("quantity");
  const watchedMethod = form.watch("refundMethod");
  const watchedCondition = form.watch("returnCondition");

  const selected = availableItems.find((i) => i.productId === watchedProductId);
  const qtyNum = Number.isFinite(watchedQty) ? watchedQty : 0;
  const refundPreview = selected ? round2(selected.unitAmount * qtyNum) : 0;

  const refundOptions = isWalkin
    ? REFUND_METHODS.filter((m) => m.value !== "credit_note")
    : REFUND_METHODS;

  const onSubmit = form.handleSubmit(async (values) => {
    const item = availableItems.find((i) => i.productId === values.productId);
    if (!item) {
      form.setError("productId", { message: "Select a product" });
      return;
    }
    if (values.quantity > item.returnable) {
      form.setError("quantity", { message: `Only ${item.returnable} unit(s) can still be returned` });
      return;
    }
    try {
      if (props.mode === "sale") {
        const r = await createSaleReturn({
          saleId: props.saleId,
          productId: values.productId,
          quantity: values.quantity,
          reason: values.reason,
          returnCondition: values.returnCondition,
          refundMethod: values.refundMethod,
          returnDate: values.returnDate,
        });
        toast.success(`Return recorded — ${formatCurrency(r.refundAmount)} ${
          values.refundMethod === "credit_note" ? "credited to account" : "refunded"
        }`);
      } else {
        const r = await createPurchaseReturn({
          purchaseId: props.purchaseId,
          productId: values.productId,
          quantity: values.quantity,
          reason: values.reason,
          returnDate: values.returnDate,
        });
        toast.success(`Purchase return recorded — ${formatCurrency(r.refundAmount)}`);
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Return failed");
    }
  });

  const title = isSale
    ? `Sale Return — ${props.invoiceNo}`
    : `Purchase Return — ${props.invoiceNo ?? "Purchase"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-[#111827]">{title}</DialogTitle>
          <DialogDescription className="text-sm text-[#6b7280]">
            {isSale
              ? "Return items from this invoice. Refund is calculated from the price actually charged."
              : "Return items to the supplier. Refund is calculated from the original cost price."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-[#6b7280]">Loading items…</p>
        ) : error ? (
          <p className="rounded-[7px] border border-[#fecaca] bg-[#fee2e2] p-3 text-sm text-[#dc2626]">{error}</p>
        ) : availableItems.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#6b7280]">
            Every item on this {isSale ? "invoice" : "purchase"} has already been returned.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Product */}
            <div className="space-y-1.5">
              <Label className="text-sm text-[#374151]">Product</Label>
              <Controller
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9 rounded-[7px]">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableItems.map((i) => (
                        <SelectItem key={i.productId} value={i.productId}>
                          {i.productName} — {i.returnable} returnable
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.productId && (
                <p className="text-xs text-[#dc2626]">{form.formState.errors.productId.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Quantity */}
              <div className="space-y-1.5">
                <Label className="text-sm text-[#374151]">
                  Quantity{selected ? ` (max ${selected.returnable})` : ""}
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={selected?.returnable}
                  className="h-9 rounded-[7px]"
                  {...form.register("quantity", { valueAsNumber: true })}
                />
                {form.formState.errors.quantity && (
                  <p className="text-xs text-[#dc2626]">{form.formState.errors.quantity.message}</p>
                )}
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <Label className="text-sm text-[#374151]">Return date</Label>
                <Input type="date" className="h-9 rounded-[7px]" {...form.register("returnDate")} />
                {form.formState.errors.returnDate && (
                  <p className="text-xs text-[#dc2626]">{form.formState.errors.returnDate.message}</p>
                )}
              </div>
            </div>

            {/* Sale-only: condition + refund method */}
            {isSale && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm text-[#374151]">Condition</Label>
                  <Controller
                    control={form.control}
                    name="returnCondition"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="h-9 rounded-[7px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RETURN_CONDITIONS.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {watchedCondition === "damaged" && (
                    <p className="text-xs text-[#d97706]">
                      Damaged units go to damaged stock. Sellable stock and average cost are unchanged.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-[#374151]">Refund method</Label>
                  <Controller
                    control={form.control}
                    name="refundMethod"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="h-9 rounded-[7px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {refundOptions.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-xs text-[#6b7280]">
                    {watchedMethod === "credit_note"
                      ? "Reduces customer's outstanding balance — no cash movement."
                      : "Actual payout — recorded in payment history as refund."}
                  </p>
                </div>
              </>
            )}

            {/* Reason */}
            <div className="space-y-1.5">
              <Label className="text-sm text-[#374151]">Reason (optional)</Label>
              <Textarea rows={2} className="rounded-[7px]" {...form.register("reason")} />
            </div>

            {/* Preview */}
            <div className="flex items-center justify-between rounded-[7px] border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2.5">
              <span className="text-sm text-[#1e40af]">
                {isSale ? "Refund amount" : "Supplier credit"}
              </span>
              <span className="text-sm font-semibold text-[#1e40af]">{formatCurrency(refundPreview)}</span>
            </div>
            {!isSale && (
              <p className="text-xs text-[#6b7280]">
                Reduces what you owe this supplier. Units leave sellable stock; average cost is unchanged.
              </p>
            )}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-[7px]"
                onClick={() => onOpenChange(false)}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-9 rounded-[7px] bg-[#2563eb] px-4 text-sm font-medium text-white hover:bg-[#1d4ed8]"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Saving…" : "Record Return"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}