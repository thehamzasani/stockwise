// src/lib/balanceRecalc.ts
// Two layers:
//   1. Pure functions (computeBalance, computeStockFromMovements) — no DB, fully unit-testable.
//   2. DB functions (recalculate*) — use these in the reconciliation tool and hooks.
//
// ─── BALANCE FORMULA ──────────────────────────────────────────────────────────
// Customer outstanding balance:
//   = openingBalance
//   + SUM(sales.total_amount WHERE not cancelled)          ← total invoiced
//   - SUM(payments.amount WHERE type='customer', not reversed) ← all money received
//   - SUM(sale_returns.refund_amount WHERE refund_method='credit_note') ← credit adjustments
//
// WHY NOT (total_amount - paid_amount) from sales?
//   sale.paid_amount is a denormalized cache. Using it AND subtracting payments would
//   double-count every payment (once via paid_amount, once via the payments table).
//   Always use SUM(total_amount) from sales + SUM(amount) from payments separately.
//
// ─── SIGNED STOCK CONVENTIONS ─────────────────────────────────────────────────
// ADDITIVE (+qty):    purchase_in, sale_return_in, adjustment_add, opening_stock, sale_cancelled
// SUBTRACTIVE (-qty): sale_out, purchase_return_out, adjustment_remove,
//                     damaged_write_off, purchase_cancelled
// CORRECTION:         signed delta = (stock_after - stock_before), can be negative

import { getSqlite } from "@/db";
import { MOVEMENT_TYPES } from "@/lib/constants";

// ─── PURE FUNCTIONS (exported for unit tests) ─────────────────────────────────

/**
 * Pure balance computation — no DB. Used by unit tests and by recalculateCustomerBalance.
 * All parameters are already summed (SUM results from DB queries).
 */
export function computeBalance(
  openingBalance: number,
  totalInvoiced: number,
  totalPaid: number,
  totalCreditNotes: number
): number {
  return openingBalance + totalInvoiced - totalPaid - totalCreditNotes;
}

const ADDITIVE_TYPES = new Set<string>([
  MOVEMENT_TYPES.PURCHASE_IN,
  MOVEMENT_TYPES.SALE_RETURN_IN,
  MOVEMENT_TYPES.ADJUSTMENT_ADD,
  MOVEMENT_TYPES.OPENING_STOCK,
  MOVEMENT_TYPES.SALE_CANCELLED,
]);

const SUBTRACTIVE_TYPES = new Set<string>([
  MOVEMENT_TYPES.SALE_OUT,
  MOVEMENT_TYPES.PURCHASE_RETURN_OUT,
  MOVEMENT_TYPES.ADJUSTMENT_REMOVE,
  MOVEMENT_TYPES.DAMAGED_WRITE_OFF,
  MOVEMENT_TYPES.PURCHASE_CANCELLED,
]);

/**
 * Pure stock computation from movement history — no DB. Used by unit tests.
 * quantity in each movement is always a POSITIVE integer.
 * Direction is inferred from movementType using the signed conventions above.
 * Unknown movement types are silently ignored (forward-compatible).
 */
export function computeStockFromMovements(
  movements: Array<{
    movementType: string;
    quantity: number;
    stockBefore: number;
    stockAfter: number;
  }>
): number {
  let stock = 0;
  for (const m of movements) {
    const mt = m.movementType as string;
    if (ADDITIVE_TYPES.has(mt as Parameters<typeof ADDITIVE_TYPES.has>[0])) {
      stock += m.quantity;
    } else if (SUBTRACTIVE_TYPES.has(mt as Parameters<typeof SUBTRACTIVE_TYPES.has>[0])) {
      stock -= m.quantity;
    } else if (mt === MOVEMENT_TYPES.CORRECTION) {
      stock += m.stockAfter - m.stockBefore;
    }
  }
  return stock;
}

// ─── DB FUNCTIONS (used by reconciliation tool) ───────────────────────────────

export async function recalculateCustomerBalance(customerId: string): Promise<number> {
  const sqlite = getSqlite();

  const salesResult = await sqlite.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(total_amount), 0) AS total
       FROM sales WHERE customer_id = ? AND is_cancelled = 0`,
    [customerId]
  );
  const paymentsResult = await sqlite.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(amount), 0) AS total
       FROM payments WHERE type = 'customer' AND party_id = ? AND is_reversed = 0`,
    [customerId]
  );
  const creditNotesResult = await sqlite.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(sr.refund_amount), 0) AS total
       FROM sale_returns sr
       JOIN sales s ON s.id = sr.sale_id
      WHERE s.customer_id = ? AND sr.refund_method = 'credit_note'`,
    [customerId]
  );
  const openingResult = await sqlite.select<{ amount: number }[]>(
    `SELECT COALESCE(SUM(amount), 0) AS amount
       FROM opening_balances WHERE entity_type = 'customer' AND entity_id = ?`,
    [customerId]
  );

  return computeBalance(
    openingResult[0]?.amount ?? 0,
    salesResult[0]?.total ?? 0,
    paymentsResult[0]?.total ?? 0,
    creditNotesResult[0]?.total ?? 0
  );
}

export async function recalculateSupplierBalance(supplierId: string): Promise<number> {
  const sqlite = getSqlite();

  const purchasesResult = await sqlite.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(total_amount), 0) AS total
       FROM purchases WHERE supplier_id = ? AND is_cancelled = 0`,
    [supplierId]
  );
  const paymentsResult = await sqlite.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(amount), 0) AS total
       FROM payments WHERE type = 'supplier' AND party_id = ? AND is_reversed = 0`,
    [supplierId]
  );
  const returnsResult = await sqlite.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(refund_amount), 0) AS total
       FROM purchase_returns WHERE purchase_id IN (
         SELECT id FROM purchases WHERE supplier_id = ? AND is_cancelled = 0
       )`,
    [supplierId]
  );
  const openingResult = await sqlite.select<{ amount: number }[]>(
    `SELECT COALESCE(SUM(amount), 0) AS amount
       FROM opening_balances WHERE entity_type = 'supplier' AND entity_id = ?`,
    [supplierId]
  );

  return computeBalance(
    openingResult[0]?.amount ?? 0,
    purchasesResult[0]?.total ?? 0,
    paymentsResult[0]?.total ?? 0,
    returnsResult[0]?.total ?? 0
  );
}

export async function recalculateProductStock(productId: string): Promise<number> {
  const sqlite = getSqlite();

  const additiveList = [...ADDITIVE_TYPES].map((t) => `'${t}'`).join(",");
  const subtractiveList = [...SUBTRACTIVE_TYPES].map((t) => `'${t}'`).join(",");

  const addResult = await sqlite.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(quantity), 0) AS total FROM stock_movements
      WHERE product_id = ? AND movement_type IN (${additiveList})`,
    [productId]
  );
  const removeResult = await sqlite.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(quantity), 0) AS total FROM stock_movements
      WHERE product_id = ? AND movement_type IN (${subtractiveList})`,
    [productId]
  );
  const correctionResult = await sqlite.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(stock_after - stock_before), 0) AS total FROM stock_movements
      WHERE product_id = ? AND movement_type = 'correction'`,
    [productId]
  );

  return (
    (addResult[0]?.total ?? 0) -
    (removeResult[0]?.total ?? 0) +
    (correctionResult[0]?.total ?? 0)
  );
}