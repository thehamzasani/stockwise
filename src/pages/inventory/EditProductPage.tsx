// src/pages/inventory/EditProductPage.tsx
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useCurrentPage } from "@/lib/navigation";
import { ProductForm, type ProductFormValues } from "@/components/products/ProductForm";
import { useProduct, updateProduct } from "@/hooks/useProducts";
import { useStockMovements } from "@/hooks/useStockMovements";
import { StockAdjustmentDialog } from "@/components/products/StockAdjustmentDialog";
import { StockBadge } from "@/components/products/StockBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function EditProductPage() {
  const navigate = useNavigate();
  const { params } = useCurrentPage();
  const productId = params.id ?? "";

  const { data: product, isLoading, error, refetch } = useProduct(productId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdjust, setShowAdjust]     = useState(false);

  // Stock history for this product
  const [historyPage, setHistoryPage]   = useState(1);
  const { data: movements, totalCount: movementTotal, isLoading: movementsLoading }
    = useStockMovements(productId, historyPage);

  async function handleSubmit(values: ProductFormValues) {
    setIsSubmitting(true);
    try {
      await updateProduct(productId, {
        name:        values.name,
        category:    values.category,
        brand:       values.brand || null,
        unit:        values.unit,
        barcode:     values.barcode || null,
        salePrice:   values.salePrice,
        minStock:    values.minStock,
        description: values.description || null,
        isActive:    values.isActive,
      });
      toast.success("Product updated.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update product.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-5">
        <div className="h-8 w-32 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="bg-white border border-[#e4e7ec] rounded-lg p-6 space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-9 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-5">
        <Button
          variant="ghost"
          className="mb-4 h-8 px-2 text-sm text-[#374151] hover:bg-[#f0f2f5] flex items-center gap-1.5"
          onClick={() => navigate("inventory")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="bg-white border border-[#fecaca] rounded-lg p-6 text-center">
          <p className="text-sm text-[#dc2626]">{error ?? "Product not found."}</p>
          <Button
            variant="outline"
            className="mt-3 h-8 text-sm"
            onClick={refetch}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  function movementLabel(type: string): { label: string; color: string } {
    const map: Record<string, { label: string; color: string }> = {
      purchase_in:         { label: "Purchase In",       color: "text-[#16a34a]" },
      sale_out:            { label: "Sale Out",           color: "text-[#dc2626]" },
      sale_return_in:      { label: "Sale Return",        color: "text-[#16a34a]" },
      purchase_return_out: { label: "Purchase Return",    color: "text-[#d97706]" },
      damaged_write_off:   { label: "Damaged Write-off",  color: "text-[#dc2626]" },
      adjustment_add:      { label: "Adjustment +",       color: "text-[#16a34a]" },
      adjustment_remove:   { label: "Adjustment −",       color: "text-[#dc2626]" },
      opening_stock:       { label: "Opening Stock",      color: "text-[#2563eb]" },
      correction:          { label: "Correction",         color: "text-[#d97706]" },
      sale_cancelled:      { label: "Sale Cancelled",     color: "text-[#6b7280]" },
      purchase_cancelled:  { label: "Purchase Cancelled", color: "text-[#6b7280]" },
    };
    return map[type] ?? { label: type, color: "text-[#374151]" };
  }

  return (
    <div className="p-5 max-w-3xl">
      {/* Back button */}
      <Button
        variant="ghost"
        className="mb-4 h-8 px-2 text-sm text-[#374151] hover:bg-[#f0f2f5] flex items-center gap-1.5"
        onClick={() => navigate("inventory")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Inventory
      </Button>

      {/* Stock summary banner */}
      <div className="bg-white border border-[#e4e7ec] rounded-lg p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-[#6b7280]">Current Stock</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-2xl font-semibold text-[#111827]">{product.stock}</span>
              <StockBadge stock={product.stock} minStock={product.minStock} showCount={false} />
            </div>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">Avg Cost (WAC)</p>
            <p className="text-lg font-semibold text-[#111827]">{formatCurrency(product.avgCost)}</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">Sale Price</p>
            <p className="text-lg font-semibold text-[#2563eb]">{formatCurrency(product.salePrice)}</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">Stock Value</p>
            <p className="text-lg font-semibold text-[#111827]">
              {formatCurrency(product.stock * product.avgCost)}
            </p>
          </div>
          {product.damagedStock > 0 && (
            <div>
              <p className="text-xs text-[#6b7280]">Damaged</p>
              <p className="text-lg font-semibold text-[#dc2626]">{product.damagedStock}</p>
            </div>
          )}
        </div>
        <Button
          onClick={() => setShowAdjust(true)}
          variant="outline"
          className="h-9 px-4 border-[#2563eb] text-[#2563eb] hover:bg-[#eff6ff] rounded-[7px] text-sm font-medium"
        >
          Adjust Stock
        </Button>
      </div>

      <Tabs defaultValue="details">
        <TabsList className="mb-4">
          <TabsTrigger value="details">Product Details</TabsTrigger>
          <TabsTrigger value="history">Stock History ({movementTotal})</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="bg-white border border-[#e4e7ec] rounded-lg p-6">
            <h2 className="text-sm font-semibold text-[#111827] mb-4">Edit Product</h2>
            <ProductForm
              defaultValues={product}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              submitLabel="Save Changes"
            />
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="bg-white border border-[#e4e7ec] rounded-lg">
            <div className="p-4 border-b border-[#e4e7ec]">
              <h2 className="text-sm font-semibold text-[#111827]">
                Stock Movement History — {product.name}
              </h2>
            </div>

            {movementsLoading ? (
              <div className="p-8 text-center text-sm text-[#6b7280]">Loading…</div>
            ) : movements.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#6b7280]">
                No stock movements recorded yet.
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#f9fafb] border-b border-[#e4e7ec]">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">Date</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">Type</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">Qty</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">Before</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">After</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">Cost</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => {
                      const { label, color } = movementLabel(m.movementType);
                      const isAdditive = ["purchase_in","sale_return_in","adjustment_add",
                        "opening_stock","sale_cancelled"].includes(m.movementType);
                      return (
                        <tr key={m.id} className="border-b border-[#e4e7ec] hover:bg-[#f9fafb]">
                          <td className="px-4 py-2.5 text-xs text-[#6b7280] whitespace-nowrap">
                            {formatDateTime(m.createdAt)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-medium ${color}`}>{label}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium">
                            <span className={isAdditive ? "text-[#16a34a]" : "text-[#dc2626]"}>
                              {isAdditive ? "+" : m.movementType === "correction" ? "±" : "−"}{m.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm text-[#6b7280]">
                            {m.stockBefore}
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm font-medium text-[#111827]">
                            {m.stockAfter}
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm text-[#374151]">
                            {m.costPrice > 0 ? formatCurrency(m.costPrice) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-[#6b7280] max-w-[200px] truncate">
                            {m.notes ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#e4e7ec]">
                  <p className="text-xs text-[#6b7280]">
                    {movementTotal} movement{movementTotal !== 1 ? "s" : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-3 text-xs rounded-[7px]"
                      disabled={historyPage === 1}
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    >
                      Prev
                    </Button>
                    <span className="text-xs text-[#374151]">
                      Page {historyPage} of {Math.ceil(movementTotal / ITEMS_PER_PAGE) || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-3 text-xs rounded-[7px]"
                      disabled={historyPage >= Math.ceil(movementTotal / ITEMS_PER_PAGE)}
                      onClick={() => setHistoryPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Adjust dialog */}
      {showAdjust && (
        <StockAdjustmentDialog
          product={product}
          open={showAdjust}
          onClose={() => setShowAdjust(false)}
          onSuccess={refetch}
        />
      )}
    </div>
  );
}