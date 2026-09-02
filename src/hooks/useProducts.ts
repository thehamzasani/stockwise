// src/hooks/useProducts.ts
import { useState, useEffect } from "react";
import { getSqlite } from "@/db";
import { withTransaction } from "@/db/transaction";
import { generateId, nowISO} from "@/lib/utils";
import { calcNewAvgCost } from "@/lib/wac";
import { MOVEMENT_TYPES, AUDIT_EVENTS } from "@/lib/constants";
import type { Product, NewProduct } from "@/types";
import { ITEMS_PER_PAGE } from "@/lib/constants";

interface UseProductsOptions {
  search?: string;
  category?: string;
  showInactive?: boolean;
  page?: number;
}

interface UseProductsResult {
  data: Product[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useProducts(opts: UseProductsOptions = {}): UseProductsResult {
  const { search = "", category = "", showInactive = false, page = 1 } = opts;
  const [data, setData] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const sqlite = getSqlite();
        const offset = (page - 1) * ITEMS_PER_PAGE;
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (!showInactive) {
          conditions.push("is_active = 1");
        }
        if (search) {
          conditions.push("(name LIKE ? OR barcode LIKE ? OR brand LIKE ?)");
          params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (category) {
          conditions.push("category = ?");
          params.push(category);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const countResult = await sqlite.select<{ c: number }[]>(
          `SELECT COUNT(*) AS c FROM products ${where}`,
          params
        );

        const rows = await sqlite.select<Product[]>(
          `SELECT * FROM products ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
          [...params, ITEMS_PER_PAGE, offset]
        );

        if (!cancelled) {
          setTotalCount(countResult[0]?.c ?? 0);
          setData(rows);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [search, category, showInactive, page, tick]);

  return { data, totalCount, isLoading, error, refetch: () => setTick((t) => t + 1) };
}

interface UseSingleProductResult {
  data: Product | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useProduct(id: string): UseSingleProductResult {
  const [data, setData] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!id) { setIsLoading(false); return; }
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const sqlite = getSqlite();
        const rows = await sqlite.select<Product[]>(
          "SELECT * FROM products WHERE id = ?", [id]
        );
        if (!cancelled) setData(rows[0] ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id, tick]);

  return { data, isLoading, error, refetch: () => setTick((t) => t + 1) };
}

export async function createProduct(input: Omit<NewProduct, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const id = generateId();
  const now = nowISO();
  const sqlite = getSqlite();

  await sqlite.execute(
    `INSERT INTO products (id, name, category, brand, unit, barcode, avg_cost, sale_price,
      stock, damaged_stock, min_stock, description, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.category,
      input.brand ?? null,
      input.unit ?? "pcs",
      input.barcode ?? null,
      input.avgCost ?? 0,
      input.salePrice ?? 0,
      input.stock ?? 0,
      input.damagedStock ?? 0,
      input.minStock ?? 5,
      input.description ?? null,
      input.isActive ?? true ? 1 : 0,
      now,
      now,
    ]
  );

  await sqlite.execute(
    `INSERT INTO audit_log (id, event_type, entity_type, entity_id, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [generateId(), AUDIT_EVENTS.STOCK_ADJUSTED, "product", id, `Product created: ${input.name}`, now]
  );

  return id;
}

export async function updateProduct(
  id: string,
  input: Partial<Omit<NewProduct, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  const now = nowISO();
  const sqlite = getSqlite();

  const fields: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined)        { fields.push("name = ?");         params.push(input.name); }
  if (input.category !== undefined)    { fields.push("category = ?");     params.push(input.category); }
  if (input.brand !== undefined)       { fields.push("brand = ?");        params.push(input.brand); }
  if (input.unit !== undefined)        { fields.push("unit = ?");         params.push(input.unit); }
  if (input.barcode !== undefined)     { fields.push("barcode = ?");      params.push(input.barcode); }
  if (input.salePrice !== undefined)   { fields.push("sale_price = ?");   params.push(input.salePrice); }
  if (input.minStock !== undefined)    { fields.push("min_stock = ?");    params.push(input.minStock); }
  if (input.description !== undefined) { fields.push("description = ?");  params.push(input.description); }
  if (input.isActive !== undefined)    { fields.push("is_active = ?");    params.push(input.isActive ? 1 : 0); }

  if (fields.length === 0) return;

  fields.push("updated_at = ?");
  params.push(now, id);

  await sqlite.execute(
    `UPDATE products SET ${fields.join(", ")} WHERE id = ?`,
    params
  );

  await sqlite.execute(
    `INSERT INTO audit_log (id, event_type, entity_type, entity_id, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [generateId(), AUDIT_EVENTS.STOCK_ADJUSTED, "product", id, `Product updated: ${id}`, now]
  );
}

export async function deleteProduct(id: string): Promise<void> {
  const now = nowISO();
  const sqlite = getSqlite();
  // Soft delete — set isActive = false
  await sqlite.execute(
    "UPDATE products SET is_active = 0, updated_at = ? WHERE id = ?",
    [now, id]
  );
  await sqlite.execute(
    `INSERT INTO audit_log (id, event_type, entity_type, entity_id, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [generateId(), AUDIT_EVENTS.STOCK_ADJUSTED, "product", id, `Product deactivated: ${id}`, now]
  );
}

export type AdjustStockType = "adjustment_add" | "adjustment_remove" | "correction";

export interface AdjustStockInput {
  productId: string;
  type: AdjustStockType;
  // For adjustment_add / adjustment_remove: the qty to add or remove.
  // For correction: the NEW exact stock count to set.
  quantity: number;
  // For adjustment_add: the cost price of the incoming units (used for WAC).
  costPrice?: number;
  notes?: string;
}

export async function adjustStock(input: AdjustStockInput): Promise<void> {
  const now = nowISO();

  await withTransaction(async () => {
    const sqlite = getSqlite();

    const rows = await sqlite.select<{ stock: number; avg_cost: number }[]>(
      "SELECT stock, avg_cost FROM products WHERE id = ?",
      [input.productId]
    );
    if (rows.length === 0) throw new Error("Product not found.");
    const { stock: currentStock, avg_cost: currentAvgCost } = rows[0];

    let newStock: number;
    let newAvgCost: number = currentAvgCost;
    let movementQty: number;
    let stockBefore: number = currentStock;
    let stockAfter: number;
    let movementType: string;

    if (input.type === "adjustment_add") {
      const incomingCost = input.costPrice ?? currentAvgCost;
      newAvgCost = calcNewAvgCost(currentStock, currentAvgCost, input.quantity, incomingCost);
      newStock = currentStock + input.quantity;
      movementQty = input.quantity;
      stockAfter = newStock;
      movementType = MOVEMENT_TYPES.ADJUSTMENT_ADD;
    } else if (input.type === "adjustment_remove") {
      if (input.quantity > currentStock) {
        throw new Error(`Cannot remove ${input.quantity} units. Only ${currentStock} in stock.`);
      }
      newStock = currentStock - input.quantity;
      movementQty = input.quantity;
      stockAfter = newStock;
      movementType = MOVEMENT_TYPES.ADJUSTMENT_REMOVE;
      // WAC unchanged
    } else {
      // correction: set exact count
      newStock = input.quantity;
      movementQty = Math.abs(newStock - currentStock);
      stockAfter = newStock;
      movementType = MOVEMENT_TYPES.CORRECTION;
      // WAC unchanged
    }

    await sqlite.execute(
      "UPDATE products SET stock = ?, avg_cost = ?, updated_at = ? WHERE id = ?",
      [newStock, newAvgCost, now, input.productId]
    );

    await sqlite.execute(
      `INSERT INTO stock_movements
        (id, product_id, movement_type, quantity, cost_price, reference_type, reference_id,
         stock_before, stock_after, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        input.productId,
        movementType,
        movementQty,
        newAvgCost,
        "adjustment",
        null,
        stockBefore,
        stockAfter,
        input.notes ?? null,
        now,
      ]
    );

    await sqlite.execute(
      `INSERT INTO audit_log (id, event_type, entity_type, entity_id, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        AUDIT_EVENTS.STOCK_ADJUSTED,
        "product",
        input.productId,
        `Stock ${input.type}: ${stockBefore} → ${stockAfter}${input.notes ? ` — ${input.notes}` : ""}`,
        now,
      ]
    );
  });
}

// Exported hook for components that need all products for a select/search
export function useAllActiveProducts() {
  const [data, setData] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const sqlite = getSqlite();
        const rows = await sqlite.select<Product[]>(
          "SELECT * FROM products WHERE is_active = 1 ORDER BY name ASC"
        );
        if (!cancelled) setData(rows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [tick]);

  return { data, isLoading, error, refetch: () => setTick((t) => t + 1) };
}