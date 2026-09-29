// src/hooks/useReturns.ts
import { useCallback, useEffect, useState } from "react";
import { getSqlite } from "@/db";
import { withTransaction } from "@/db/transaction";
import { generateId, nowISO, formatCurrency } from "@/lib/utils";
import { calcNewAvgCost } from "@/lib/wac";
import { AUDIT_EVENTS, MOVEMENT_TYPES, WALKIN_CUSTOMER_ID } from "@/lib/constants";
import type { RefundMethod, ReturnCondition } from "@/types";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ReturnableItem {
  productId: string;
  productName: string;
  ordered: number;      // quantity on the original invoice
  returned: number;     // already returned on earlier return records
  returnable: number;   // ordered - returned
  // Sale:     effective per-unit price AFTER item discount (total_amount / quantity)
  // Purchase: per-unit cost price locked on the purchase item
  unitAmount: number;
  unitCost: number;     // per-unit cost locked on the original line
}

export interface CreateSaleReturnInput {
  saleId: string;
  productId: string;
  quantity: number;
  reason?: string;
  returnCondition: ReturnCondition;
  refundMethod: RefundMethod;
  returnDate: string; // yyyy-MM-dd
}

export interface CreatePurchaseReturnInput {
  purchaseId: string;
  productId: string;
  quantity: number;
  reason?: string;
  returnDate: string; // yyyy-MM-dd
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function insertMovement(m: {
  productId: string;
  movementType: string;
  quantity: number;
  costPrice: number;
  referenceType: string;
  referenceId: string;
  stockBefore: number;
  stockAfter: number;
  notes: string;
  createdAt: string;
}): Promise<void> {
  const sqlite = getSqlite();
  await sqlite.execute(
    `INSERT INTO stock_movements
       (id, product_id, movement_type, quantity, cost_price, reference_type, reference_id,
        stock_before, stock_after, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(), m.productId, m.movementType, m.quantity, m.costPrice,
      m.referenceType, m.referenceId, m.stockBefore, m.stockAfter, m.notes, m.createdAt,
    ]
  );
}

async function insertAudit(a: {
  eventType: string;
  entityType: string;
  entityId: string;
  description: string;
  oldValues: unknown;
  newValues: unknown;
  createdAt: string;
}): Promise<void> {
  const sqlite = getSqlite();
  await sqlite.execute(
    `INSERT INTO audit_log
       (id, event_type, entity_type, entity_id, description, old_values, new_values, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(), a.eventType, a.entityType, a.entityId, a.description,
      JSON.stringify(a.oldValues), JSON.stringify(a.newValues), a.createdAt,
    ]
  );
}

// ─── READ HOOKS (feed ReturnForm) ────────────────────────────────────────────

async function loadSaleItems(saleId: string): Promise<ReturnableItem[]> {
  const sqlite = getSqlite();
  const rows = await sqlite.select<{
    product_id: string; product_name: string; quantity: number;
    total_amount: number; cost_price: number; returned: number;
  }[]>(
    `SELECT si.product_id, p.name AS product_name, si.quantity, si.total_amount, si.cost_price,
            COALESCE((SELECT SUM(sr.quantity) FROM sale_returns sr
                       WHERE sr.sale_id = si.sale_id AND sr.product_id = si.product_id), 0) AS returned
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
      WHERE si.sale_id = ?
      ORDER BY p.name ASC`,
    [saleId]
  );
  return rows.map((r) => ({
    productId: r.product_id,
    productName: r.product_name,
    ordered: r.quantity,
    returned: r.returned,
    returnable: Math.max(0, r.quantity - r.returned),
    unitAmount: r.quantity > 0 ? r.total_amount / r.quantity : 0,
    unitCost: r.cost_price,
  }));
}

async function loadPurchaseItems(purchaseId: string): Promise<ReturnableItem[]> {
  const sqlite = getSqlite();
  const rows = await sqlite.select<{
    product_id: string; product_name: string; quantity: number;
    cost_price: number; returned: number;
  }[]>(
    `SELECT pi.product_id, p.name AS product_name, pi.quantity, pi.cost_price,
            COALESCE((SELECT SUM(pr.quantity) FROM purchase_returns pr
                       WHERE pr.purchase_id = pi.purchase_id AND pr.product_id = pi.product_id), 0) AS returned
       FROM purchase_items pi
       JOIN products p ON p.id = pi.product_id
      WHERE pi.purchase_id = ?
      ORDER BY p.name ASC`,
    [purchaseId]
  );
  return rows.map((r) => ({
    productId: r.product_id,
    productName: r.product_name,
    ordered: r.quantity,
    returned: r.returned,
    returnable: Math.max(0, r.quantity - r.returned),
    unitAmount: r.cost_price,
    unitCost: r.cost_price,
  }));
}

function useReturnableItems(id: string | null, kind: "sale" | "purchase") {
  const [data, setData] = useState<ReturnableItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!id) {
      setData(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    (kind === "sale" ? loadSaleItems(id) : loadPurchaseItems(id))
      .then((rows) => { if (!cancelled) setData(rows); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [id, kind, tick]);

  return { data, isLoading, error, refetch };
}

export function useSaleReturnableItems(saleId: string | null) {
  return useReturnableItems(saleId, "sale");
}

export function usePurchaseReturnableItems(purchaseId: string | null) {
  return useReturnableItems(purchaseId, "purchase");
}

// ─── createSaleReturn ────────────────────────────────────────────────────────

export async function createSaleReturn(
  input: CreateSaleReturnInput
): Promise<{ returnId: string; refundAmount: number }> {
  const { saleId, productId, quantity, reason, returnCondition, refundMethod, returnDate } = input;

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Return quantity must be a whole number greater than 0.");
  }
  if (returnCondition !== "sellable" && returnCondition !== "damaged") {
    throw new Error("Invalid return condition.");
  }
  if (!["credit_note", "cash", "bank", "cheque"].includes(refundMethod)) {
    throw new Error("Invalid refund method.");
  }

  return withTransaction(async () => {
    const sqlite = getSqlite(); // ALL DB access inside uses sqlite — never getDb()
    const now = nowISO();

    // 1. Sale must exist and not be cancelled
    const saleRows = await sqlite.select<{
      id: string; customer_id: string; invoice_no: string; is_cancelled: number;
    }[]>(
      "SELECT id, customer_id, invoice_no, is_cancelled FROM sales WHERE id = ?",
      [saleId]
    );
    const sale = saleRows[0];
    if (!sale) throw new Error("Sale not found.");
    if (sale.is_cancelled) throw new Error("Cannot return items from a cancelled sale.");
    if (sale.customer_id === WALKIN_CUSTOMER_ID && refundMethod === "credit_note") {
      throw new Error("Walk-in customers have no account balance. Refund by cash, bank or cheque.");
    }

    // 2. Original invoice line (locks salePrice / costPrice)
    const itemRows = await sqlite.select<{
      quantity: number; sale_price: number; cost_price: number; total_amount: number;
    }[]>(
      "SELECT quantity, sale_price, cost_price, total_amount FROM sale_items WHERE sale_id = ? AND product_id = ?",
      [saleId, productId]
    );
    const item = itemRows[0];
    if (!item) throw new Error("This product is not on the selected invoice.");

    // 3. Cumulative return limit
    const returnedRows = await sqlite.select<{ total: number }[]>(
      "SELECT COALESCE(SUM(quantity), 0) AS total FROM sale_returns WHERE sale_id = ? AND product_id = ?",
      [saleId, productId]
    );
    const returnable = item.quantity - (returnedRows[0]?.total ?? 0);
    if (quantity > returnable) {
      throw new Error(`Only ${returnable} unit(s) can still be returned for this product.`);
    }

    // 4. Fresh product + customer state
    const productRows = await sqlite.select<{
      id: string; name: string; stock: number; damaged_stock: number; avg_cost: number;
    }[]>(
      "SELECT id, name, stock, damaged_stock, avg_cost FROM products WHERE id = ?",
      [productId]
    );
    const product = productRows[0];
    if (!product) throw new Error("Product not found.");

    const customerRows = await sqlite.select<{ outstanding_balance: number }[]>(
      "SELECT outstanding_balance FROM customers WHERE id = ?",
      [sale.customer_id]
    );
    const customer = customerRows[0];
    if (!customer) throw new Error("Customer not found.");

    // 5. Refund uses the discounted per-unit price (never salePrice × qty)
    const refundAmount = round2((item.total_amount / item.quantity) * quantity);
    const returnId = generateId();

    // 6. sale_returns record
    await sqlite.execute(
      `INSERT INTO sale_returns
         (id, sale_id, product_id, quantity, sale_price, cost_price, reason,
          return_condition, refund_amount, refund_method, return_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        returnId, saleId, productId, quantity, item.sale_price, item.cost_price,
        reason?.trim() || null, returnCondition, refundAmount, refundMethod, returnDate, now,
      ]
    );

    // 7. Stock
    let newStock = product.stock;
    let newDamaged = product.damaged_stock;
    let newAvgCost = product.avg_cost;

    if (returnCondition === "sellable") {
      // Re-enters sellable inventory at the ORIGINAL cost → WAC recalculated
      newStock = product.stock + quantity;
      newAvgCost = calcNewAvgCost(product.stock, product.avg_cost, quantity, item.cost_price);
      await sqlite.execute(
        "UPDATE products SET stock = ?, avg_cost = ?, updated_at = ? WHERE id = ?",
        [newStock, newAvgCost, now, productId]
      );
      await insertMovement({
        productId, movementType: MOVEMENT_TYPES.SALE_RETURN_IN, quantity,
        costPrice: item.cost_price, referenceType: "sale_return", referenceId: returnId,
        stockBefore: product.stock, stockAfter: newStock,
        notes: `Sellable return on ${sale.invoice_no}`, createdAt: now,
      });
    } else {
      // Damaged: sellable stock and avgCost untouched, only damaged_stock grows.
      newDamaged = product.damaged_stock + quantity;
      await sqlite.execute(
        "UPDATE products SET damaged_stock = ?, updated_at = ? WHERE id = ?",
        [newDamaged, now, productId]
      );
      // Two movements that net to zero on sellable stock. The unit "arrives" (sale_return_in)
      // then is written off (damaged_write_off). This keeps recalculateProductStock() equal
      // to product.stock, because damaged_write_off is SUBTRACTIVE in that formula.
      await insertMovement({
        productId, movementType: MOVEMENT_TYPES.SALE_RETURN_IN, quantity,
        costPrice: item.cost_price, referenceType: "sale_return", referenceId: returnId,
        stockBefore: product.stock, stockAfter: product.stock + quantity,
        notes: `Damaged return received on ${sale.invoice_no}`, createdAt: now,
      });
      await insertMovement({
        productId, movementType: MOVEMENT_TYPES.DAMAGED_WRITE_OFF, quantity,
        costPrice: item.cost_price, referenceType: "sale_return", referenceId: returnId,
        stockBefore: product.stock + quantity, stockAfter: product.stock,
        notes: `Written off as damaged (${sale.invoice_no})`, createdAt: now,
      });
    }

    // 8. Money
    if (refundMethod !== "credit_note") {
      // Actual payout → payment row flagged isRefund
      await sqlite.execute(
        `INSERT INTO payments
           (id, type, party_id, reference_id, amount, payment_method, notes,
            payment_date, is_refund, is_reversed, created_at)
         VALUES (?, 'customer', ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
        [
          generateId(), sale.customer_id, saleId, refundAmount, refundMethod,
          `Refund for return on ${sale.invoice_no}`, returnDate, now,
        ]
      );
    }
    // credit_note: NO payment row — only the balance moves
    await sqlite.execute(
      "UPDATE customers SET outstanding_balance = outstanding_balance - ?, updated_at = ? WHERE id = ?",
      [refundAmount, now, sale.customer_id]
    );

    // 9. Audit
    await insertAudit({
      eventType: AUDIT_EVENTS.SALE_RETURN,
      entityType: "sale",
      entityId: saleId,
      description:
        `Return on ${sale.invoice_no}: ${quantity} × ${product.name} (${returnCondition}), ` +
        `${formatCurrency(refundAmount)} via ${refundMethod}`,
      oldValues: {
        stock: product.stock, damagedStock: product.damaged_stock,
        avgCost: product.avg_cost, customerBalance: customer.outstanding_balance,
      },
      newValues: {
        returnId, stock: newStock, damagedStock: newDamaged, avgCost: newAvgCost,
        customerBalance: customer.outstanding_balance - refundAmount,
        refundAmount, refundMethod, returnCondition,
      },
      createdAt: now,
    });

    return { returnId, refundAmount };
  });
}

// ─── createPurchaseReturn ────────────────────────────────────────────────────

export async function createPurchaseReturn(
  input: CreatePurchaseReturnInput
): Promise<{ returnId: string; refundAmount: number }> {
  const { purchaseId, productId, quantity, reason, returnDate } = input;

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Return quantity must be a whole number greater than 0.");
  }

  return withTransaction(async () => {
    const sqlite = getSqlite();
    const now = nowISO();

    const purchaseRows = await sqlite.select<{
      id: string; supplier_id: string | null; invoice_no: string | null; is_cancelled: number;
    }[]>(
      "SELECT id, supplier_id, invoice_no, is_cancelled FROM purchases WHERE id = ?",
      [purchaseId]
    );
    const purchase = purchaseRows[0];
    if (!purchase) throw new Error("Purchase not found.");
    if (purchase.is_cancelled) throw new Error("Cannot return items from a cancelled purchase.");

    const itemRows = await sqlite.select<{ quantity: number; cost_price: number }[]>(
      "SELECT quantity, cost_price FROM purchase_items WHERE purchase_id = ? AND product_id = ?",
      [purchaseId, productId]
    );
    const item = itemRows[0];
    if (!item) throw new Error("This product is not on the selected purchase.");

    const returnedRows = await sqlite.select<{ total: number }[]>(
      "SELECT COALESCE(SUM(quantity), 0) AS total FROM purchase_returns WHERE purchase_id = ? AND product_id = ?",
      [purchaseId, productId]
    );
    const returnable = item.quantity - (returnedRows[0]?.total ?? 0);
    if (quantity > returnable) {
      throw new Error(`Only ${returnable} unit(s) can still be returned for this product.`);
    }

    const productRows = await sqlite.select<{
      id: string; name: string; stock: number; avg_cost: number;
    }[]>(
      "SELECT id, name, stock, avg_cost FROM products WHERE id = ?",
      [productId]
    );
    const product = productRows[0];
    if (!product) throw new Error("Product not found.");
    if (product.stock < quantity) {
      throw new Error(`Only ${product.stock} unit(s) are in stock — some of this purchase has already been sold.`);
    }

    let supplierBalanceBefore: number | null = null;
    if (purchase.supplier_id) {
      const supplierRows = await sqlite.select<{ outstanding_balance: number }[]>(
        "SELECT outstanding_balance FROM suppliers WHERE id = ?",
        [purchase.supplier_id]
      );
      if (!supplierRows[0]) throw new Error("Supplier not found.");
      supplierBalanceBefore = supplierRows[0].outstanding_balance;
    }

    const refundAmount = round2(item.cost_price * quantity);
    const returnId = generateId();
    const newStock = product.stock - quantity;

    await sqlite.execute(
      `INSERT INTO purchase_returns
         (id, purchase_id, product_id, quantity, cost_price, reason, refund_amount, return_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [returnId, purchaseId, productId, quantity, item.cost_price, reason?.trim() || null, refundAmount, returnDate, now]
    );

    // Removal → stock decremented, avgCost deliberately NOT touched
    await sqlite.execute(
      "UPDATE products SET stock = ?, updated_at = ? WHERE id = ?",
      [newStock, now, productId]
    );
    await insertMovement({
      productId, movementType: MOVEMENT_TYPES.PURCHASE_RETURN_OUT, quantity,
      costPrice: item.cost_price, referenceType: "purchase_return", referenceId: returnId,
      stockBefore: product.stock, stockAfter: newStock,
      notes: `Returned to supplier (${purchase.invoice_no ?? "purchase"})`, createdAt: now,
    });

    if (purchase.supplier_id) {
      await sqlite.execute(
        "UPDATE suppliers SET outstanding_balance = outstanding_balance - ?, updated_at = ? WHERE id = ?",
        [refundAmount, now, purchase.supplier_id]
      );
    }

    await insertAudit({
      eventType: AUDIT_EVENTS.PURCHASE_RETURN,
      entityType: "purchase",
      entityId: purchaseId,
      description:
        `Purchase return${purchase.invoice_no ? ` on ${purchase.invoice_no}` : ""}: ` +
        `${quantity} × ${product.name}, ${formatCurrency(refundAmount)}`,
      oldValues: { stock: product.stock, avgCost: product.avg_cost, supplierBalance: supplierBalanceBefore },
      newValues: {
        returnId, stock: newStock, avgCost: product.avg_cost,
        supplierBalance: supplierBalanceBefore === null ? null : supplierBalanceBefore - refundAmount,
        refundAmount,
      },
      createdAt: now,
    });

    return { returnId, refundAmount };
  });
}