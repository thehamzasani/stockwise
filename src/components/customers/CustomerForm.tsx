// src/components/customers/CustomerForm.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BUSINESS_TYPES, DISCOUNT_GROUPS } from "@/lib/constants";
import type { Customer } from "@/types";

const schema = z.object({
  shopName:      z.string().min(1, "Shop name is required"),
  ownerName:     z.string().optional(),
  phone:         z.string().optional(),
  whatsapp:      z.string().optional(),
  city:          z.string().optional(),
  area:          z.string().optional(),
  address:       z.string().optional(),
  businessType:  z.string().min(1, "Business type is required"),
  // creditLimit: empty string → null (unlimited), "0" → 0 (cash only), positive → limit
  creditLimitRaw: z.string().optional(),
  paymentTerms:  z.coerce.number().int().min(0, "Payment terms must be 0 or more"),
  discountGroup: z.string().min(1),
  notes:         z.string().optional(),
  cnic:          z.string().optional(),
  isActive:      z.boolean(),
});

export type CustomerFormValues = z.infer<typeof schema>;

// Parsed creditLimit from the raw string field
export function parseCreditLimit(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "") return null; // blank = unlimited
  const n = parseFloat(raw);
  if (isNaN(n)) return null;
  return Math.max(0, n);
}

interface CustomerFormProps {
  defaultValues?: Partial<Customer>;
  onSubmit: (values: CustomerFormValues) => Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export function CustomerForm({
  defaultValues,
  onSubmit,
  isSubmitting = false,
  submitLabel = "Save Customer",
}: CustomerFormProps) {
  // Convert creditLimit number/null to raw string for the input
  function creditLimitToRaw(cl: number | null | undefined): string {
    if (cl === null || cl === undefined) return ""; // null = unlimited → blank
    return String(cl);
  }

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      shopName:       defaultValues?.shopName      ?? "",
      ownerName:      defaultValues?.ownerName     ?? "",
      phone:          defaultValues?.phone         ?? "",
      whatsapp:       defaultValues?.whatsapp      ?? "",
      city:           defaultValues?.city          ?? "",
      area:           defaultValues?.area          ?? "",
      address:        defaultValues?.address       ?? "",
      businessType:   defaultValues?.businessType  ?? "retailer",
      creditLimitRaw: creditLimitToRaw(defaultValues?.creditLimit),
      paymentTerms:   defaultValues?.paymentTerms  ?? 0,
      discountGroup:  defaultValues?.discountGroup ?? "standard",
      notes:          defaultValues?.notes         ?? "",
      cnic:           defaultValues?.cnic          ?? "",
      isActive:       defaultValues?.isActive      ?? true,
    },
  });

  const isActive      = watch("isActive");
  const creditLimitRaw = watch("creditLimitRaw") ?? "";

  // Helpful label showing what the current creditLimitRaw means
  function creditLimitHint(): string {
    if (creditLimitRaw.trim() === "") return "Blank = Unlimited credit";
    const n = parseFloat(creditLimitRaw);
    if (isNaN(n) || n < 0) return "Enter a valid amount (0 = cash only, blank = unlimited)";
    if (n === 0) return "0 = Cash only — no credit allowed";
    return `Credit limit: Rs. ${n.toLocaleString()}`;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Shop name + Owner */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="shopName" className="text-sm font-medium text-[#111827]">
            Shop Name <span className="text-[#dc2626]">*</span>
          </Label>
          <Input
            id="shopName"
            {...register("shopName")}
            placeholder="e.g. Al-Noor Electronics"
            className="h-9"
            autoFocus
          />
          {errors.shopName && (
            <p className="text-xs text-[#dc2626]">{errors.shopName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ownerName" className="text-sm font-medium text-[#111827]">
            Owner Name
          </Label>
          <Input
            id="ownerName"
            {...register("ownerName")}
            placeholder="e.g. Mr. Bilal"
            className="h-9"
          />
        </div>
      </div>

      {/* Phone + WhatsApp */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-sm font-medium text-[#111827]">
            Phone
          </Label>
          <Input
            id="phone"
            {...register("phone")}
            placeholder="e.g. 0300-1234567"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp" className="text-sm font-medium text-[#111827]">
            WhatsApp
          </Label>
          <Input
            id="whatsapp"
            {...register("whatsapp")}
            placeholder="e.g. 0311-9876543"
            className="h-9"
          />
        </div>
      </div>

      {/* City + Area */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="city" className="text-sm font-medium text-[#111827]">
            City
          </Label>
          <Input
            id="city"
            {...register("city")}
            placeholder="e.g. Lahore"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="area" className="text-sm font-medium text-[#111827]">
            Area / Locality
          </Label>
          <Input
            id="area"
            {...register("area")}
            placeholder="e.g. Hall Road"
            className="h-9"
          />
        </div>
      </div>

      {/* Address */}
      <div className="space-y-1.5">
        <Label htmlFor="address" className="text-sm font-medium text-[#111827]">
          Full Address
        </Label>
        <Textarea
          id="address"
          {...register("address")}
          placeholder="Shop number, street, landmark…"
          rows={2}
          className="resize-none"
        />
      </div>

      {/* Business type + Discount group */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-[#111827]">
            Business Type
          </Label>
          <Select
            defaultValue={defaultValues?.businessType ?? "retailer"}
            onValueChange={(v) => setValue("businessType", v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_TYPES.map((bt) => (
                <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-[#111827]">
            Discount Group
          </Label>
          <Select
            defaultValue={defaultValues?.discountGroup ?? "standard"}
            onValueChange={(v) => setValue("discountGroup", v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISCOUNT_GROUPS.map((dg) => (
                <SelectItem key={dg.value} value={dg.value}>{dg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-[#6b7280]">
            (Display only — no automatic discount applied in V1)
          </p>
        </div>
      </div>

      {/* Credit limit + Payment terms */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="creditLimitRaw" className="text-sm font-medium text-[#111827]">
            Credit Limit (Rs.)
          </Label>
          <Input
            id="creditLimitRaw"
            {...register("creditLimitRaw")}
            type="number"
            min="0"
            step="500"
            placeholder="Leave blank for unlimited"
            className="h-9"
          />
          <p className="text-xs text-[#6b7280]">{creditLimitHint()}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="paymentTerms" className="text-sm font-medium text-[#111827]">
            Payment Terms (days)
          </Label>
          <Input
            id="paymentTerms"
            type="number"
            min="0"
            step="1"
            {...register("paymentTerms")}
            className="h-9"
          />
          <p className="text-xs text-[#6b7280]">
            0 = due immediately. 7 = net 7 days, etc.
          </p>
          {errors.paymentTerms && (
            <p className="text-xs text-[#dc2626]">{errors.paymentTerms.message}</p>
          )}
        </div>
      </div>

      {/* CNIC */}
      <div className="space-y-1.5">
        <Label htmlFor="cnic" className="text-sm font-medium text-[#111827]">
          CNIC (optional)
        </Label>
        <Input
          id="cnic"
          {...register("cnic")}
          placeholder="e.g. 35201-1234567-1"
          className="h-9 w-64"
        />
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-sm font-medium text-[#111827]">
          Notes
        </Label>
        <Textarea
          id="notes"
          {...register("notes")}
          placeholder="Any additional notes about this customer…"
          rows={3}
          className="resize-none"
        />
      </div>

      {/* Active toggle — edit mode only */}
      {defaultValues?.id && (
        <div className="flex items-center gap-3 rounded-lg border border-[#e4e7ec] p-3">
          <Switch
            id="isActive"
            checked={isActive}
            onCheckedChange={(v) => setValue("isActive", v)}
          />
          <div>
            <Label
              htmlFor="isActive"
              className="text-sm font-medium text-[#111827] cursor-pointer"
            >
              {isActive ? "Active" : "Inactive"}
            </Label>
            <p className="text-xs text-[#6b7280]">
              Inactive customers are hidden from sale forms
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-9 px-6 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[7px] text-sm font-medium"
        >
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}