// src/components/purchases/PurchaseItemRow.tsx
import { Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/types";

export interface PurchaseLineItem {
  product: Product;
  quantity: number;
  costPrice: number;
  totalCost: number;
}

interface PurchaseItemRowProps {
  item: PurchaseLineItem;
  index: number;
  onUpdate: (productId: string, updates: Partial<Omit<PurchaseLineItem, "product">>) => void;
  onRemove: (productId: string) => void;
}

export function PurchaseItemRow({ item, index, onUpdate, onRemove }: PurchaseItemRowProps) {
  function handleQuantityChange(raw: string) {
    const qty = parseInt(raw, 10);
    if (isNaN(qty) || qty < 1) return;
    const totalCost = qty * item.costPrice;
    onUpdate(item.product.id, { quantity: qty, totalCost });
  }

  function handleCostPriceChange(raw: string) {
    const price = parseFloat(raw);
    if (isNaN(price) || price < 0) return;
    const totalCost = item.quantity * price;
    onUpdate(item.product.id, { costPrice: price, totalCost });
  }

  return (
    <tr className="border-b border-[#e4e7ec] hover:bg-[#f9fafb]">
      {/* # */}
      <td className="px-3 py-2 text-sm text-[#6b7280] w-8">{index + 1}</td>

      {/* Product */}
      <td className="px-3 py-2">
        <div className="text-sm font-medium text-[#111827]">{item.product.name}</div>
        <div className="text-xs text-[#6b7280]">{item.product.category} · {item.product.unit}</div>
        {item.product.brand && (
          <div className="text-xs text-[#9ca3af]">{item.product.brand}</div>
        )}
      </td>

      {/* Current Stock */}
      <td className="px-3 py-2 text-sm text-[#6b7280] text-center">
        {item.product.stock}
      </td>

      {/* Quantity */}
      <td className="px-3 py-2 w-24">
        <input
          type="number"
          min="1"
          value={item.quantity}
          onChange={(e) => handleQuantityChange(e.target.value)}
          className="w-full h-8 rounded-[7px] border border-[#e4e7ec] px-2 text-sm text-[#111827]
                     focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent
                     text-center"
        />
      </td>

      {/* Cost Price */}
      <td className="px-3 py-2 w-32">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-[#6b7280]">Rs.</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={item.costPrice}
            onChange={(e) => handleCostPriceChange(e.target.value)}
            className="w-full h-8 rounded-[7px] border border-[#e4e7ec] pl-8 pr-2 text-sm text-[#111827]
                       focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
          />
        </div>
      </td>

      {/* Total */}
      <td className="px-3 py-2 text-sm font-medium text-[#111827] text-right">
        {formatCurrency(item.totalCost)}
      </td>

      {/* Remove */}
      <td className="px-3 py-2 w-10">
        <button
          type="button"
          onClick={() => onRemove(item.product.id)}
          className="p-1 rounded text-[#6b7280] hover:text-[#dc2626] hover:bg-[#fee2e2] transition-colors"
          title="Remove item"
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
}