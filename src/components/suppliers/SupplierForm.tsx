// src/components/suppliers/SupplierForm.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { Supplier } from "@/types";

const schema = z.object({
  name:          z.string().min(1, "Supplier name is required"),
  contactPerson: z.string().optional(),
  phone:         z.string().optional(),
  city:          z.string().optional(),
  address:       z.string().optional(),
  notes:         z.string().optional(),
  isActive:      z.boolean(),
});

export type SupplierFormValues = z.infer<typeof schema>;

interface SupplierFormProps {
  defaultValues?: Partial<Supplier>;
  onSubmit: (values: SupplierFormValues) => Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export function SupplierForm({
  defaultValues,
  onSubmit,
  isSubmitting = false,
  submitLabel = "Save Supplier",
}: SupplierFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:          defaultValues?.name          ?? "",
      contactPerson: defaultValues?.contactPerson ?? "",
      phone:         defaultValues?.phone         ?? "",
      city:          defaultValues?.city          ?? "",
      address:       defaultValues?.address       ?? "",
      notes:         defaultValues?.notes         ?? "",
      isActive:      defaultValues?.isActive      ?? true,
    },
  });

  const isActive = watch("isActive");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Supplier name */}
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-sm font-medium text-[#111827]">
          Supplier / Company Name <span className="text-[#dc2626]">*</span>
        </Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="e.g. Al-Rehman Electronics"
          className="h-9"
          autoFocus
        />
        {errors.name && (
          <p className="text-xs text-[#dc2626]">{errors.name.message}</p>
        )}
      </div>

      {/* Contact person + Phone */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="contactPerson" className="text-sm font-medium text-[#111827]">
            Contact Person
          </Label>
          <Input
            id="contactPerson"
            {...register("contactPerson")}
            placeholder="e.g. Mr. Ahmed"
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-sm font-medium text-[#111827]">
            Phone Number
          </Label>
          <Input
            id="phone"
            {...register("phone")}
            placeholder="e.g. 0300-1234567"
            className="h-9"
          />
        </div>
      </div>

      {/* City */}
      <div className="space-y-1.5">
        <Label htmlFor="city" className="text-sm font-medium text-[#111827]">
          City
        </Label>
        <Input
          id="city"
          {...register("city")}
          placeholder="e.g. Lahore"
          className="h-9 w-64"
        />
      </div>

      {/* Address */}
      <div className="space-y-1.5">
        <Label htmlFor="address" className="text-sm font-medium text-[#111827]">
          Address
        </Label>
        <Textarea
          id="address"
          {...register("address")}
          placeholder="Street address, area…"
          rows={2}
          className="resize-none"
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
          placeholder="Payment terms, special instructions, etc."
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
              Inactive suppliers are hidden from purchase forms
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