// // src/hooks/usePurchases.ts
// import { useState, useEffect, useCallback } from "react";
// import { getDb, getSqlite } from "@/db";
// import { withTransaction } from "@/db/transaction";
// import { purchases, purchaseItems, products, suppliers, payments, auditLog } from "@/db/schema";
// import { eq, and, desc, like, gte, lte, sql, count } from "drizzle-orm";
// import { generateId, nowISO, todayDate } from "@/lib/utils";
// import { calcNewAvgCost } from "@/lib/wac";
// import { MOVEMENT_TYPES, AUDIT_EVENTS, ITEMS_PER_PAGE } from "@/lib/constants";
// import type { Purchase, PurchaseWithItems, PurchaseItem, Product } from "@/types";


import { useState, useEffect, useCallback } from "react";
import {  getSqlite } from "@/db";
import { withTransaction } from "@/db/transaction";
// import { purchases, purchaseItems, products, suppliers, payments, auditLog } from "@/db/schema";
// import { eq, and, desc, like, gte, lte, sql, count } from "drizzle-orm";
import { generateId, nowISO } from "@/lib/utils";
import { calcNewAvgCost } from "@/lib/wac";
import { MOVEMENT_TYPES, AUDIT_EVENTS, ITEMS_PER_PAGE } from "@/lib/constants";
import type { PurchaseWithItems, PurchaseItem, Product } from "@/types";



