// src/hooks/useReports.ts
import { useState, useEffect, useCallback } from "react";
import { getSqlite } from "@/db";
import { WALKIN_CUSTOMER_ID } from "@/lib/constants";
import { todayDate } from "@/lib/utils";
import type { DashboardStats, LowStockProduct } from "@/types";

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