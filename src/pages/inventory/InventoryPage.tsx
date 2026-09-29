// src/pages/inventory/InventoryPage.tsx
import { useState } from "react";
import { Plus, Package, History, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useNavigate } from "@/lib/navigation";
import { useProducts } from "@/hooks/useProducts";
import { useStockMovements } from "@/hooks/useStockMovements";
import { DataTable } from "@/components/shared/DataTable";
import { StockBadge } from "@/components/products/StockBadge";
import { StockAdjustmentDialog } from "@/components/products/StockAdjustmentDialog";
import { formatCurrency,  formatDateTime } from "@/lib/utils";
import { PRODUCT_CATEGORIES, ITEMS_PER_PAGE } from "@/lib/constants";
import type { Product } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function InventoryPage() {
  const navigate = useNavigate();

  // Products tab state
  const [productSearch, setProductSearch]   = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [productPage, setProductPage]       = useState(1);
  const [adjustProduct, setAdjustProduct]   = useState<Product | null>(null);

  const { data: products, totalCount: productTotal, isLoading: productsLoading,
    error: productsError, refetch: refetchProducts } = useProducts({
    search: productSearch,
    category: categoryFilter,
    page: productPage,
  });

  // Stock history tab state
  const [historyPage, setHistoryPage] = useState(1);
  const { data: movements, totalCount: movementTotal, isLoading: movementsLoading,
    error: movementsError } = useStockMovements(undefined, historyPage);

  const productColumns = [
    {
      key: "name",
      header: "Product",
      render: (p: Product) => (
        <div>
          <p className="font-medium text-[#111827] text-sm">{p.name}</p>
          <p className="text-xs text-[#6b7280]">{p.category}{p.brand ? ` · ${p.brand}` : ""}</p>
        </div>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      render: (p: Product) => <StockBadge stock={p.stock} minStock={p.minStock} />,
    },
    {
      key: "avgCost",
      header: "Avg Cost",
      render: (p: Product) => (
        <span className="text-sm text-[#374151]">{formatCurrency(p.avgCost)}</span>
      ),
    },
    {
      key: "salePrice",
      header: "Sale Price",
      render: (p: Product) => (
        <span className="text-sm font-medium text-[#111827]">{formatCurrency(p.salePrice)}</span>
      ),
    },
    {
      key: "stockValue",
      header: "Stock Value",
      render: (p: Product) => (
        <span className="text-sm text-[#374151]">
          {formatCurrency(p.stock * p.avgCost)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (p: Product) => (
        <div className="flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-[#2563eb] hover:bg-[#eff6ff]"
            onClick={() => setAdjustProduct(p)}
          >
            Adjust
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-[#374151] hover:bg-[#f0f2f5]"
            onClick={() => navigate("inventory/edit", { id: p.id })}
          >
            Edit
          </Button>
        </div>
      ),
    },
  ];

  // Movement type display helper
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

  // Compute low-stock count for the header badge
  const lowStockCount = products.filter((p) => p.stock <= p.minStock && p.stock > 0).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;

  return (
    <div className="p-5">
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-[#111827]">Inventory</h1>
          <p className="text-sm text-[#6b7280]">Manage products and track stock levels</p>
        </div>
        <Button
          onClick={() => navigate("inventory/add")}
          className="h-9 px-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[7px] text-sm font-medium flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white border border-[#e4e7ec] rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eff6ff]">
              <Package className="h-5 w-5 text-[#2563eb]" />
            </div>
            <div>
              <p className="text-xs text-[#6b7280]">Total Products</p>
              <p className="text-xl font-semibold text-[#111827]">{productTotal}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-[#e4e7ec] rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#fef3c7]">
              <TrendingDown className="h-5 w-5 text-[#d97706]" />
            </div>
            <div>
              <p className="text-xs text-[#6b7280]">Low Stock</p>
              <p className="text-xl font-semibold text-[#d97706]">{lowStockCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-[#e4e7ec] rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#fee2e2]">
              <Package className="h-5 w-5 text-[#dc2626]" />
            </div>
            <div>
              <p className="text-xs text-[#6b7280]">Out of Stock</p>
              <p className="text-xl font-semibold text-[#dc2626]">{outOfStockCount}</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="products">
        <TabsList className="mb-4">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Products
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Stock History
          </TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products">
          <div className="bg-white border border-[#e4e7ec] rounded-lg">
            {/* Filters */}
            <div className="flex items-center gap-3 p-4 border-b border-[#e4e7ec]">
              <input
                type="text"
                placeholder="Search products…"
                value={productSearch}
                onChange={(e) => { setProductSearch(e.target.value); setProductPage(1); }}
                className="h-9 w-64 rounded-[7px] border border-[#e4e7ec] px-3 text-sm placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
              />
              <Select
                value={categoryFilter || "all"}
                onValueChange={(v) => { setCategoryFilter(v === "all" ? "" : v); setProductPage(1); }}
              >
                <SelectTrigger className="h-9 w-44">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DataTable
              columns={productColumns}
              data={products}
              isLoading={productsLoading}
              error={productsError}
              onRetry={refetchProducts}
              emptyMessage="No products found. Add your first product to get started."
              onRowClick={(p) => navigate("inventory/edit", { id: p.id })}
              pagination={{
                page: productPage,
                totalPages: Math.ceil(productTotal / ITEMS_PER_PAGE),
                totalCount: productTotal,
                onPageChange: setProductPage,
              }}
            />
          </div>
        </TabsContent>

        {/* Stock History Tab */}
        <TabsContent value="history">
          <div className="bg-white border border-[#e4e7ec] rounded-lg">
            <div className="p-4 border-b border-[#e4e7ec]">
              <h2 className="text-sm font-semibold text-[#111827]">All Stock Movements</h2>
              <p className="text-xs text-[#6b7280] mt-0.5">
                Complete history of every stock change across all products
              </p>
            </div>

            {movementsLoading ? (
              <div className="p-8 text-center text-sm text-[#6b7280]">Loading…</div>
            ) : movementsError ? (
              <div className="p-8 text-center text-sm text-[#dc2626]">{movementsError}</div>
            ) : movements.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#6b7280]">No stock movements yet.</div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#f9fafb] border-b border-[#e4e7ec]">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">Date</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">Product</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">Type</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">Qty</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">Before</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase text-[#6b7280]">After</th>
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
                            <span className="text-sm text-[#111827]">
                              {(m as unknown as { product_name?: string }).product_name ?? m.productId}
                            </span>
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
                          <td className="px-4 py-2.5 text-xs text-[#6b7280] max-w-45 truncate">
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

      {/* Stock Adjustment Dialog */}
      {adjustProduct && (
        <StockAdjustmentDialog
          product={adjustProduct}
          open={!!adjustProduct}
          onClose={() => setAdjustProduct(null)}
          onSuccess={refetchProducts}
        />
      )}
    </div>
  );
}