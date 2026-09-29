// src/components/sales/SaleItemRow.tsx
import { Trash2 } from "lucide-react";
import { useSaleStore } from "@/stores/saleStore";
import { formatCurrency } from "@/lib/utils";
import type { SaleLineItem } from "@/types";

interface SaleItemRowProps {
  item: SaleLineItem;
  currency: string;
}

export function SaleItemRow({ item, currency }: SaleItemRowProps) {
  const { updateItem, removeItem } = useSaleStore();
  const { product, quantity, salePrice, discountPct, totalAmount } = item;

  function handleQtyChange(raw: string) {
    const val = parseInt(raw, 10);
    if (isNaN(val) || val < 1) return;
    updateItem(product.id, { quantity: val });
  }

  function handlePriceChange(raw: string) {
    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) return;
    updateItem(product.id, { salePrice: val });
  }

  function handleDiscountChange(raw: string) {
    const val = parseFloat(raw);
    if (isNaN(val) || val < 0 || val > 100) return;
    updateItem(product.id, { discountPct: val });
  }

  return (
    <tr className="border-b border-[#e4e7ec] hover:bg-[#f9fafb]">
      {/* Product */}
      <td className="px-3 py-2">
        <div className="text-sm font-medium text-[#111827]">{product.name}</div>
        <div className="text-xs text-[#6b7280]">{product.category} · {product.unit}</div>
        <div className="text-xs text-[#9ca3af]">In stock: {product.stock}</div>
      </td>

      {/* Quantity */}
      <td className="px-3 py-2 w-24">
        <input
          type="number"
          min={1}
          max={product.stock}
          value={quantity}
          onChange={(e) => handleQtyChange(e.target.value)}
          className="w-full h-8 rounded-[7px] border border-[#e4e7ec] px-2 text-sm text-center
                     focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
        />
      </td>

      {/* Unit Price */}
      <td className="px-3 py-2 w-32">
        <input
          type="number"
          min={0}
          step={0.01}
          value={salePrice}
          onChange={(e) => handlePriceChange(e.target.value)}
          className="w-full h-8 rounded-[7px] border border-[#e4e7ec] px-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
        />
      </td>

      {/* Discount % */}
      <td className="px-3 py-2 w-24">
        <div className="relative">
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={discountPct}
            onChange={(e) => handleDiscountChange(e.target.value)}
            className="w-full h-8 rounded-[7px] border border-[#e4e7ec] px-2 pr-6 text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#6b7280]">%</span>
        </div>
      </td>

      {/* Total */}
      <td className="px-3 py-2 w-32 text-right">
        <span className="text-sm font-semibold text-[#111827]">
          {formatCurrency(totalAmount, currency)}
        </span>
        {discountPct > 0 && (
          <div className="text-xs text-[#6b7280] line-through">
            {formatCurrency(salePrice * quantity, currency)}
          </div>
        )}
      </td>

      {/* Remove */}
      <td className="px-3 py-2 w-10">
        <button
          type="button"
          onClick={() => removeItem(product.id)}
          className="p-1 rounded-[7px] text-[#6b7280] hover:text-[#dc2626] hover:bg-[#fee2e2]
                     transition-colors"
          title="Remove item"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}