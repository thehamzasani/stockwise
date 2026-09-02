// src/hooks/useStockMovements.ts
import { useState, useEffect } from "react";
import { getSqlite } from "@/db";
import type { StockMovement } from "@/types";
import { ITEMS_PER_PAGE } from "@/lib/constants";

interface UseStockMovementsResult {
  data: StockMovement[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useStockMovements(productId?: string, page = 1): UseStockMovementsResult {
  const [data, setData] = useState<StockMovement[]>([]);
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

        let countSql = "SELECT COUNT(*) AS c FROM stock_movements";
        let dataSql = `
          SELECT sm.*, p.name AS product_name
          FROM stock_movements sm
          JOIN products p ON p.id = sm.product_id
        `;
        const params: unknown[] = [];

        if (productId) {
          countSql += " WHERE product_id = ?";
          dataSql += " WHERE sm.product_id = ?";
          params.push(productId);
        }

        dataSql += " ORDER BY sm.created_at DESC LIMIT ? OFFSET ?";
        params.push(ITEMS_PER_PAGE, offset);

        const countParams = productId ? [productId] : [];
        const countResult = await sqlite.select<{ c: number }[]>(countSql, countParams);
        const rows = await sqlite.select<(StockMovement & { product_name: string })[]>(dataSql, params);

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
  }, [productId, page, tick]);

  return { data, totalCount, isLoading, error, refetch: () => setTick((t) => t + 1) };
}