interface UsePurchasesOptions {
  page?: number;
  search?: string;
  supplierId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface UsePurchasesReturn {
  data: PurchaseWithItems[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePurchases(options: UsePurchasesOptions = {}): UsePurchasesReturn {
  const { page = 1, search = "", supplierId, status, dateFrom, dateTo } = options;
  const [data, setData] = useState<PurchaseWithItems[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const sqlite = getSqlite();

        const conditions: string[] = ["p.is_cancelled = 0"];
        const params: unknown[] = [];

        if (search) {
          conditions.push("(p.invoice_no LIKE ? OR s.name LIKE ?)");
          params.push(`%${search}%`, `%${search}%`);
        }
        if (supplierId) {
          conditions.push("p.supplier_id = ?");
          params.push(supplierId);
        }
        if (status) {
          conditions.push("p.payment_status = ?");
          params.push(status);
        }
        if (dateFrom) {
          conditions.push("p.purchase_date >= ?");
          params.push(dateFrom);
        }
        if (dateTo) {
          conditions.push("p.purchase_date <= ?");
          params.push(dateTo);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const offset = (page - 1) * ITEMS_PER_PAGE;

        const countResult = await sqlite.select<{ total: number }[]>(
          `SELECT COUNT(*) AS total FROM purchases p
           LEFT JOIN suppliers s ON s.id = p.supplier_id
           ${whereClause}`,
          params
        );
        const total = countResult[0]?.total ?? 0;

        const rows = await sqlite.select<{
          id: string; supplier_id: string | null; invoice_no: string | null;
          total_amount: number; paid_amount: number; payment_status: string;
          payment_method: string | null; notes: string | null; purchase_date: string;
          is_cancelled: number; cancel_reason: string | null;
          created_at: string; updated_at: string;
          supplier_name: string | null; supplier_phone: string | null;
          supplier_city: string | null;
        }[]>(
          `SELECT p.*, s.name AS supplier_name, s.phone AS supplier_phone, s.city AS supplier_city
           FROM purchases p
           LEFT JOIN suppliers s ON s.id = p.supplier_id
           ${whereClause}
           ORDER BY p.purchase_date DESC, p.created_at DESC
           LIMIT ? OFFSET ?`,
          [...params, ITEMS_PER_PAGE, offset]
        );

        const enriched: PurchaseWithItems[] = await Promise.all(
          rows.map(async (row) => {
            const itemRows = await sqlite.select<{
              id: string; purchase_id: string; product_id: string;
              quantity: number; cost_price: number; total_cost: number;
              product_name: string; product_category: string; product_unit: string;
              product_avg_cost: number; product_sale_price: number; product_stock: number;
              product_damaged_stock: number; product_min_stock: number;
              product_is_active: number; product_created_at: string; product_updated_at: string;
              product_brand: string | null; product_barcode: string | null;
              product_description: string | null;
            }[]>(
              `SELECT pi.*, pr.name AS product_name, pr.category AS product_category,
                      pr.unit AS product_unit, pr.avg_cost AS product_avg_cost,
                      pr.sale_price AS product_sale_price, pr.stock AS product_stock,
                      pr.damaged_stock AS product_damaged_stock, pr.min_stock AS product_min_stock,
                      pr.is_active AS product_is_active, pr.created_at AS product_created_at,
                      pr.updated_at AS product_updated_at, pr.brand AS product_brand,
                      pr.barcode AS product_barcode, pr.description AS product_description
               FROM purchase_items pi
               JOIN products pr ON pr.id = pi.product_id
               WHERE pi.purchase_id = ?`,
              [row.id]
            );

            const items: (PurchaseItem & { product: Product })[] = itemRows.map((ir) => ({
              id: ir.id,
              purchaseId: ir.purchase_id,
              productId: ir.product_id,
              quantity: ir.quantity,
              costPrice: ir.cost_price,
              totalCost: ir.total_cost,
              product: {
                id: ir.product_id,
                name: ir.product_name,
                category: ir.product_category,
                brand: ir.product_brand,
                unit: ir.product_unit,
                barcode: ir.product_barcode,
                avgCost: ir.product_avg_cost,
                salePrice: ir.product_sale_price,
                stock: ir.product_stock,
                damagedStock: ir.product_damaged_stock,
                minStock: ir.product_min_stock,
                description: ir.product_description,
                isActive: ir.product_is_active === 1,
                createdAt: ir.product_created_at,
                updatedAt: ir.product_updated_at,
              },
            }));

            const supplier = row.supplier_id
              ? {
                  id: row.supplier_id,
                  name: row.supplier_name ?? "",
                  contactPerson: null,
                  phone: row.supplier_phone,
                  city: row.supplier_city,
                  address: null,
                  notes: null,
                  outstandingBalance: 0,
                  isActive: true,
                  createdAt: "",
                  updatedAt: "",
                }
              : null;

            return {
              id: row.id,
              supplierId: row.supplier_id,
              invoiceNo: row.invoice_no,
              totalAmount: row.total_amount,
              paidAmount: row.paid_amount,
              paymentStatus: row.payment_status,
              paymentMethod: row.payment_method,
              notes: row.notes,
              purchaseDate: row.purchase_date,
              isCancelled: row.is_cancelled === 1,
              cancelReason: row.cancel_reason,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              items,
              supplier,
            };
          })
        );

        if (!cancelled) {
          setData(enriched);
          setTotalCount(total);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [page, search, supplierId, status, dateFrom, dateTo, tick]);

  return { data, totalCount, isLoading, error, refetch };
}

// ─── usePurchase (single) ────────────────────────────────────────────────────

interface UsePurchaseReturn {
  data: PurchaseWithItems | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePurchase(id: string | undefined): UsePurchaseReturn {
  const [data, setData] = useState<PurchaseWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!id) { setIsLoading(false); return; }
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const sqlite = getSqlite();
        const rows = await sqlite.select<{
          id: string; supplier_id: string | null; invoice_no: string | null;
          total_amount: number; paid_amount: number; payment_status: string;
          payment_method: string | null; notes: string | null; purchase_date: string;
          is_cancelled: number; cancel_reason: string | null;
          created_at: string; updated_at: string;
          supplier_name: string | null; supplier_phone: string | null;
          supplier_city: string | null; supplier_contact: string | null;
          supplier_address: string | null; supplier_outstanding: number;
          supplier_active: number;
        }[]>(
          `SELECT p.*, s.name AS supplier_name, s.phone AS supplier_phone,
                  s.city AS supplier_city, s.contact_person AS supplier_contact,
                  s.address AS supplier_address,
                  s.outstanding_balance AS supplier_outstanding,
                  s.is_active AS supplier_active
           FROM purchases p
           LEFT JOIN suppliers s ON s.id = p.supplier_id
           WHERE p.id = ?`,
          [id]
        );
        if (rows.length === 0) { if (!cancelled) setData(null); return; }
        const row = rows[0];

        const itemRows = await sqlite.select<{
          id: string; purchase_id: string; product_id: string;
          quantity: number; cost_price: number; total_cost: number;
          product_name: string; product_category: string; product_unit: string;
          product_avg_cost: number; product_sale_price: number; product_stock: number;
          product_damaged_stock: number; product_min_stock: number;
          product_is_active: number; product_created_at: string; product_updated_at: string;
          product_brand: string | null; product_barcode: string | null;
          product_description: string | null;
        }[]>(
          `SELECT pi.*, pr.name AS product_name, pr.category AS product_category,
                  pr.unit AS product_unit, pr.avg_cost AS product_avg_cost,
                  pr.sale_price AS product_sale_price, pr.stock AS product_stock,
                  pr.damaged_stock AS product_damaged_stock, pr.min_stock AS product_min_stock,
                  pr.is_active AS product_is_active, pr.created_at AS product_created_at,
                  pr.updated_at AS product_updated_at, pr.brand AS product_brand,
                  pr.barcode AS product_barcode, pr.description AS product_description
           FROM purchase_items pi
           JOIN products pr ON pr.id = pi.product_id
           WHERE pi.purchase_id = ?`,
          [id]
        );

        const items: (PurchaseItem & { product: Product })[] = itemRows.map((ir) => ({
          id: ir.id,
          purchaseId: ir.purchase_id,
          productId: ir.product_id,
          quantity: ir.quantity,
          costPrice: ir.cost_price,
          totalCost: ir.total_cost,
          product: {
            id: ir.product_id,
            name: ir.product_name,
            category: ir.product_category,
            brand: ir.product_brand,
            unit: ir.product_unit,
            barcode: ir.product_barcode,
            avgCost: ir.product_avg_cost,
            salePrice: ir.product_sale_price,
            stock: ir.product_stock,
            damagedStock: ir.product_damaged_stock,
            minStock: ir.product_min_stock,
            description: ir.product_description,
            isActive: ir.product_is_active === 1,
            createdAt: ir.product_created_at,
            updatedAt: ir.product_updated_at,
          },
        }));

        const supplier = row.supplier_id
          ? {
              id: row.supplier_id,
              name: row.supplier_name ?? "",
              contactPerson: row.supplier_contact,
              phone: row.supplier_phone,
              city: row.supplier_city,
              address: row.supplier_address,
              notes: null,
              outstandingBalance: row.supplier_outstanding,
              isActive: row.supplier_active === 1,
              createdAt: "",
              updatedAt: "",
            }
          : null;

        if (!cancelled) {
          setData({
            id: row.id,
            supplierId: row.supplier_id,
            invoiceNo: row.invoice_no,
            totalAmount: row.total_amount,
            paidAmount: row.paid_amount,
            paymentStatus: row.payment_status,
            paymentMethod: row.payment_method,
            notes: row.notes,
            purchaseDate: row.purchase_date,
            isCancelled: row.is_cancelled === 1,
            cancelReason: row.cancel_reason,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            items,
            supplier,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id, tick]);

  return { data, isLoading, error, refetch };
}

// ─── CREATE PURCHASE ─────────────────────────────────────────────────────────

export interface CreatePurchaseInput {
  supplierId: string | null;
  invoiceNo: string;
  purchaseDate: string;
  paymentMethod: string | null;
  paidAmount: number;
  notes: string;
  items: Array<{
    productId: string;
    quantity: number;
    costPrice: number;
  }>;
}

export async function createPurchase(input: CreatePurchaseInput): Promise<string> {
  const now = nowISO();
  const purchaseId = generateId();

  // Validate
  if (input.items.length === 0) throw new Error("Purchase must have at least one item.");
  for (const item of input.items) {
    if (item.quantity <= 0) throw new Error("All quantities must be greater than 0.");
    if (item.costPrice < 0) throw new Error("Cost price cannot be negative.");
  }

  const totalAmount = input.items.reduce((sum, i) => sum + i.quantity * i.costPrice, 0);
  const paidAmount = Math.min(input.paidAmount, totalAmount);
  const paymentStatus =
    paidAmount >= totalAmount ? "paid" : paidAmount > 0 ? "partial" : "unpaid";

  await withTransaction(async () => {
    const sqlite = getSqlite();

    // Insert purchase
    await sqlite.execute(
      `INSERT INTO purchases (id, supplier_id, invoice_no, total_amount, paid_amount,
        payment_status, payment_method, notes, purchase_date, is_cancelled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        purchaseId,
        input.supplierId || null,
        input.invoiceNo || null,
        totalAmount,
        paidAmount,
        paymentStatus,
        paidAmount > 0 ? (input.paymentMethod || "cash") : null,
        input.notes || null,
        input.purchaseDate,
        now,
        now,
      ]
    );

    // Process each item
    for (const item of input.items) {
      const itemId = generateId();

      // Read current product state
      const productRows = await sqlite.select<{
        stock: number; avg_cost: number;
      }[]>(
        "SELECT stock, avg_cost FROM products WHERE id = ?",
        [item.productId]
      );
      if (productRows.length === 0) throw new Error(`Product not found: ${item.productId}`);
      const product = productRows[0];

      // Insert purchase item
      await sqlite.execute(
        `INSERT INTO purchase_items (id, purchase_id, product_id, quantity, cost_price, total_cost)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [itemId, purchaseId, item.productId, item.quantity, item.costPrice, item.quantity * item.costPrice]
      );

      // WAC recalculation — purchase_in triggers WAC update
      const newAvgCost = calcNewAvgCost(
        product.stock,
        product.avg_cost,
        item.quantity,
        item.costPrice
      );
      const newStock = product.stock + item.quantity;

      // Update product stock + avgCost
      await sqlite.execute(
        "UPDATE products SET stock = ?, avg_cost = ?, updated_at = ? WHERE id = ?",
        [newStock, newAvgCost, now, item.productId]
      );

      // Stock movement: purchase_in
      await sqlite.execute(
        `INSERT INTO stock_movements (id, product_id, movement_type, quantity, cost_price,
          reference_type, reference_id, stock_before, stock_after, notes, created_at)
         VALUES (?, ?, ?, ?, ?, 'purchase', ?, ?, ?, ?, ?)`,
        [
          generateId(),
          item.productId,
          MOVEMENT_TYPES.PURCHASE_IN,
          item.quantity,
          item.costPrice,
          purchaseId,
          product.stock,
          newStock,
          null,
          now,
        ]
      );
    }

    // If paid amount > 0, insert payment row
    if (paidAmount > 0 && input.supplierId) {
      await sqlite.execute(
        `INSERT INTO payments (id, type, party_id, reference_id, amount, payment_method,
          payment_date, is_refund, is_reversed, created_at)
         VALUES (?, 'supplier', ?, ?, ?, ?, ?, 0, 0, ?)`,
        [
          generateId(),
          input.supplierId,
          purchaseId,
          paidAmount,
          input.paymentMethod || "cash",
          input.purchaseDate,
          now,
        ]
      );
    }

    // Update supplier outstanding balance
    if (input.supplierId) {
      const balanceDue = totalAmount - paidAmount;
      if (balanceDue > 0) {
        await sqlite.execute(
          "UPDATE suppliers SET outstanding_balance = outstanding_balance + ?, updated_at = ? WHERE id = ?",
          [balanceDue, now, input.supplierId]
        );
      }
    }

    // Audit log
    await sqlite.execute(
      `INSERT INTO audit_log (id, event_type, entity_type, entity_id, description, new_values, created_at)
       VALUES (?, ?, 'purchase', ?, ?, ?, ?)`,
      [
        generateId(),
        AUDIT_EVENTS.PURCHASE_CREATED,
        purchaseId,
        `Purchase created: ${input.invoiceNo || purchaseId} — Rs. ${totalAmount.toFixed(2)}`,
        JSON.stringify({ totalAmount, paidAmount, paymentStatus, itemCount: input.items.length }),
        now,
      ]
    );
  });

  return purchaseId;
}

// ─── CANCEL PURCHASE ─────────────────────────────────────────────────────────

export async function cancelPurchase(purchaseId: string, reason: string): Promise<void> {
  const sqlite = getSqlite();
  const now = nowISO();

  // Pre-flight checks (outside transaction — read-only)
  const purchaseRows = await sqlite.select<{
    id: string; payment_status: string; is_cancelled: number;
    supplier_id: string | null; total_amount: number; paid_amount: number;
    invoice_no: string | null;
  }[]>(
    "SELECT id, payment_status, is_cancelled, supplier_id, total_amount, paid_amount, invoice_no FROM purchases WHERE id = ?",
    [purchaseId]
  );

  if (purchaseRows.length === 0) throw new Error("Purchase not found.");
  const purchase = purchaseRows[0];

  if (purchase.is_cancelled === 1) throw new Error("This purchase is already cancelled.");

  if (purchase.payment_status !== "unpaid") {
    throw new Error(
      "Cannot cancel this purchase — payments have been recorded. Use a purchase return instead."
    );
  }

  // Check for any non-reversed payments linked to this purchase
  const linkedPayments = await sqlite.select<{ c: number }[]>(
    "SELECT COUNT(*) AS c FROM payments WHERE reference_id = ? AND is_reversed = 0",
    [purchaseId]
  );
  if ((linkedPayments[0]?.c ?? 0) > 0) {
    throw new Error(
      "Cannot cancel this purchase — payments have been recorded. Reverse them first."
    );
  }

  // Read items before transaction
  const itemRows = await sqlite.select<{
    product_id: string; quantity: number; cost_price: number;
  }[]>(
    "SELECT product_id, quantity, cost_price FROM purchase_items WHERE purchase_id = ?",
    [purchaseId]
  );

  await withTransaction(async () => {
    const sqlite = getSqlite();

    // Mark purchase as cancelled
    await sqlite.execute(
      "UPDATE purchases SET is_cancelled = 1, cancel_reason = ?, updated_at = ? WHERE id = ?",
      [reason || null, now, purchaseId]
    );

    // For each item: decrement stock, insert movement (NO WAC change per Financial Rules §7)
    for (const item of itemRows) {
      const productRows = await sqlite.select<{ stock: number; avg_cost: number }[]>(
        "SELECT stock, avg_cost FROM products WHERE id = ?",
        [item.product_id]
      );
      if (productRows.length === 0) continue;
      const product = productRows[0];

      const newStock = Math.max(0, product.stock - item.quantity);

      // Decrement product stock — avgCost is NOT changed
      await sqlite.execute(
        "UPDATE products SET stock = ?, updated_at = ? WHERE id = ?",
        [newStock, now, item.product_id]
      );

      // Stock movement: purchase_cancelled (subtractive, WAC unchanged)
      await sqlite.execute(
        `INSERT INTO stock_movements (id, product_id, movement_type, quantity, cost_price,
          reference_type, reference_id, stock_before, stock_after, notes, created_at)
         VALUES (?, ?, ?, ?, ?, 'purchase', ?, ?, ?, ?, ?)`,
        [
          generateId(),
          item.product_id,
          MOVEMENT_TYPES.PURCHASE_CANCELLED,
          item.quantity,
          item.cost_price,
          purchaseId,
          product.stock,
          newStock,
          `Purchase cancelled: ${reason || "No reason given"}`,
          now,
        ]
      );
    }

    // Update supplier outstanding balance (reverse the unpaid portion)
    if (purchase.supplier_id) {
      const balanceDue = purchase.total_amount - purchase.paid_amount;
      if (balanceDue > 0) {
        await sqlite.execute(
          "UPDATE suppliers SET outstanding_balance = MAX(0, outstanding_balance - ?), updated_at = ? WHERE id = ?",
          [balanceDue, now, purchase.supplier_id]
        );
      }
    }

    // Audit log
    await sqlite.execute(
      `INSERT INTO audit_log (id, event_type, entity_type, entity_id, description, old_values, created_at)
       VALUES (?, ?, 'purchase', ?, ?, ?, ?)`,
      [
        generateId(),
        AUDIT_EVENTS.PURCHASE_CANCELLED,
        purchaseId,
        `Purchase cancelled: ${purchase.invoice_no || purchaseId}. Reason: ${reason || "None"}`,
        JSON.stringify({ previousStatus: purchase.payment_status, totalAmount: purchase.total_amount }),
        now,
      ]
    );
  });
}

// ─── RECORD PURCHASE PAYMENT ─────────────────────────────────────────────────

export interface RecordPurchasePaymentInput {
  purchaseId: string;
  supplierId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  chequeNo?: string;
  bankName?: string;
  notes?: string;
}

export async function recordPurchasePayment(input: RecordPurchasePaymentInput): Promise<void> {
  const now = nowISO();

  // Read current purchase state
  const sqlite = getSqlite();
  const purchaseRows = await sqlite.select<{
    total_amount: number; paid_amount: number; payment_status: string; is_cancelled: number;
  }[]>(
    "SELECT total_amount, paid_amount, payment_status, is_cancelled FROM purchases WHERE id = ?",
    [input.purchaseId]
  );
  if (purchaseRows.length === 0) throw new Error("Purchase not found.");
  const purchase = purchaseRows[0];
  if (purchase.is_cancelled === 1) throw new Error("Cannot record payment on a cancelled purchase.");
  if (purchase.payment_status === "paid") throw new Error("This purchase is already fully paid.");

  const maxPayable = purchase.total_amount - purchase.paid_amount;
  if (input.amount <= 0) throw new Error("Payment amount must be greater than 0.");
  if (input.amount > maxPayable) throw new Error(`Maximum payable is Rs. ${maxPayable.toFixed(2)}.`);

  await withTransaction(async () => {
    const sqlite = getSqlite();

    const newPaidAmount = purchase.paid_amount + input.amount;
    const newStatus = newPaidAmount >= purchase.total_amount ? "paid" : "partial";

    // Insert payment row
    await sqlite.execute(
      `INSERT INTO payments (id, type, party_id, reference_id, amount, payment_method,
        cheque_no, bank_name, notes, payment_date, is_refund, is_reversed, created_at)
       VALUES (?, 'supplier', ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
      [
        generateId(),
        input.supplierId,
        input.purchaseId,
        input.amount,
        input.paymentMethod,
        input.chequeNo || null,
        input.bankName || null,
        input.notes || null,
        input.paymentDate,
        now,
      ]
    );

    // Update purchase paid_amount + status
    await sqlite.execute(
      "UPDATE purchases SET paid_amount = ?, payment_status = ?, updated_at = ? WHERE id = ?",
      [newPaidAmount, newStatus, now, input.purchaseId]
    );

    // Reduce supplier outstanding balance
    await sqlite.execute(
      "UPDATE suppliers SET outstanding_balance = MAX(0, outstanding_balance - ?), updated_at = ? WHERE id = ?",
      [input.amount, now, input.supplierId]
    );

    // Audit log
    await sqlite.execute(
      `INSERT INTO audit_log (id, event_type, entity_type, entity_id, description, new_values, created_at)
       VALUES (?, ?, 'purchase', ?, ?, ?, ?)`,
      [
        generateId(),
        AUDIT_EVENTS.PURCHASE_PAYMENT,
        input.purchaseId,
        `Payment of Rs. ${input.amount.toFixed(2)} recorded via ${input.paymentMethod}`,
        JSON.stringify({ amount: input.amount, newStatus, paymentMethod: input.paymentMethod }),
        now,
      ]
    );
  });
}