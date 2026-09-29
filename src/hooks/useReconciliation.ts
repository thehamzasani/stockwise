// src/hooks/useReconciliation.ts
// Standalone async functions (usable from Dashboard in Task 20) + a state hook for Settings.
// All fix operations use withTransaction() and getSqlite() inside — never getDb().
// Fixes update the cached column only. stock_movements is the source of truth for stock,
// so fixProductStock never writes a movement row.

import { useCallback, useState } from "react";
import { getSqlite } from "@/db";
import { withTransaction } from "@/db/transaction";
import { AUDIT_EVENTS, WALKIN_CUSTOMER_ID } from "@/lib/constants";
import { generateId, nowISO } from "@/lib/utils";
import {
  recalculateCustomerBalance,
  recalculateSupplierBalance,
  recalculateProductStock,
} from "@/lib/balanceRecalc";
import type { BalanceMismatch, StockMismatch } from "@/types";

type Sqlite = ReturnType<typeof getSqlite>;

const BALANCE_TOLERANCE = 0.01; // Rs.
const round2 = (n: number) => Math.round(n * 100) / 100;

async function insertAudit(
  sqlite: Sqlite,
  eventType: string,
  entityType: string,
  entityId: string,
  description: string,
  oldValues: unknown,
  newValues: unknown
): Promise<void> {
  await sqlite.execute(
    `INSERT INTO audit_log
       (id, event_type, entity_type, entity_id, description, old_values, new_values, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      eventType,
      entityType,
      entityId,
      description,
      JSON.stringify(oldValues),
      JSON.stringify(newValues),
      nowISO(),
    ]
  );
}

// ─── CHECKS ──────────────────────────────────────────────────────────────────
// difference = cached − computed (positive means the cache is too high)

export async function checkCustomerBalances(): Promise<BalanceMismatch[]> {
  const sqlite = getSqlite();
  const rows = await sqlite.select<
    { id: string; shop_name: string; outstanding_balance: number }[]
  >(
    "SELECT id, shop_name, outstanding_balance FROM customers WHERE id != ? ORDER BY shop_name ASC",
    [WALKIN_CUSTOMER_ID]
  );

  const mismatches: BalanceMismatch[] = [];
  for (const r of rows) {
    const computed = await recalculateCustomerBalance(r.id);
    const difference = r.outstanding_balance - computed;
    if (Math.abs(difference) > BALANCE_TOLERANCE) {
      mismatches.push({
        entityId: r.id,
        entityName: r.shop_name,
        cachedBalance: r.outstanding_balance,
        computedBalance: round2(computed),
        difference: round2(difference),
      });
    }
  }
  return mismatches;
}

export async function checkSupplierBalances(): Promise<BalanceMismatch[]> {
  const sqlite = getSqlite();
  const rows = await sqlite.select<
    { id: string; name: string; outstanding_balance: number }[]
  >("SELECT id, name, outstanding_balance FROM suppliers ORDER BY name ASC");

  const mismatches: BalanceMismatch[] = [];
  for (const r of rows) {
    const computed = await recalculateSupplierBalance(r.id);
    const difference = r.outstanding_balance - computed;
    if (Math.abs(difference) > BALANCE_TOLERANCE) {
      mismatches.push({
        entityId: r.id,
        entityName: r.name,
        cachedBalance: r.outstanding_balance,
        computedBalance: round2(computed),
        difference: round2(difference),
      });
    }
  }
  return mismatches;
}

export async function checkStockLevels(): Promise<StockMismatch[]> {
  const sqlite = getSqlite();
  const rows = await sqlite.select<{ id: string; name: string; stock: number }[]>(
    "SELECT id, name, stock FROM products ORDER BY name ASC"
  );

  const mismatches: StockMismatch[] = [];
  for (const r of rows) {
    const computed = await recalculateProductStock(r.id);
    const difference = r.stock - computed;
    if (difference !== 0) {
      mismatches.push({
        productId: r.id,
        productName: r.name,
        systemStock: r.stock,
        computedStock: computed,
        difference,
      });
    }
  }
  return mismatches;
}

// ─── FIX PRIMITIVES (no transaction of their own — callers wrap them) ────────

async function applyCustomerFix(sqlite: Sqlite, customerId: string): Promise<void> {
  const rows = await sqlite.select<{ shop_name: string; outstanding_balance: number }[]>(
    "SELECT shop_name, outstanding_balance FROM customers WHERE id = ?",
    [customerId]
  );
  if (rows.length === 0) throw new Error("Customer not found.");

  const oldBalance = rows[0].outstanding_balance;
  const newBalance = round2(await recalculateCustomerBalance(customerId));

  await sqlite.execute(
    "UPDATE customers SET outstanding_balance = ?, updated_at = ? WHERE id = ?",
    [newBalance, nowISO(), customerId]
  );
  await insertAudit(
    sqlite,
    AUDIT_EVENTS.CUSTOMER_BALANCE_FIXED,
    "customer",
    customerId,
    `Customer balance corrected for ${rows[0].shop_name}: ${oldBalance} → ${newBalance}`,
    { outstandingBalance: oldBalance },
    { outstandingBalance: newBalance }
  );
}

async function applySupplierFix(sqlite: Sqlite, supplierId: string): Promise<void> {
  const rows = await sqlite.select<{ name: string; outstanding_balance: number }[]>(
    "SELECT name, outstanding_balance FROM suppliers WHERE id = ?",
    [supplierId]
  );
  if (rows.length === 0) throw new Error("Supplier not found.");

  const oldBalance = rows[0].outstanding_balance;
  const newBalance = round2(await recalculateSupplierBalance(supplierId));

  await sqlite.execute(
    "UPDATE suppliers SET outstanding_balance = ?, updated_at = ? WHERE id = ?",
    [newBalance, nowISO(), supplierId]
  );
  await insertAudit(
    sqlite,
    AUDIT_EVENTS.SUPPLIER_BALANCE_FIXED,
    "supplier",
    supplierId,
    `Supplier balance corrected for ${rows[0].name}: ${oldBalance} → ${newBalance}`,
    { outstandingBalance: oldBalance },
    { outstandingBalance: newBalance }
  );
}

async function applyProductStockFix(sqlite: Sqlite, productId: string): Promise<void> {
  const rows = await sqlite.select<{ name: string; stock: number }[]>(
    "SELECT name, stock FROM products WHERE id = ?",
    [productId]
  );
  if (rows.length === 0) throw new Error("Product not found.");

  const oldStock = rows[0].stock;
  const newStock = await recalculateProductStock(productId);

  await sqlite.execute(
    "UPDATE products SET stock = ?, updated_at = ? WHERE id = ?",
    [newStock, nowISO(), productId]
  );
  await insertAudit(
    sqlite,
    AUDIT_EVENTS.STOCK_FIXED,
    "product",
    productId,
    `Stock corrected for ${rows[0].name}: ${oldStock} → ${newStock}`,
    { stock: oldStock },
    { stock: newStock }
  );
}

// ─── SINGLE FIXES ────────────────────────────────────────────────────────────

export async function fixCustomerBalance(customerId: string): Promise<void> {
  await withTransaction(async () => {
    await applyCustomerFix(getSqlite(), customerId);
  });
}

export async function fixSupplierBalance(supplierId: string): Promise<void> {
  await withTransaction(async () => {
    await applySupplierFix(getSqlite(), supplierId);
  });
}

export async function fixProductStock(productId: string): Promise<void> {
  await withTransaction(async () => {
    await applyProductStockFix(getSqlite(), productId);
  });
}

// ─── FIX-ALL VARIANTS (one transaction each — all or nothing) ────────────────

export async function fixAllCustomerBalances(
  mismatches: BalanceMismatch[]
): Promise<number> {
  if (mismatches.length === 0) return 0;
  await withTransaction(async () => {
    const sqlite = getSqlite();
    for (const m of mismatches) await applyCustomerFix(sqlite, m.entityId);
  });
  return mismatches.length;
}

export async function fixAllSupplierBalances(
  mismatches: BalanceMismatch[]
): Promise<number> {
  if (mismatches.length === 0) return 0;
  await withTransaction(async () => {
    const sqlite = getSqlite();
    for (const m of mismatches) await applySupplierFix(sqlite, m.entityId);
  });
  return mismatches.length;
}

export async function fixAllProductStock(
  mismatches: StockMismatch[]
): Promise<number> {
  if (mismatches.length === 0) return 0;
  await withTransaction(async () => {
    const sqlite = getSqlite();
    for (const m of mismatches) await applyProductStockFix(sqlite, m.productId);
  });
  return mismatches.length;
}

// ─── STATE HOOK (used by Settings → Data Integrity) ──────────────────────────
// Action-driven (runs on button press, not on mount), so it returns explicit
// per-action loading flags instead of the single { data, isLoading } shape.
// Fix functions rethrow so the caller can show a toast.

export function useReconciliation() {
  const [customerMismatches, setCustomerMismatches] = useState<BalanceMismatch[]>([]);
  const [supplierMismatches, setSupplierMismatches] = useState<BalanceMismatch[]>([]);
  const [stockMismatches, setStockMismatches]       = useState<StockMismatch[]>([]);

  const [balancesChecked, setBalancesChecked] = useState(false);
  const [stockChecked, setStockChecked]       = useState(false);

  const [isCheckingBalances, setIsCheckingBalances] = useState(false);
  const [isCheckingStock, setIsCheckingStock]       = useState(false);
  const [fixingId, setFixingId]                     = useState<string | null>(null);
  const [isFixingAll, setIsFixingAll]               = useState(false);
  const [error, setError]                           = useState<string | null>(null);

  const runBalanceCheck = useCallback(async (): Promise<number> => {
    setIsCheckingBalances(true);
    setError(null);
    try {
      const customers = await checkCustomerBalances();
      const suppliers = await checkSupplierBalances();
      setCustomerMismatches(customers);
      setSupplierMismatches(suppliers);
      setBalancesChecked(true);
      return customers.length + suppliers.length;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return 0;
    } finally {
      setIsCheckingBalances(false);
    }
  }, []);

  const runStockCheck = useCallback(async (): Promise<number> => {
    setIsCheckingStock(true);
    setError(null);
    try {
      const result = await checkStockLevels();
      setStockMismatches(result);
      setStockChecked(true);
      return result.length;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return 0;
    } finally {
      setIsCheckingStock(false);
    }
  }, []);

  const fixCustomer = useCallback(async (id: string) => {
    setFixingId(id);
    try {
      await fixCustomerBalance(id);
      setCustomerMismatches((prev) => prev.filter((m) => m.entityId !== id));
    } finally {
      setFixingId(null);
    }
  }, []);

  const fixSupplier = useCallback(async (id: string) => {
    setFixingId(id);
    try {
      await fixSupplierBalance(id);
      setSupplierMismatches((prev) => prev.filter((m) => m.entityId !== id));
    } finally {
      setFixingId(null);
    }
  }, []);

  const fixProduct = useCallback(async (id: string) => {
    setFixingId(id);
    try {
      await fixProductStock(id);
      setStockMismatches((prev) => prev.filter((m) => m.productId !== id));
    } finally {
      setFixingId(null);
    }
  }, []);

  const fixAllBalances = useCallback(async (): Promise<number> => {
    setIsFixingAll(true);
    try {
      const c = await fixAllCustomerBalances(customerMismatches);
      const s = await fixAllSupplierBalances(supplierMismatches);
      setCustomerMismatches([]);
      setSupplierMismatches([]);
      return c + s;
    } finally {
      setIsFixingAll(false);
    }
  }, [customerMismatches, supplierMismatches]);

  const fixAllStock = useCallback(async (): Promise<number> => {
    setIsFixingAll(true);
    try {
      const n = await fixAllProductStock(stockMismatches);
      setStockMismatches([]);
      return n;
    } finally {
      setIsFixingAll(false);
    }
  }, [stockMismatches]);

  return {
    customerMismatches,
    supplierMismatches,
    stockMismatches,
    balancesChecked,
    stockChecked,
    isCheckingBalances,
    isCheckingStock,
    fixingId,
    isFixingAll,
    error,
    runBalanceCheck,
    runStockCheck,
    fixCustomer,
    fixSupplier,
    fixProduct,
    fixAllBalances,
    fixAllStock,
  };
}