// src/pages/inventory/AddProductPage.tsx
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@/lib/navigation";
import { ProductForm, type ProductFormValues } from "@/components/products/ProductForm";
import { createProduct } from "@/hooks/useProducts";

export default function AddProductPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: ProductFormValues) {
    setIsSubmitting(true);
    try {
      await createProduct({
        name:        values.name,
        category:    values.category,
        brand:       values.brand || null,
        unit:        values.unit,
        barcode:     values.barcode || null,
        avgCost:     values.avgCost,
        salePrice:   values.salePrice,
        stock:       0,
        damagedStock: 0,
        minStock:    values.minStock,
        description: values.description || null,
        isActive:    true,
      });
      toast.success("Product added successfully.");
      navigate("inventory");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add product.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-5 max-w-2xl">
      {/* Back button */}
      <Button
        variant="ghost"
        className="mb-4 h-8 px-2 text-sm text-[#374151] hover:bg-[#f0f2f5] flex items-center gap-1.5"
        onClick={() => navigate("inventory")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Inventory
      </Button>

      <div className="bg-white border border-[#e4e7ec] rounded-lg p-6">
        <div className="mb-6">
          <h1 className="text-base font-semibold text-[#111827]">Add New Product</h1>
          <p className="text-sm text-[#6b7280] mt-0.5">
            Initial stock is set to 0. Use Opening Balances to set existing stock,
            or record a Purchase to add stock.
          </p>
        </div>

        <ProductForm
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          submitLabel="Add Product"
        />
      </div>
    </div>
  );
}