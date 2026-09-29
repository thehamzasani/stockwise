// src/hooks/useReports.ts
import { useState, useEffect, useCallback } from "react";
import { getSqlite } from "@/db";
import { WALKIN_CUSTOMER_ID } from "@/lib/constants";
import { todayDate } from "@/lib/utils";
import type { DashboardStats, LowStockProduct } from "@/types";
import { addDaysToDate, calcMarginPct, daysOverdue } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import type {
  ProfitLossReport,
  TopProduct,
} from "@/types";
import { useRef } from "react";
// ─── useDashboardStats ────────────────────────────────────────────────────────

export function useDashboardStats() {
  const [data, setData] = useState<DashboardStats | null>(null);
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
        const today = todayDate();

        // Today's sales revenue (non-cancelled)
        const salesRes = await sqlite.select<{ total: number }[]>(`
          SELECT COALESCE(SUM(si.total_amount), 0) AS total
          FROM sale_items si
          JOIN sales s ON s.id = si.sale_id
          WHERE s.sale_date = ? AND s.is_cancelled = 0
        `, [today]);

        // Today's profit — uses si.cost_price ONLY, never products.avg_cost
        const profitRes = await sqlite.select<{ total: number }[]>(`
          SELECT COALESCE(SUM(si.total_amount - si.cost_price * si.quantity), 0) AS total
          FROM sale_items si
          JOIN sales s ON s.id = si.sale_id
          WHERE s.sale_date = ? AND s.is_cancelled = 0
        `, [today]);

        // Total receivables — excludes WALKIN, only positive balances
        const receivablesRes = await sqlite.select<{ total: number }[]>(`
          SELECT COALESCE(SUM(outstanding_balance), 0) AS total
          FROM customers
          WHERE id != ? AND outstanding_balance > 0 AND is_active = 1
        `, [WALKIN_CUSTOMER_ID]);

        // Total payables
        const payablesRes = await sqlite.select<{ total: number }[]>(`
          SELECT COALESCE(SUM(outstanding_balance), 0) AS total
          FROM suppliers
          WHERE outstanding_balance > 0 AND is_active = 1
        `);

        // Stock value (sellable only: stock * avg_cost)
        const stockValueRes = await sqlite.select<{ total: number }[]>(`
          SELECT COALESCE(SUM(stock * avg_cost), 0) AS total
          FROM products
          WHERE is_active = 1
        `);

        // Overdue count — per-invoice definition
        const overdueRes = await sqlite.select<{ cnt: number }[]>(`
          SELECT COUNT(*) AS cnt
          FROM sales
          WHERE due_date < ? AND payment_status != 'paid' AND is_cancelled = 0
        `, [today]);

        // Low stock count
        const lowStockRes = await sqlite.select<{ cnt: number }[]>(`
          SELECT COUNT(*) AS cnt
          FROM products
          WHERE stock <= min_stock AND is_active = 1
        `);

        // Monthly sales data — last 30 days grouped by date
        const monthlySalesRes = await sqlite.select<{ date: string; sales: number; profit: number }[]>(`
          SELECT
            s.sale_date AS date,
            COALESCE(SUM(si.total_amount), 0) AS sales,
            COALESCE(SUM(si.total_amount - si.cost_price * si.quantity), 0) AS profit
          FROM sales s
          JOIN sale_items si ON si.sale_id = s.id
          WHERE s.sale_date >= date('now', '-29 days') AND s.is_cancelled = 0
          GROUP BY s.sale_date
          ORDER BY s.sale_date ASC
        `);

        if (!cancelled) {
          setData({
            todaySales: salesRes[0]?.total ?? 0,
            todayProfit: profitRes[0]?.total ?? 0,
            totalReceivables: receivablesRes[0]?.total ?? 0,
            totalPayables: payablesRes[0]?.total ?? 0,
            stockValue: stockValueRes[0]?.total ?? 0,
            overdueCount: overdueRes[0]?.cnt ?? 0,
            lowStockCount: lowStockRes[0]?.cnt ?? 0,
            monthlySalesData: monthlySalesRes,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load dashboard stats");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [tick]);

  return { data, isLoading, error, refetch };
}

// ─── useLowStockProducts ─────────────────────────────────────────────────────

export function useLowStockProducts() {
  const [data, setData] = useState<LowStockProduct[]>([]);
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
        const rows = await sqlite.select<{
          id: string;
          name: string;
          category: string;
          brand: string | null;
          unit: string;
          barcode: string | null;
          avg_cost: number;
          sale_price: number;
          stock: number;
          damaged_stock: number;
          min_stock: number;
          description: string | null;
          is_active: number;
          created_at: string;
          updated_at: string;
        }[]>(`
          SELECT *
          FROM products
          WHERE stock <= min_stock AND is_active = 1
          ORDER BY stock ASC
          LIMIT 10
        `);

        if (!cancelled) {
          const products: LowStockProduct[] = rows.map((r) => ({
            id: r.id,
            name: r.name,
            category: r.category,
            brand: r.brand,
            unit: r.unit,
            barcode: r.barcode,
            avgCost: r.avg_cost,
            salePrice: r.sale_price,
            stock: r.stock,
            damagedStock: r.damaged_stock,
            minStock: r.min_stock,
            description: r.description,
            isActive: Boolean(r.is_active),
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            percentRemaining: r.min_stock > 0 ? Math.round((r.stock / r.min_stock) * 100) : 0,
          }));
          setData(products);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load low stock products");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [tick]);

  return { data, isLoading, error, refetch };
}

// ─── useRecentSales ───────────────────────────────────────────────────────────

interface RecentSale {
  id: string;
  invoiceNo: string;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  saleDate: string;
}

export function useRecentSales(limit = 5) {
  const [data, setData] = useState<RecentSale[]>([]);
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
        const rows = await sqlite.select<{
          id: string;
          invoice_no: string;
          shop_name: string;
          total_amount: number;
          paid_amount: number;
          payment_status: string;
          sale_date: string;
        }[]>(`
          SELECT s.id, s.invoice_no, c.shop_name, s.total_amount,
                 s.paid_amount, s.payment_status, s.sale_date
          FROM sales s
          JOIN customers c ON c.id = s.customer_id
          WHERE s.is_cancelled = 0
          ORDER BY s.created_at DESC
          LIMIT ?
        `, [limit]);

        if (!cancelled) {
          setData(
            rows.map((r) => ({
              id: r.id,
              invoiceNo: r.invoice_no,
              customerName: r.shop_name,
              totalAmount: r.total_amount,
              paidAmount: r.paid_amount,
              paymentStatus: r.payment_status,
              saleDate: r.sale_date,
            }))
          );
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load recent sales");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [tick]);

  return { data, isLoading, error, refetch };
}


// src/hooks/useReports.ts



// ═════════════════════════════════════════════════════════════════════════════
// TASK 3 HOOKS (unchanged)
// ═════════════════════════════════════════════════════════════════════════════

// ─── useDashboardStats ────────────────────────────────────────────────────────



// ─── useLowStockProducts ─────────────────────────────────────────────────────



// ─── useRecentSales ───────────────────────────────────────────────────────────

interface RecentSale {
  id: string;
  invoiceNo: string;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  saleDate: string;
}



// ═════════════════════════════════════════════════════════════════════════════
// TASK 13 HOOKS
// Rules (Financial Rules §2, §13, §15 / Coding Rule 20):
//   • Revenue = SUM(sale_items.total_amount)          — never sale_price × quantity
//   • COGS    = SUM(sale_items.cost_price × quantity)  — never products.avg_cost
//   • Cancelled sales always excluded (is_cancelled = 0)
//   • WALKIN excluded from every customer-facing report
//   • Overdue = per-invoice (due_date < today AND payment_status != 'paid' AND not cancelled)
// ═════════════════════════════════════════════════════════════════════════════

export interface QueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Shared plumbing for the report hooks below: { data, isLoading, error, refetch }.
function useAsync<T>(fetcher: () => Promise<T>, deps: readonly unknown[]): QueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetcherRef
      .current()
      .then((result: any) => {
        if (cancelled) return;
        setData(result);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("[useReports]", err);
        setError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { data, isLoading, error, refetch };
}

// ─── useProfitLoss ───────────────────────────────────────────────────────────

export function useProfitLoss(dateFrom: string, dateTo: string): QueryResult<ProfitLossReport> {
  const expensesEnabled = useAppStore((s) => s.settings?.expensesEnabled ?? false);

  return useAsync<ProfitLossReport>(async () => {
    const sqlite = getSqlite();

    const salesRows = await sqlite.select<{ total_sales: number; total_cogs: number }[]>(
      `SELECT COALESCE(SUM(si.total_amount), 0)             AS total_sales,
              COALESCE(SUM(si.cost_price * si.quantity), 0) AS total_cogs
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
        WHERE s.is_cancelled = 0 AND s.sale_date >= ? AND s.sale_date <= ?`,
      [dateFrom, dateTo]
    );
    const totalSales = salesRows[0]?.total_sales ?? 0;
    const totalCOGS = salesRows[0]?.total_cogs ?? 0;

    let totalExpenses = 0;
    if (expensesEnabled) {
      const expRows = await sqlite.select<{ total: number }[]>(
        `SELECT COALESCE(SUM(amount), 0) AS total
           FROM expenses WHERE expense_date >= ? AND expense_date <= ?`,
        [dateFrom, dateTo]
      );
      totalExpenses = expRows[0]?.total ?? 0;
    }

    const grossProfit = totalSales - totalCOGS;
    return {
      period: `${dateFrom} to ${dateTo}`,
      totalSales,
      totalCOGS,
      grossProfit,
      totalExpenses,
      netProfit: grossProfit - totalExpenses,
      grossMarginPct: calcMarginPct(totalSales, totalCOGS),
    };
  }, [dateFrom, dateTo, expensesEnabled]);
}

// ─── useTopProducts ──────────────────────────────────────────────────────────

export function useTopProducts(
  limit: number,
  dateFrom: string,
  dateTo: string
): QueryResult<TopProduct[]> {
  return useAsync<TopProduct[]>(async () => {
    const sqlite = getSqlite();
    const rows = await sqlite.select<{
      product_id: string;
      product_name: string;
      total_quantity: number;
      total_revenue: number;
      total_profit: number;
    }[]>(
      `SELECT p.id   AS product_id,
              p.name AS product_name,
              COALESCE(SUM(si.quantity), 0)     AS total_quantity,
              COALESCE(SUM(si.total_amount), 0) AS total_revenue,
              COALESCE(SUM(si.total_amount - si.cost_price * si.quantity), 0) AS total_profit
         FROM sale_items si
         JOIN sales s    ON s.id = si.sale_id
         JOIN products p ON p.id = si.product_id
        WHERE s.is_cancelled = 0 AND s.sale_date >= ? AND s.sale_date <= ?
        GROUP BY p.id, p.name
        ORDER BY total_revenue DESC
        LIMIT ?`,
      [dateFrom, dateTo, limit]
    );
    return rows.map((r) => ({
      productId: r.product_id,
      productName: r.product_name,
      totalQuantity: r.total_quantity,
      totalRevenue: r.total_revenue,
      totalProfit: r.total_profit,
    }));
  }, [limit, dateFrom, dateTo]);
}

// ─── useSlowProducts ─────────────────────────────────────────────────────────

export interface SlowProduct {
  id: string;
  name: string;
  category: string;
  stock: number;
  avgCost: number;
  stockValue: number;
  lastSoldDate: string | null;
  daysSinceSold: number | null; // null = never sold
}

// Active products WITH stock on hand and zero non-cancelled sales in the last N days.
export function useSlowProducts(days = 30): QueryResult<SlowProduct[]> {
  return useAsync<SlowProduct[]>(async () => {
    const sqlite = getSqlite();
    const since = addDaysToDate(todayDate(), -days);
    const rows = await sqlite.select<{
      id: string;
      name: string;
      category: string;
      stock: number;
      avg_cost: number;
      last_sold: string | null;
    }[]>(
      `SELECT p.id, p.name, p.category, p.stock, p.avg_cost,
              (SELECT MAX(s.sale_date)
                 FROM sale_items si JOIN sales s ON s.id = si.sale_id
                WHERE si.product_id = p.id AND s.is_cancelled = 0) AS last_sold
         FROM products p
        WHERE p.is_active = 1 AND p.stock > 0
          AND NOT EXISTS (
                SELECT 1 FROM sale_items si JOIN sales s ON s.id = si.sale_id
                 WHERE si.product_id = p.id AND s.is_cancelled = 0 AND s.sale_date >= ?
              )
        ORDER BY (p.stock * p.avg_cost) DESC`,
      [since]
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      stock: r.stock,
      avgCost: r.avg_cost,
      stockValue: r.stock * r.avg_cost,
      lastSoldDate: r.last_sold,
      // daysOverdue(date) = whole days elapsed since that date, never negative
      daysSinceSold: r.last_sold ? daysOverdue(r.last_sold) : null,
    }));
  }, [days]);
}

// ─── useStockValuation ───────────────────────────────────────────────────────

export interface CategoryValuation {
  category: string;
  productCount: number;
  sellableUnits: number;
  sellableValue: number;
  damagedUnits: number;
  damagedValue: number;
}

export interface StockValuation {
  sellableValue: number;
  damagedValue: number;
  totalValue: number;
  sellableUnits: number;
  damagedUnits: number;
  byCategory: CategoryValuation[];
}

// Sellable and damaged stock valued separately, both at current avg_cost.
// Active products only, so the sellable total matches the dashboard's stockValue.
export function useStockValuation(): QueryResult<StockValuation> {
  return useAsync<StockValuation>(async () => {
    const sqlite = getSqlite();
    const rows = await sqlite.select<{
      category: string;
      product_count: number;
      sellable_units: number;
      sellable_value: number;
      damaged_units: number;
      damaged_value: number;
    }[]>(
      `SELECT category,
              COUNT(*)                                    AS product_count,
              COALESCE(SUM(stock), 0)                     AS sellable_units,
              COALESCE(SUM(stock * avg_cost), 0)          AS sellable_value,
              COALESCE(SUM(damaged_stock), 0)             AS damaged_units,
              COALESCE(SUM(damaged_stock * avg_cost), 0)  AS damaged_value
         FROM products
        WHERE is_active = 1
        GROUP BY category
        ORDER BY sellable_value DESC`
    );

    const byCategory: CategoryValuation[] = rows.map((r) => ({
      category: r.category,
      productCount: r.product_count,
      sellableUnits: r.sellable_units,
      sellableValue: r.sellable_value,
      damagedUnits: r.damaged_units,
      damagedValue: r.damaged_value,
    }));

    const sellableValue = byCategory.reduce((s, c) => s + c.sellableValue, 0);
    const damagedValue = byCategory.reduce((s, c) => s + c.damagedValue, 0);
    return {
      sellableValue,
      damagedValue,
      totalValue: sellableValue + damagedValue,
      sellableUnits: byCategory.reduce((s, c) => s + c.sellableUnits, 0),
      damagedUnits: byCategory.reduce((s, c) => s + c.damagedUnits, 0),
      byCategory,
    };
  }, []);
}

// ─── useReceivablesReport ────────────────────────────────────────────────────

export type AgingBucket = "current" | "1-30" | "31-60" | "61-90" | "90+";

export interface ReceivableRow {
  customerId: string;
  shopName: string;
  city: string | null;
  phone: string | null;
  outstandingBalance: number;
  overdueInvoices: number;
  oldestDueDate: string | null; // oldest OVERDUE invoice due date; null if nothing overdue
  daysOverdue: number;
  bucket: AgingBucket;
}

export interface ReceivablesReport {
  rows: ReceivableRow[];
  totalOutstanding: number;
  buckets: Record<AgingBucket, { count: number; amount: number }>;
}

function bucketFor(hasOverdue: boolean, days: number): AgingBucket {
  if (!hasOverdue) return "current";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

// Aged by each customer's OLDEST overdue invoice due date (per-invoice overdue, §13).
// Same filters as the dashboard receivables KPI (not WALKIN, active, balance > 0),
// so the report total matches the dashboard number.
export function useReceivablesReport(): QueryResult<ReceivablesReport> {
  return useAsync<ReceivablesReport>(async () => {
    const sqlite = getSqlite();
    const today = todayDate();
    const rows = await sqlite.select<{
      id: string;
      shop_name: string;
      city: string | null;
      phone: string | null;
      outstanding_balance: number;
      oldest_due: string | null;
      overdue_invoices: number;
    }[]>(
      `SELECT c.id, c.shop_name, c.city, c.phone, c.outstanding_balance,
              (SELECT MIN(s.due_date) FROM sales s
                WHERE s.customer_id = c.id AND s.is_cancelled = 0
                  AND s.payment_status != 'paid' AND s.due_date < ?) AS oldest_due,
              (SELECT COUNT(*) FROM sales s
                WHERE s.customer_id = c.id AND s.is_cancelled = 0
                  AND s.payment_status != 'paid' AND s.due_date < ?) AS overdue_invoices
         FROM customers c
        WHERE c.id != ? AND c.outstanding_balance > 0 AND c.is_active = 1
        ORDER BY c.outstanding_balance DESC`,
      [today, today, WALKIN_CUSTOMER_ID]
    );

    const buckets: ReceivablesReport["buckets"] = {
      current: { count: 0, amount: 0 },
      "1-30": { count: 0, amount: 0 },
      "31-60": { count: 0, amount: 0 },
      "61-90": { count: 0, amount: 0 },
      "90+": { count: 0, amount: 0 },
    };

    const mapped: ReceivableRow[] = rows.map((r) => {
      const days = r.oldest_due ? daysOverdue(r.oldest_due) : 0;
      const bucket = bucketFor(r.oldest_due !== null, days);
      buckets[bucket].count += 1;
      buckets[bucket].amount += r.outstanding_balance;
      return {
        customerId: r.id,
        shopName: r.shop_name,
        city: r.city,
        phone: r.phone,
        outstandingBalance: r.outstanding_balance,
        overdueInvoices: r.overdue_invoices,
        oldestDueDate: r.oldest_due,
        daysOverdue: days,
        bucket,
      };
    });

    return {
      rows: mapped,
      totalOutstanding: mapped.reduce((s, r) => s + r.outstandingBalance, 0),
      buckets,
    };
  }, []);
}

// ─── usePayablesReport ───────────────────────────────────────────────────────

export interface PayableRow {
  supplierId: string | null;
  supplierName: string;
  phone: string | null;
  unpaidCount: number;
  oldestPurchaseDate: string;
  amountDue: number; // SUM(total_amount - paid_amount) of unpaid/partial purchases
}

export interface PayablesReport {
  rows: PayableRow[];
  totalDue: number;
}

// Unpaid / partial, non-cancelled purchases grouped by supplier. This is a per-invoice
// view; the authoritative supplier balance (opening balance + returns included) is
// suppliers.outstanding_balance, which the dashboard uses.
export function usePayablesReport(): QueryResult<PayablesReport> {
  return useAsync<PayablesReport>(async () => {
    const sqlite = getSqlite();
    const rows = await sqlite.select<{
      supplier_id: string | null;
      supplier_name: string;
      phone: string | null;
      unpaid_count: number;
      oldest_date: string;
      amount_due: number;
    }[]>(
      `SELECT p.supplier_id                         AS supplier_id,
              COALESCE(su.name, 'No supplier')      AS supplier_name,
              su.phone                              AS phone,
              COUNT(*)                              AS unpaid_count,
              MIN(p.purchase_date)                  AS oldest_date,
              COALESCE(SUM(p.total_amount - p.paid_amount), 0) AS amount_due
         FROM purchases p
         LEFT JOIN suppliers su ON su.id = p.supplier_id
        WHERE p.is_cancelled = 0 AND p.payment_status != 'paid'
        GROUP BY p.supplier_id
        ORDER BY amount_due DESC`
    );

    const mapped: PayableRow[] = rows.map((r) => ({
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      phone: r.phone,
      unpaidCount: r.unpaid_count,
      oldestPurchaseDate: r.oldest_date,
      amountDue: r.amount_due,
    }));
    return { rows: mapped, totalDue: mapped.reduce((s, r) => s + r.amountDue, 0) };
  }, []);
}

// ─── useSalesByCity ──────────────────────────────────────────────────────────

export interface CityRow {
  city: string;
  customerCount: number;
  invoiceCount: number;
  revenue: number;
  profit: number;
  marginPct: number;
  sharePct: number;
}

// WALKIN excluded twice on purpose (s.customer_id and c.id) per Coding Rule 20.
// dateFrom / dateTo optional — omit both for all-time.
export function useSalesByCity(dateFrom?: string, dateTo?: string): QueryResult<CityRow[]> {
  return useAsync<CityRow[]>(async () => {
    const sqlite = getSqlite();
    const from = dateFrom ?? "0000-01-01";
    const to = dateTo ?? "9999-12-31";
    const rows = await sqlite.select<{
      city: string;
      customer_count: number;
      invoice_count: number;
      revenue: number;
      profit: number;
    }[]>(
      `SELECT COALESCE(NULLIF(TRIM(c.city), ''), 'Unknown') AS city,
              COUNT(DISTINCT s.customer_id) AS customer_count,
              COUNT(DISTINCT s.id)          AS invoice_count,
              COALESCE(SUM(si.total_amount), 0) AS revenue,
              COALESCE(SUM(si.total_amount - si.cost_price * si.quantity), 0) AS profit
         FROM sales s
         JOIN customers c   ON c.id = s.customer_id
         JOIN sale_items si ON si.sale_id = s.id
        WHERE s.is_cancelled = 0
          AND s.customer_id != ? AND c.id != ?
          AND s.sale_date >= ? AND s.sale_date <= ?
        GROUP BY COALESCE(NULLIF(TRIM(c.city), ''), 'Unknown')
        ORDER BY revenue DESC`,
      [WALKIN_CUSTOMER_ID, WALKIN_CUSTOMER_ID, from, to]
    );

    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    return rows.map((r) => ({
      city: r.city,
      customerCount: r.customer_count,
      invoiceCount: r.invoice_count,
      revenue: r.revenue,
      profit: r.profit,
      marginPct: calcMarginPct(r.revenue, r.revenue - r.profit),
      sharePct: totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0,
    }));
  }, [dateFrom, dateTo]);
}