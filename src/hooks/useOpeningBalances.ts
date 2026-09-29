// src/hooks/useOpeningBalances.ts
import { useEffect, useState, useCallback } from "react";
import { getSqlite } from "@/db";
import { withTransaction } from "@/db/transaction";
import {
  WALKIN_CUSTOMER_ID,
  AUDIT_EVENTS,
  MOVEMENT_TYPES,
  ITEMS_PER_PAGE,
} from "@/lib/constants";
import { generateId, nowISO } from "@/lib/utils";
import {
  recalculateCustomerBalance,
  recalculateSupplierBalance,
} from "@/lib/balanceRecalc";
import type Database from "@tauri-apps/plugin-sql";

export type OpeningEntityType = "customer" | "supplier" | "product";

export const OPENING_LOCK_MESSAGE =
  "Cannot change opening balance after transactions exist for this entity.";

export interface OpeningBalanceRow {
  id: string;
  name: string;
  hasRecord: boolean;
  amount: number;
  quantity: number | null;
  costPrice: number | null;
  asOfDate: string | null;
  notes: string | null;
  locked: boolean;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function countOf(
  sqlite: Database,
  sql: string,
  params: unknown[]
): Promise<number> {
  const rows = await sqlite.select<{ c: number }[]>(sql, params);
  return Number(rows[0]?.c ?? 0);
}

async function writeAudit(
  sqlite: Database,
  eventType: string,
  entityType: string,
  entityId: string,
  description: string,
  oldValues: unknown,
  newValues: unknown
): Promise<void> {
  await sqlite.execute(
    `INSERT INTO audit_log (id, event_type, entity_type, entity_id, description,
       old_values, new_values, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      eventType,
      entityType,
      entityId,
      description,
      oldValues === null ? null : JSON.stringify(oldValues),
      JSON.stringify(newValues),
      nowISO(),
    ]
  );
}

/**
 * Returns true if ANY transaction exists for this entity.
 * Uses getSqlite() so it is safe to call inside withTransaction().
 *   customer: any sale (even cancelled) or any customer payment
 *   supplier: any purchase (even cancelled) or any supplier payment
 *   product:  any stock movement other than opening_stock
 */
export async function hasTransactions(
  entityType: OpeningEntityType,
  entityId: string
): Promise<boolean> {
  const sqlite = getSqlite();

  if (entityType === "customer") {
    const sales = await countOf(
      sqlite,
      "SELECT COUNT(*) AS c FROM sales WHERE customer_id = ?",
      [entityId]
    );
    if (sales > 0) return true;
    const pays = await countOf(
      sqlite,
      "SELECT COUNT(*) AS c FROM payments WHERE type = 'customer' AND party_id = ?",
      [entityId]
    );
    return pays > 0;
  }

  if (entityType === "supplier") {
    const purchases = await countOf(
      sqlite,
      "SELECT COUNT(*) AS c FROM purchases WHERE supplier_id = ?",
      [entityId]
    );
    if (purchases > 0) return true;
    const pays = await countOf(
      sqlite,
      "SELECT COUNT(*) AS c FROM payments WHERE type = 'supplier' AND party_id = ?",
      [entityId]
    );
    return pays > 0;
  }

  const moves = await countOf(
    sqlite,
    "SELECT COUNT(*) AS c FROM stock_movements WHERE product_id = ? AND movement_type != ?",
    [entityId, MOVEMENT_TYPES.OPENING_STOCK]
  );
  return moves > 0;
}

/** INSERT or UPDATE the single opening_balances record. Returns the previous row (or null). */
async function upsertOpeningRecord(
  sqlite: Database,
  entityType: OpeningEntityType,
  entityId: string,
  v: {
    amount: number;
    quantity: number | null;
    costPrice: number | null;
    asOfDate: string;
    notes: string | null;
  }
): Promise<{ id: string; previous: Record<string, unknown> | null }> {
  const existing = await sqlite.select<Record<string, unknown>[]>(
    "SELECT * FROM opening_balances WHERE entity_type = ? AND entity_id = ?",
    [entityType, entityId]
  );

  if (existing.length > 0) {
    const id = String(existing[0].id);
    await sqlite.execute(
      `UPDATE opening_balances
          SET amount = ?, quantity = ?, cost_price = ?, as_of_date = ?, notes = ?
        WHERE entity_type = ? AND entity_id = ?`,
      [v.amount, v.quantity, v.costPrice, v.asOfDate, v.notes, entityType, entityId]
    );
    return { id, previous: existing[0] };
  }

  const id = generateId();
  await sqlite.execute(
    `INSERT INTO opening_balances
       (id, entity_type, entity_id, amount, quantity, cost_price, notes, as_of_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, entityType, entityId, v.amount, v.quantity, v.costPrice, v.notes, v.asOfDate, nowISO()]
  );
  return { id, previous: null };
}

// ─── CUSTOMER / SUPPLIER OPENING BALANCE ─────────────────────────────────────

export async function setCustomerOpeningBalance(
  customerId: string,
  amount: number,
  asOfDate: string,
  notes?: string
): Promise<void> {
  if (!Number.isFinite(amount)) throw new Error("Enter a valid amount.");
  if (!asOfDate) throw new Error("As-of date is required.");
  if (customerId === WALKIN_CUSTOMER_ID) {
    throw new Error("The Walk-in Customer cannot have an opening balance.");
  }

  await withTransaction(async () => {
    const sqlite = getSqlite();

    // 1. Lock check
    if (await hasTransactions("customer", customerId)) {
      throw new Error(OPENING_LOCK_MESSAGE);
    }

    const cust = await sqlite.select<{ shop_name: string; outstanding_balance: number }[]>(
      "SELECT shop_name, outstanding_balance FROM customers WHERE id = ?",
      [customerId]
    );
    if (cust.length === 0) throw new Error("Customer not found.");

    // 2 + 3. INSERT or UPDATE
    const { previous } = await upsertOpeningRecord(sqlite, "customer", customerId, {
      amount,
      quantity: null,
      costPrice: null,
      asOfDate,
      notes: notes?.trim() || null,
    });

    // 4. Refresh denormalized cache
    const newBalance = await recalculateCustomerBalance(customerId);
    await sqlite.execute(
      "UPDATE customers SET outstanding_balance = ?, updated_at = ? WHERE id = ?",
      [newBalance, nowISO(), customerId]
    );

    // 5. Audit
    await writeAudit(
      sqlite,
      AUDIT_EVENTS.CUSTOMER_BALANCE_FIXED,
      "customer",
      customerId,
      `Opening balance ${previous ? "corrected" : "set"} for ${cust[0].shop_name}`,
      previous
        ? { openingBalance: previous.amount, outstandingBalance: cust[0].outstanding_balance }
        : { outstandingBalance: cust[0].outstanding_balance },
      { openingBalance: amount, outstandingBalance: newBalance, asOfDate }
    );
  });
}

export async function setSupplierOpeningBalance(
  supplierId: string,
  amount: number,
  asOfDate: string,
  notes?: string
): Promise<void> {
  if (!Number.isFinite(amount)) throw new Error("Enter a valid amount.");
  if (!asOfDate) throw new Error("As-of date is required.");

  await withTransaction(async () => {
    const sqlite = getSqlite();

    if (await hasTransactions("supplier", supplierId)) {
      throw new Error(OPENING_LOCK_MESSAGE);
    }

    const sup = await sqlite.select<{ name: string; outstanding_balance: number }[]>(
      "SELECT name, outstanding_balance FROM suppliers WHERE id = ?",
      [supplierId]
    );
    if (sup.length === 0) throw new Error("Supplier not found.");

    const { previous } = await upsertOpeningRecord(sqlite, "supplier", supplierId, {
      amount,
      quantity: null,
      costPrice: null,
      asOfDate,
      notes: notes?.trim() || null,
    });

    const newBalance = await recalculateSupplierBalance(supplierId);
    await sqlite.execute(
      "UPDATE suppliers SET outstanding_balance = ?, updated_at = ? WHERE id = ?",
      [newBalance, nowISO(), supplierId]
    );

    await writeAudit(
      sqlite,
      AUDIT_EVENTS.SUPPLIER_BALANCE_FIXED,
      "supplier",
      supplierId,
      `Opening balance ${previous ? "corrected" : "set"} for ${sup[0].name}`,
      previous
        ? { openingBalance: previous.amount, outstandingBalance: sup[0].outstanding_balance }
        : { outstandingBalance: sup[0].outstanding_balance },
      { openingBalance: amount, outstandingBalance: newBalance, asOfDate }
    );
  });
}

// ─── PRODUCT OPENING STOCK ───────────────────────────────────────────────────

export async function setProductOpeningStock(
  productId: string,
  qty: number,
  costPrice: number,
  asOfDate: string,
  notes?: string
): Promise<void> {
  if (!Number.isInteger(qty) || qty < 0) {
    throw new Error("Quantity must be a whole number, 0 or more.");
  }
  if (!Number.isFinite(costPrice) || costPrice < 0) {
    throw new Error("Cost price must be 0 or more.");
  }
  if (!asOfDate) throw new Error("As-of date is required.");

  await withTransaction(async () => {
    const sqlite = getSqlite();

    // 1. Lock check — any non-opening movement blocks changes
    if (await hasTransactions("product", productId)) {
      throw new Error(OPENING_LOCK_MESSAGE);
    }

    const prod = await sqlite.select<{ name: string; stock: number; avg_cost: number }[]>(
      "SELECT name, stock, avg_cost FROM products WHERE id = ?",
      [productId]
    );
    if (prod.length === 0) throw new Error("Product not found.");

    // 2. INSERT or UPDATE the record; on correction remove the previous opening movement
    const existing = await sqlite.select<{ id: string }[]>(
      "SELECT id FROM opening_balances WHERE entity_type = 'product' AND entity_id = ?",
      [productId]
    );
    if (existing.length > 0) {
      await sqlite.execute(
        "DELETE FROM stock_movements WHERE product_id = ? AND movement_type = ?",
        [productId, MOVEMENT_TYPES.OPENING_STOCK]
      );
    }

    const { id: recordId, previous } = await upsertOpeningRecord(
      sqlite,
      "product",
      productId,
      {
        amount: qty * costPrice,
        quantity: qty,
        costPrice,
        asOfDate,
        notes: notes?.trim() || null,
      }
    );

    // 3. Opening sets stock and WAC directly (no calcNewAvgCost)
    const now = nowISO();
    await sqlite.execute(
      "UPDATE products SET stock = ?, avg_cost = ?, updated_at = ? WHERE id = ?",
      [qty, costPrice, now, productId]
    );

    // 4. Stock movement (no other movements exist, so stock_before is 0)
    await sqlite.execute(
      `INSERT INTO stock_movements
         (id, product_id, movement_type, quantity, cost_price, reference_type,
          reference_id, stock_before, stock_after, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        productId,
        MOVEMENT_TYPES.OPENING_STOCK,
        qty,
        costPrice,
        "opening_balance",
        recordId,
        0,
        qty,
        notes?.trim() || "Opening stock",
        now,
      ]
    );

    // 5. Audit
    await writeAudit(
      sqlite,
      AUDIT_EVENTS.STOCK_ADJUSTED,
      "product",
      productId,
      `Opening stock ${previous ? "corrected" : "set"} for ${prod[0].name}: ${qty} @ ${costPrice}`,
      { stock: prod[0].stock, avgCost: prod[0].avg_cost },
      { stock: qty, avgCost: costPrice, asOfDate }
    );
  });
}

// ─── LIST HOOK ───────────────────────────────────────────────────────────────

interface QueryDef {
  select: string;
  from: string;
  where: string;
  order: string;
}

function buildQuery(entityType: OpeningEntityType): QueryDef {
  if (entityType === "customer") {
    return {
      select: `c.id AS id, c.shop_name AS name,
        ob.id AS ob_id, ob.amount AS ob_amount, ob.quantity AS ob_qty,
        ob.cost_price AS ob_cost, ob.as_of_date AS ob_date, ob.notes AS ob_notes,
        CASE WHEN EXISTS (SELECT 1 FROM sales s WHERE s.customer_id = c.id)
               OR EXISTS (SELECT 1 FROM payments p WHERE p.type = 'customer' AND p.party_id = c.id)
             THEN 1 ELSE 0 END AS locked`,
      from: `customers c
        LEFT JOIN opening_balances ob
          ON ob.entity_type = 'customer' AND ob.entity_id = c.id`,
      where: `c.id != 'WALKIN' AND c.is_active = 1 AND c.shop_name LIKE ?`,
      order: "c.shop_name ASC",
    };
  }
  if (entityType === "supplier") {
    return {
      select: `s.id AS id, s.name AS name,
        ob.id AS ob_id, ob.amount AS ob_amount, ob.quantity AS ob_qty,
        ob.cost_price AS ob_cost, ob.as_of_date AS ob_date, ob.notes AS ob_notes,
        CASE WHEN EXISTS (SELECT 1 FROM purchases pu WHERE pu.supplier_id = s.id)
               OR EXISTS (SELECT 1 FROM payments p WHERE p.type = 'supplier' AND p.party_id = s.id)
             THEN 1 ELSE 0 END AS locked`,
      from: `suppliers s
        LEFT JOIN opening_balances ob
          ON ob.entity_type = 'supplier' AND ob.entity_id = s.id`,
      where: `s.is_active = 1 AND s.name LIKE ?`,
      order: "s.name ASC",
    };
  }
  return {
    select: `p.id AS id, p.name AS name,
      ob.id AS ob_id, ob.amount AS ob_amount, ob.quantity AS ob_qty,
      ob.cost_price AS ob_cost, ob.as_of_date AS ob_date, ob.notes AS ob_notes,
      CASE WHEN EXISTS (SELECT 1 FROM stock_movements sm
                         WHERE sm.product_id = p.id AND sm.movement_type != 'opening_stock')
           THEN 1 ELSE 0 END AS locked`,
    from: `products p
      LEFT JOIN opening_balances ob
        ON ob.entity_type = 'product' AND ob.entity_id = p.id`,
    where: `p.is_active = 1 AND p.name LIKE ?`,
    order: "p.name ASC",
  };
}

export function useOpeningEntities(
  entityType: OpeningEntityType,
  search = "",
  page = 1
) {
  const [data, setData] = useState<OpeningBalanceRow[]>([]);
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
        const q = buildQuery(entityType);
        const like = `%${search.trim()}%`;
        const offset = (page - 1) * ITEMS_PER_PAGE;

        const countRows = await sqlite.select<{ c: number }[]>(
          `SELECT COUNT(*) AS c FROM ${q.from} WHERE ${q.where}`,
          [like]
        );
        const rows = await sqlite.select<Record<string, unknown>[]>(
          `SELECT ${q.select} FROM ${q.from} WHERE ${q.where}
            ORDER BY ${q.order}
            LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}`,
          [like]
        );

        if (cancelled) return;

        setTotalCount(Number(countRows[0]?.c ?? 0));
        setData(
          rows.map((r) => ({
            id: String(r.id),
            name: String(r.name),
            hasRecord: r.ob_id !== null && r.ob_id !== undefined,
            amount: Number(r.ob_amount ?? 0),
            quantity: r.ob_qty === null || r.ob_qty === undefined ? null : Number(r.ob_qty),
            costPrice: r.ob_cost === null || r.ob_cost === undefined ? null : Number(r.ob_cost),
            asOfDate: r.ob_date ? String(r.ob_date) : null,
            notes: r.ob_notes ? String(r.ob_notes) : null,
            locked: Number(r.locked) === 1,
          }))
        );
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [entityType, search, page, tick]);

  return { data, totalCount, isLoading, error, refetch };
}