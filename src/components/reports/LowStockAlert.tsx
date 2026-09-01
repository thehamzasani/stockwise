// src/components/reports/LowStockAlert.tsx
import { AlertTriangle, Package } from "lucide-react";
import type { LowStockProduct } from "@/types";
import { useNavigate } from "@/lib/navigation";

interface LowStockAlertProps {
  products: LowStockProduct[];
  isLoading?: boolean;
}

function StockBar({ pct }: { pct: number }) {
  const color =
    pct === 0 ? "#dc2626" : pct <= 25 ? "#dc2626" : pct <= 50 ? "#d97706" : "#16a34a";
  return (
    <div className="h-1.5 w-16 rounded-full bg-gray-100">
      <div
        className="h-1.5 rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(4, pct))}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function LowStockAlert({ products, isLoading = false }: LowStockAlertProps) {
  const navigate = useNavigate();

  return (
    <div className="rounded-lg border border-[#e4e7ec] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[#d97706]" />
          <h3 className="text-sm font-semibold text-[#111827]">Low Stock</h3>
        </div>
        <button
          onClick={() => navigate("inventory")}
          className="text-xs text-[#2563eb] hover:underline"
        >
          View all
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gray-100 animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-32 rounded bg-gray-100 animate-pulse" />
                <div className="h-2.5 w-20 rounded bg-gray-100 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center">
          <Package className="mb-2 h-8 w-8 text-[#d1d5db]" />
          <p className="text-sm text-[#6b7280]">All products are well-stocked</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {products.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate("inventory/edit", { id: p.id })}
              className="flex cursor-pointer items-center gap-3 rounded-[7px] p-2 hover:bg-[#f9fafb]"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#fff7ed]">
                <Package className="h-4 w-4 text-[#d97706]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[#111827]">{p.name}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <StockBar pct={p.percentRemaining} />
                  <span
                    className={
                      p.stock === 0
                        ? "text-xs font-semibold text-[#dc2626]"
                        : "text-xs text-[#6b7280]"
                    }
                  >
                    {p.stock === 0 ? "Out of stock" : `${p.stock} / ${p.minStock} min`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}