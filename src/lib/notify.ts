// src/lib/notify.ts
import { toast } from "sonner";
import { getSqlite } from "@/db";

// Wraps any async action with loading / success / error toasts.
export async function withToast<T>(
  action: () => Promise<T>,
  messages: { loading?: string; success: string | ((r: T) => string); error?: string }
): Promise<T | undefined> {
  const p = action();
  toast.promise(p, {
    loading: messages.loading ?? "Working…",
    success: (r) => (typeof messages.success === "function" ? messages.success(r as T) : messages.success),
    error: (e) => (e instanceof Error ? e.message : messages.error ?? "Something went wrong"),
  });
  try {
    return await p;
  } catch {
    return undefined; // error already shown by toast.promise
  }
}

// Call AFTER createSale has committed (never inside the transaction).
export async function notifyLowStock(productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  try {
    const sqlite = getSqlite();
    const placeholders = productIds.map(() => "?").join(",");
    const rows = await sqlite.select<{ name: string; stock: number; min_stock: number; unit: string }[]>(
      `SELECT name, stock, min_stock, unit FROM products
        WHERE id IN (${placeholders}) AND stock <= min_stock`,
      productIds
    );
    for (const p of rows) {
      const msg = p.stock <= 0
        ? `${p.name} is now OUT OF STOCK`
        : `Low stock: ${p.name} — only ${p.stock} ${p.unit} left (min ${p.min_stock})`;
      if (p.stock <= 0) toast.error(msg); else toast.warning(msg);
    }
  } catch (err) {
    console.error("[notifyLowStock]", err);
  }
}