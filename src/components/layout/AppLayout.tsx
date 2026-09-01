// src/components/layout/AppLayout.tsx
import { useEffect, useState, useCallback } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { getSqlite } from "@/db";

interface BadgeCounts {
  overdueInvoices: number;
  lowStockProducts: number;
}

interface AppLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function AppLayout({ title, subtitle, children }: AppLayoutProps) {
  const [badges, setBadges] = useState<BadgeCounts>({ overdueInvoices: 0, lowStockProducts: 0 });

  const fetchBadges = useCallback(async () => {
    try {
      const sqlite = getSqlite();

      // Overdue: per-invoice — dueDate < today, not paid, not cancelled
      const overdueRows = await sqlite.select<{ c: number }[]>(
        `SELECT COUNT(*) AS c FROM sales
          WHERE due_date < date('now')
            AND payment_status != 'paid'
            AND is_cancelled = 0`
      );

      // Low stock: active products where stock <= min_stock
      const lowRows = await sqlite.select<{ c: number }[]>(
        `SELECT COUNT(*) AS c FROM products
          WHERE is_active = 1 AND stock <= min_stock`
      );

      setBadges({
        overdueInvoices:  overdueRows[0]?.c  ?? 0,
        lowStockProducts: lowRows[0]?.c      ?? 0,
      });
    } catch (err) {
      console.error("[AppLayout] Badge fetch failed:", err);
    }
  }, []);

  useEffect(() => {
    void fetchBadges();
    const interval = setInterval(() => void fetchBadges(), 30_000);
    return () => clearInterval(interval);
  }, [fetchBadges]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f0f2f5]">
      {/* Sidebar — fixed left column */}
      <Sidebar
        overdueCount={badges.overdueInvoices}
        lowStockCount={badges.lowStockProducts}
      />

      {/* Main area — scrollable */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title={title} subtitle={subtitle} />

        <main
          id="sw-main-content"
          className="flex-1 overflow-y-auto"
        >
          {children}
        </main>
      </div>
    </div>
  );
}