// src/components/payments/PaymentForm.tsx
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  recordCustomerPayment,
  recordSupplierPayment,
  useOpenInvoices,
  usePartyOptions,
  type PartyType,
} from "@/hooks/usePayments";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatCurrency, formatDate, todayDate } from "@/lib/utils";
import type { PaymentMethod } from "@/types";

const NONE = "none"; // sentinel — shadcn Select cannot use an empty-string value

const schema = z
  .object({
    partyType: z.enum(["customer", "supplier"]),
    partyId: z.string().min(1, "Select a party"),
    referenceId: z.string(),
    amount: z.string().refine((v) => Number(v) > 0, "Enter an amount greater than zero"),
    paymentMethod: z.enum(["cash", "bank", "cheque"]),
    paymentDate: z.string().min(1, "Select a date"),
    chequeNo: z.string(),
    bankName: z.string(),
    notes: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.paymentMethod === "cheque" && !v.chequeNo.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["chequeNo"],
        message: "Cheque number is required",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

export interface PaymentFormDefaults {
  partyType?: PartyType;
  partyId?: string;
  referenceId?: string;
}

interface PaymentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults?: PaymentFormDefaults;
  onSaved?: () => void;
}

function toAmountString(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function emptyValues(defaults?: PaymentFormDefaults): FormValues {
  return {
    partyType: defaults?.partyType ?? "customer",
    partyId: defaults?.partyId ?? "",
    referenceId: defaults?.referenceId ?? NONE,
    amount: "",
    paymentMethod: "cash",
    paymentDate: todayDate(),
    chequeNo: "",
    bankName: "",
    notes: "",
  };
}

export function PaymentForm({ open, onOpenChange, defaults, onSaved }: PaymentFormProps) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(defaults),
  });

  useEffect(() => {
    if (open) reset(emptyValues(defaults));
  }, [open, defaults, reset]);

  const partyType = watch("partyType");
  const partyId = watch("partyId");
  const referenceId = watch("referenceId");
  const method = watch("paymentMethod");

  const { data: parties } = usePartyOptions(partyType);
  const { data: invoices } = useOpenInvoices(partyType, partyId);

  const selectedParty = parties?.find((p) => p.id === partyId);
  const selectedInvoice = invoices?.find((i) => i.id === referenceId);

  // When opened with a preselected invoice, pre-fill its balance once invoices load.
  useEffect(() => {
    if (!invoices || referenceId === NONE) return;
    const inv = invoices.find((i) => i.id === referenceId);
    if (inv && !getValues("amount")) {
      setValue("amount", toAmountString(inv.balance));
    }
  }, [invoices, referenceId, getValues, setValue]);

  const onSubmit = handleSubmit(async (v) => {
    setSubmitting(true);
    try {
      const payload = {
        partyId: v.partyId,
        amount: Number(v.amount),
        paymentMethod: v.paymentMethod as PaymentMethod,
        paymentDate: v.paymentDate,
        referenceId: v.referenceId === NONE ? null : v.referenceId,
        chequeNo: v.chequeNo,
        bankName: v.bankName,
        notes: v.notes,
      };
      if (v.partyType === "customer") {
        await recordCustomerPayment(payload);
      } else {
        await recordSupplierPayment(payload);
      }
      toast.success("Payment recorded");
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  });

  const hintBalance = selectedInvoice ? selectedInvoice.balance : selectedParty?.balance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            {partyType === "customer"
              ? "Record money received from a customer."
              : "Record money paid to a supplier."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Party type */}
          <div className="space-y-1.5">
            <Label>Payment type</Label>
            <Controller
              control={control}
              name="partyType"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(val) => {
                    field.onChange(val);
                    setValue("partyId", "");
                    setValue("referenceId", NONE);
                    setValue("amount", "");
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Received from customer</SelectItem>
                    <SelectItem value="supplier">Paid to supplier</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Party */}
          <div className="space-y-1.5">
            <Label>{partyType === "customer" ? "Customer" : "Supplier"}</Label>
            <Controller
              control={control}
              name="partyId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(val) => {
                    field.onChange(val);
                    setValue("referenceId", NONE);
                    setValue("amount", "");
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue
                      placeholder={
                        partyType === "customer" ? "Select customer" : "Select supplier"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(parties ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — owes {formatCurrency(p.balance)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.partyId && (
              <p className="text-xs text-[#dc2626]">{errors.partyId.message}</p>
            )}
          </div>

          {/* Invoice link */}
          <div className="space-y-1.5">
            <Label>Link to invoice (optional)</Label>
            <Controller
              control={control}
              name="referenceId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  disabled={!partyId}
                  onValueChange={(val) => {
                    field.onChange(val);
                    const inv = invoices?.find((i) => i.id === val);
                    if (inv) setValue("amount", toAmountString(inv.balance));
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Not linked" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not linked to an invoice</SelectItem>
                    {(invoices ?? []).map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.reference}
                        {inv.dueDate ? ` — due ${formatDate(inv.dueDate)}` : ` — ${formatDate(inv.date)}`}
                        {" — "}
                        {formatCurrency(inv.balance)} left
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-[#6b7280]">
              Unlinked payments reduce total balance only — no per-invoice update.
            </p>
          </div>

          {/* Amount + date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pf-amount">Amount (Rs.)</Label>
              <Input
                id="pf-amount"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                className="h-9"
                {...register("amount")}
              />
              {errors.amount && (
                <p className="text-xs text-[#dc2626]">{errors.amount.message}</p>
              )}
              {hintBalance !== undefined && (
                <p className="text-xs text-[#6b7280]">
                  {selectedInvoice ? "Invoice balance" : "Outstanding"}:{" "}
                  {formatCurrency(hintBalance)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-date">Date</Label>
              <Input id="pf-date" type="date" className="h-9" {...register("paymentDate")} />
              {errors.paymentDate && (
                <p className="text-xs text-[#dc2626]">{errors.paymentDate.message}</p>
              )}
            </div>
          </div>

          {/* Method */}
          <div className="space-y-1.5">
            <Label>Payment method</Label>
            <Controller
              control={control}
              name="paymentMethod"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {(method === "cheque" || method === "bank") && (
            <div className="grid grid-cols-2 gap-3">
              {method === "cheque" && (
                <div className="space-y-1.5">
                  <Label htmlFor="pf-cheque">Cheque no.</Label>
                  <Input id="pf-cheque" className="h-9" {...register("chequeNo")} />
                  {errors.chequeNo && (
                    <p className="text-xs text-[#dc2626]">{errors.chequeNo.message}</p>
                  )}
                </div>
              )}
              <div className={method === "bank" ? "col-span-2 space-y-1.5" : "space-y-1.5"}>
                <Label htmlFor="pf-bank">Bank name</Label>
                <Input id="pf-bank" className="h-9" {...register("bankName")} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="pf-notes">Notes</Label>
            <Textarea id="pf-notes" rows={2} {...register("notes")} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-[7px]"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-9 rounded-[7px] bg-[#2563eb] px-4 text-sm font-medium text-white hover:bg-[#1d4ed8]"
            >
              {submitting ? "Saving…" : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}