// src/components/products/ProductForm.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Switch } from "@/components/ui/switch";
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from "@/lib/constants";
import type { Product } from "@/types";

const schema = z.object({
  name:        z.string().min(1, "Product name is required"),
  category:    z.string().min(1, "Category is required"),
  brand:       z.string().optional(),
  unit:        z.string().min(1, "Unit is required"),
  barcode:     z.string().optional(),
  avgCost:     z.coerce.number().min(0, "Cost must be 0 or more"),
  salePrice:   z.coerce.number().min(0, "Price must be 0 or more"),
  minStock:    z.coerce.number().int().min(0, "Min stock must be 0 or more"),
  description: z.string().optional(),
  isActive:    z.boolean(),
});

export type ProductFormValues = z.infer<typeof schema>;

interface ProductFormProps {
  defaultValues?: Partial<Product>;
  onSubmit: (values: ProductFormValues) => Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export function ProductForm({
  defaultValues,
  onSubmit,
  isSubmitting = false,
  submitLabel = "Save Product",
}: ProductFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:        defaultValues?.name        ?? "",
      category:    defaultValues?.category    ?? "",
      brand:       defaultValues?.brand       ?? "",
      unit:        defaultValues?.unit        ?? "pcs",
      barcode:     defaultValues?.barcode     ?? "",
      avgCost:     defaultValues?.avgCost     ?? 0,
      salePrice:   defaultValues?.salePrice   ?? 0,
      minStock:    defaultValues?.minStock    ?? 5,
      description: defaultValues?.description ?? "",
      isActive:    defaultValues?.isActive    ?? true,
    },
  });

  const isActive = watch("isActive");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Row 1: Name + Category */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm font-medium text-[#111827]">
            Product Name <span className="text-[#dc2626]">*</span>
          </Label>
          <Input
            id="name"
            {...register("name")}
            placeholder="e.g. 10kΩ Resistor"
            className="h-9"
          />
          {errors.name && (
            <p className="text-xs text-[#dc2626]">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-[#111827]">
            Category <span className="text-[#dc2626]">*</span>
          </Label>
          <Select
            defaultValue={defaultValues?.category ?? ""}
            onValueChange={(v) => setValue("category", v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-xs text-[#dc2626]">{errors.category.message}</p>
          )}
        </div>
      </div>

      {/* Row 2: Brand + Unit */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="brand" className="text-sm font-medium text-[#111827]">
            Brand
          </Label>
          <Input
            id="brand"
            {...register("brand")}
            placeholder="e.g. Yageo, Samsung"
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-[#111827]">
            Unit <span className="text-[#dc2626]">*</span>
          </Label>
          <Select
            defaultValue={defaultValues?.unit ?? "pcs"}
            onValueChange={(v) => setValue("unit", v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_UNITS.map((u) => (
                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 3: Barcode */}
      <div className="space-y-1.5">
        <Label htmlFor="barcode" className="text-sm font-medium text-[#111827]">
          Barcode / SKU
        </Label>
        <Input
          id="barcode"
          {...register("barcode")}
          placeholder="Optional barcode or SKU"
          className="h-9"
        />
      </div>

      {/* Row 4: Avg Cost + Sale Price */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="avgCost" className="text-sm font-medium text-[#111827]">
            Cost Price (Rs.)
          </Label>
          <Input
            id="avgCost"
            type="number"
            step="0.01"
            min="0"
            {...register("avgCost")}
            className="h-9"
          />
          <p className="text-xs text-[#6b7280]">
            Will be overwritten by purchases (WAC)
          </p>
          {errors.avgCost && (
            <p className="text-xs text-[#dc2626]">{errors.avgCost.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="salePrice" className="text-sm font-medium text-[#111827]">
            Sale Price (Rs.) <span className="text-[#dc2626]">*</span>
          </Label>
          <Input
            id="salePrice"
            type="number"
            step="0.01"
            min="0"
            {...register("salePrice")}
            className="h-9"
          />
          {errors.salePrice && (
            <p className="text-xs text-[#dc2626]">{errors.salePrice.message}</p>
          )}
        </div>
      </div>

      {/* Row 5: Min Stock */}
      <div className="space-y-1.5">
        <Label htmlFor="minStock" className="text-sm font-medium text-[#111827]">
          Minimum Stock Alert
        </Label>
        <Input
          id="minStock"
          type="number"
          step="1"
          min="0"
          {...register("minStock")}
          className="h-9 w-48"
        />
        <p className="text-xs text-[#6b7280]">
          You'll be alerted when stock falls at or below this level
        </p>
        {errors.minStock && (
          <p className="text-xs text-[#dc2626]">{errors.minStock.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-sm font-medium text-[#111827]">
          Description
        </Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Optional product description or notes"
          rows={3}
          className="resize-none"
        />
      </div>

      {/* Active toggle (edit mode only) */}
      {defaultValues?.id && (
        <div className="flex items-center gap-3 rounded-lg border border-[#e4e7ec] p-3">
          <Switch
            checked={isActive}
            onCheckedChange={(v) => setValue("isActive", v)}
            id="isActive"
          />
          <div>
            <Label htmlFor="isActive" className="text-sm font-medium text-[#111827] cursor-pointer">
              {isActive ? "Active" : "Inactive"}
            </Label>
            <p className="text-xs text-[#6b7280]">
              Inactive products are hidden from sales and inventory lists
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