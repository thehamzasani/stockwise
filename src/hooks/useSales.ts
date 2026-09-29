// src/hooks/useSales.ts
import { useState, useEffect, useCallback } from "react";
import { getDb, getSqlite } from "@/db";
import { withTransaction } from "@/db/transaction";
import { sales } from "@/db/schema";
import { eq, desc, and, lt, ne, sql } from "drizzle-orm";
import { generateId, nowISO, todayDate, addDaysToDate, calcInvoiceNo } from "@/lib/utils";
import { checkCreditLimit } from "@/lib/wac";
import { WALKIN_CUSTOMER_ID, MOVEMENT_TYPES, AUDIT_EVENTS, ITEMS_PER_PAGE } from "@/lib/constants";
import type { Sale, SaleWithItems, SaleLineItem, PaymentMethod } from "@/types";

// ─── LIST HOOK ────────────────────────────────────────────────────────────────

interface UseSalesOptions {
  page?: number;
  search?: string;
  status?: "all" | "unpaid" | "partial" | "paid" | "overdue";
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface UseSalesResult {
  data: Sale[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSales(options: UseSalesOptions = {}): UseSalesResult {
  const { page = 1, search = "", status = "all", customerId, dateFrom, dateTo } = options;
  const [data, setData] = useState<Sale[]>([]);
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
        const db = getDb();
        const offset = (page - 1) * ITEMS_PER_PAGE;
        const today = todayDate();

        // Build conditions
        const conditions = [eq(sales.isCancelled, false)];

        if (customerId) conditions.push(eq(sales.customerId, customerId));

        if (search) {
          conditions.push(sql`${sales.invoiceNo} LIKE ${"%" + search + "%"}`);
        }

        if (status === "overdue") {
          conditions.push(lt(sales.dueDate, today));
          conditions.push(ne(sales.paymentStatus, "paid"));
        } else if (status !== "all") {
          conditions.push(eq(sales.paymentStatus, status));
        }

        if (dateFrom) conditions.push(sql`${sales.saleDate} >= ${dateFrom}`);
        if (dateTo) conditions.push(sql`${sales.saleDate} <= ${dateTo}`);

        const whereClause = and(...conditions);

        const [rows, countRows] = await Promise.all([
          db
            .select()
            .from(sales)
            .where(whereClause)
            .orderBy(desc(sales.createdAt))
            .limit(ITEMS_PER_PAGE)
            .offset(offset),
          db
            .select({ count: sql<number>`COUNT(*)` })
            .from(sales)
            .where(whereClause),
        ]);

        if (!cancelled) {
          setData(rows);
          setTotalCount(countRows[0]?.count ?? 0);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [page, search, status, customerId, dateFrom, dateTo, tick]);

  return { data, totalCount, isLoading, error, refetch };
}

// ─── SINGLE SALE HOOK ─────────────────────────────────────────────────────────

interface UseSaleResult {
  data: SaleWithItems | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSale(saleId: string | null): UseSaleResult {
  const [data, setData] = useState<SaleWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!saleId) {
      setData(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const sqlite = getSqlite();

        const saleRows = await sqlite.select<Sale[]>(
          `SELECT * FROM sales WHERE id = ?`,
          [saleId]
        );
        if (saleRows.length === 0) throw new Error("Sale not found.");

        const sale = saleRows[0];

        const customerRows = await sqlite.select<{ id: string; shopName: string; ownerName: string | null; phone: string | null; city: string | null; area: string | null; address: string | null; creditLimit: number | null; outstandingBalance: number; paymentTerms: number }[]>(
          `SELECT id, shop_name as shopName, owner_name as ownerName, phone, city, area, address, credit_limit as creditLimit, outstanding_balance as outstandingBalance, payment_terms as paymentTerms FROM customers WHERE id = ?`,
          [sale.customerId]
        );

        const itemRows = await sqlite.select<{
          id: string; saleId: string; productId: string; quantity: number;
          salePrice: number; costPrice: number; discountPct: number; totalAmount: number;
          productName: string; productCategory: string; productUnit: string; productBrand: string | null;
          productBarcode: string | null; productAvgCost: number; productSalePrice: number;
          productStock: number; productDamagedStock: number; productMinStock: number;
          productIsActive: number; productCreatedAt: string; productUpdatedAt: string;
        }[]>(
          `SELECT si.id, si.sale_id as saleId, si.product_id as productId, si.quantity,
                  si.sale_price as salePrice, si.cost_price as costPrice,
                  si.discount_pct as discountPct, si.total_amount as totalAmount,
                  p.name as productName, p.category as productCategory, p.unit as productUnit,
                  p.brand as productBrand, p.barcode as productBarcode,
                  p.avg_cost as productAvgCost, p.sale_price as productSalePrice,
                  p.stock as productStock, p.damaged_stock as productDamagedStock,
                  p.min_stock as productMinStock, p.is_active as productIsActive,
                  p.created_at as productCreatedAt, p.updated_at as productUpdatedAt
           FROM sale_items si
           JOIN products p ON p.id = si.product_id
           WHERE si.sale_id = ?`,
          [saleId]
        );

        const enrichedItems = itemRows.map((r) => ({
          id: r.id,
          saleId: r.saleId,
          productId: r.productId,
          quantity: r.quantity,
          salePrice: r.salePrice,
          costPrice: r.costPrice,
          discountPct: r.discountPct,
          totalAmount: r.totalAmount,
          product: {
            id: r.productId,
            name: r.productName,
            category: r.productCategory,
            unit: r.productUnit,
            brand: r.productBrand,
            barcode: r.productBarcode,
            avgCost: r.productAvgCost,
            salePrice: r.productSalePrice,
            stock: r.productStock,
            damagedStock: r.productDamagedStock,
            minStock: r.productMinStock,
            description: null,
            isActive: Boolean(r.productIsActive),
            createdAt: r.productCreatedAt,
            updatedAt: r.productUpdatedAt,
          },
        }));

        if (!cancelled) {
          setData({
            ...sale,
            customer: customerRows[0] as unknown as import("@/types").Customer,
            items: enrichedItems,
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
  }, [saleId, tick]);

  return { data, isLoading, error, refetch };
}

// ─── CREATE SALE ──────────────────────────────────────────────────────────────

export interface CreateSaleInput {
  customerId: string;
  items: SaleLineItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  paymentMethod: PaymentMethod | null;
  notes: string;
  saleDate: string;
}

export async function createSale(input: CreateSaleInput): Promise<string> {
  const {
    customerId, items, subtotal, discountAmount, taxAmount,
    totalAmount, paidAmount, paymentMethod, notes, saleDate,
  } = input;

  // ── Pre-transaction validations ──────────────────────────────────────────
  if (!customerId) throw new Error("Please select a customer.");
  if (items.length === 0) throw new Error("Add at least one item to the sale.");

  const sqlite = getSqlite();

  // Stock check
  for (const item of items) {
    const rows = await sqlite.select<{ stock: number }[]>(
      `SELECT stock FROM products WHERE id = ?`,
      [item.product.id]
    );
    if (rows.length === 0) throw new Error(`Product "${item.product.name}" not found.`);
    if (rows[0].stock < item.quantity) {
      throw new Error(
        `Insufficient stock for "${item.product.name}". Available: ${rows[0].stock}, required: ${item.quantity}.`
      );
    }
  }

  // Read customer for credit check
  const custRows = await sqlite.select<{
    creditLimit: number | null;
    outstandingBalance: number;
    shopName: string;
  }[]>(
    `SELECT credit_limit as creditLimit, outstanding_balance as outstandingBalance, shop_name as shopName FROM customers WHERE id = ?`,
    [customerId]
  );
  if (custRows.length === 0) throw new Error("Customer not found.");

  const customer = custRows[0];
  const balanceDue = Math.max(0, totalAmount - paidAmount);

  // Walk-in must be fully paid
  if (customerId === WALKIN_CUSTOMER_ID && balanceDue > 0) {
    throw new Error("Walk-in sales require full payment.");
  }

  // Credit limit check
  const creditCheck = checkCreditLimit(customer.creditLimit, customer.outstandingBalance, balanceDue);
  if (!creditCheck.allowed) throw new Error(creditCheck.message!);

  // ── Transaction ──────────────────────────────────────────────────────────
  const saleId = generateId();
  const now = nowISO();

  await withTransaction(async () => {
    const sq = getSqlite();

    // Fresh dueDate from DB (not stale form data)
    const freshCust = await sq.select<{ paymentTerms: number }[]>(
      `SELECT payment_terms as paymentTerms FROM customers WHERE id = ?`,
      [customerId]
    );
    const dueDate = addDaysToDate(saleDate, freshCust[0].paymentTerms);

    // Atomic invoice number
    const settings = await sq.select<{ nextInvoiceNo: number; invoicePrefix: string }[]>(
      `SELECT next_invoice_no as nextInvoiceNo, invoice_prefix as invoicePrefix FROM app_settings WHERE id = 'singleton'`
    );
    const invoiceNo = calcInvoiceNo(settings[0].invoicePrefix, settings[0].nextInvoiceNo);

    // Determine payment status
    let paymentStatus: string;
    if (paidAmount <= 0) {
      paymentStatus = "unpaid";
    } else if (paidAmount >= totalAmount) {
      paymentStatus = "paid";
    } else {
      paymentStatus = "partial";
    }

    // Insert sale
    await sq.execute(
      `INSERT INTO sales (id, customer_id, invoice_no, subtotal, discount_amount, tax_amount,
         total_amount, paid_amount, payment_status, payment_method, notes,
         sale_date, due_date, is_cancelled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        saleId, customerId, invoiceNo, subtotal, discountAmount, taxAmount,
        totalAmount, paidAmount, paymentStatus,
        paymentMethod ?? null, notes, saleDate, dueDate, now, now,
      ]
    );

    // Increment invoice number
    await sq.execute(
      `UPDATE app_settings SET next_invoice_no = next_invoice_no + 1, updated_at = ? WHERE id = 'singleton'`,
      [now]
    );

    // Insert sale items + stock movements
    for (const item of items) {
      const itemId = generateId();

      await sq.execute(
        `INSERT INTO sale_items (id, sale_id, product_id, quantity, sale_price, cost_price, discount_pct, total_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId, saleId, item.product.id, item.quantity,
          item.salePrice, item.costPrice, item.discountPct, item.totalAmount,
        ]
      );

      // Read current stock for stockBefore/After
      const stockRow = await sq.select<{ stock: number }[]>(
        `SELECT stock FROM products WHERE id = ?`,
        [item.product.id]
      );
      const stockBefore = stockRow[0].stock;
      const stockAfter = stockBefore - item.quantity;

      // Decrement stock — avgCost unchanged on sale_out
      await sq.execute(
        `UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?`,
        [item.quantity, now, item.product.id]
      );

      // Stock movement
      await sq.execute(
        `INSERT INTO stock_movements (id, product_id, movement_type, quantity, cost_price,
           reference_type, reference_id, stock_before, stock_after, notes, created_at)
         VALUES (?, ?, ?, ?, ?, 'sale', ?, ?, ?, NULL, ?)`,
        [
          generateId(), item.product.id, MOVEMENT_TYPES.SALE_OUT,
          item.quantity, item.costPrice,
          saleId, stockBefore, stockAfter, now,
        ]
      );
    }

    // Update customer outstanding balance (not for WALKIN)
    if (customerId !== WALKIN_CUSTOMER_ID && balanceDue > 0) {
      await sq.execute(
        `UPDATE customers SET outstanding_balance = outstanding_balance + ?, updated_at = ? WHERE id = ?`,
        [balanceDue, now, customerId]
      );
    }

    // Insert payment row if money was paid
    if (paidAmount > 0 && paymentMethod) {
      await sq.execute(
        `INSERT INTO payments (id, type, party_id, reference_id, amount, payment_method,
           is_refund, payment_date, is_reversed, created_at)
         VALUES (?, 'customer', ?, ?, ?, ?, 0, ?, 0, ?)`,
        [generateId(), customerId, saleId, paidAmount, paymentMethod, saleDate, now]
      );
    }

    // Audit log
    await sq.execute(
      `INSERT INTO audit_log (id, event_type, entity_type, entity_id, description, new_values, created_at)
       VALUES (?, ?, 'sale', ?, ?, ?, ?)`,
      [
        generateId(),
        AUDIT_EVENTS.SALE_CREATED,
        saleId,
        `Sale ${invoiceNo} created for ${customer.shopName} — Rs. ${totalAmount.toFixed(2)}`,
        JSON.stringify({ invoiceNo, totalAmount, paidAmount, paymentStatus }),
        now,
      ]
    );
  });

  return saleId;
}

// ─── CANCEL SALE ──────────────────────────────────────────────────────────────

export async function cancelSale(saleId: string, reason: string): Promise<void> {
  const sqlite = getSqlite();

  // Pre-checks (outside transaction — read-only)
  const saleRows = await sqlite.select<{
    paymentStatus: string;
    isCancelled: number;
    totalAmount: number;
    paidAmount: number;
    customerId: string;
    invoiceNo: string;
  }[]>(
    `SELECT payment_status as paymentStatus, is_cancelled as isCancelled,
            total_amount as totalAmount, paid_amount as paidAmount,
            customer_id as customerId, invoice_no as invoiceNo
     FROM sales WHERE id = ?`,
    [saleId]
  );
  if (saleRows.length === 0) throw new Error("Sale not found.");

  const sale = saleRows[0];
  if (sale.isCancelled) throw new Error("This sale is already cancelled.");
  if (sale.paymentStatus !== "unpaid") {
    throw new Error("Cannot cancel this sale — payments have been recorded. Use a sale return to reverse items and refund the customer.");
  }

  const paymentCheck = await sqlite.select<{ c: number }[]>(
    `SELECT COUNT(*) as c FROM payments WHERE reference_id = ? AND is_reversed = 0`,
    [saleId]
  );
  if (paymentCheck[0].c > 0) {
    throw new Error("Cannot cancel this sale — payments have been recorded. Use a sale return to reverse items and refund the customer.");
  }

  // Fetch items
  const itemRows = await sqlite.select<{
    productId: string;
    quantity: number;
    costPrice: number;
  }[]>(
    `SELECT product_id as productId, quantity, cost_price as costPrice FROM sale_items WHERE sale_id = ?`,
    [saleId]
  );

  const now = nowISO();

  await withTransaction(async () => {
    const sq = getSqlite();

    // Mark sale cancelled
    await sq.execute(
      `UPDATE sales SET is_cancelled = 1, cancel_reason = ?, updated_at = ? WHERE id = ?`,
      [reason, now, saleId]
    );

    // Restore stock for each item — avgCost NOT changed
    for (const item of itemRows) {
      const stockRow = await sq.select<{ stock: number }[]>(
        `SELECT stock FROM products WHERE id = ?`,
        [item.productId]
      );
      const stockBefore = stockRow[0].stock;
      const stockAfter = stockBefore + item.quantity;

      await sq.execute(
        `UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?`,
        [item.quantity, now, item.productId]
      );

      await sq.execute(
        `INSERT INTO stock_movements (id, product_id, movement_type, quantity, cost_price,
           reference_type, reference_id, stock_before, stock_after, notes, created_at)
         VALUES (?, ?, ?, ?, ?, 'sale', ?, ?, ?, ?, ?)`,
        [
          generateId(), item.productId, MOVEMENT_TYPES.SALE_CANCELLED,
          item.quantity, item.costPrice,
          saleId, stockBefore, stockAfter,
          `Cancellation: ${reason}`,
          now,
        ]
      );
    }

    // Reverse customer outstanding balance if applicable
    const balanceDue = Math.max(0, sale.totalAmount - sale.paidAmount);
    if (sale.customerId !== WALKIN_CUSTOMER_ID && balanceDue > 0) {
      await sq.execute(
        `UPDATE customers SET outstanding_balance = outstanding_balance - ?, updated_at = ? WHERE id = ?`,
        [balanceDue, now, sale.customerId]
      );
    }

    // Audit log
    await sq.execute(
      `INSERT INTO audit_log (id, event_type, entity_type, entity_id, description, old_values, created_at)
       VALUES (?, ?, 'sale', ?, ?, ?, ?)`,
      [
        generateId(),
        AUDIT_EVENTS.SALE_CANCELLED,
        saleId,
        `Sale ${sale.invoiceNo} cancelled — ${reason}`,
        JSON.stringify({ invoiceNo: sale.invoiceNo, reason }),
        now,
      ]
    );
  });
}