// src/components/layout/Sidebar.tsx
import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard, Package, ShoppingBag, FileText, Users, Truck,
  CreditCard, Receipt, BarChart3, Settings, Scale, History,
  type LucideIcon,
} from "lucide-react";
import { getSqlite } from "@/db";
import { useAppStore } from "@/stores/appStore";
import { useCurrentPage, useNavigate } from "@/lib/navigation";
import type { AppPage } from "@/lib/navigation";
import { cn, todayDate } from "@/lib/utils";

type BadgeKey = "lowStock" | "overdue";

interface NavItem {
  label: string;
  page: AppPage;
  icon: LucideIcon;
  badge?: BadgeKey;
}

const MAIN_NAV: NavItem[] = [
  { label: "Dashboard", page: "dashboard",  icon: LayoutDashboard },
  { label: "Inventory", page: "inventory",  icon: Package, badge: "lowStock" },
  { label: "Purchases", page: "purchases",  icon: ShoppingBag },
  { label: "Sales",     page: "sales",      icon: FileText, badge: "overdue" },
  { label: "Customers", page: "customers",  icon: Users },
  { label: "Suppliers", page: "suppliers",  icon: Truck },
  { label: "Payments",  page: "payments",   icon: CreditCard },
  { label: "Expenses",  page: "expenses",   icon: Receipt },
  { label: "Reports",   page: "reports",    icon: BarChart3 },
];

const BADGE_STYLE: Record<BadgeKey, string> = {
  lowStock: "bg-[#fef3c7] text-[#d97706]",
  overdue:  "bg-[#fee2e2] text-[#dc2626]",
};

function isActivePage(current: AppPage, item: AppPage): boolean {
  return current === item || current.startsWith(`${item}/`);
}

export function Sidebar() {
  const { currentPage } = useCurrentPage();
  const navigate = useNavigate();
  const settings = useAppStore((s) => s.settings);
  const [counts, setCounts] = useState<Record<BadgeKey, number>>({ lowStock: 0, overdue: 0 });

  const refreshCounts = useCallback(async () => {
    try {
      const sqlite = getSqlite();
      const [low, over] = await Promise.all([
        sqlite.select<{ c: number }[]>(
          "SELECT COUNT(*) AS c FROM products WHERE is_active = 1 AND stock <= min_stock"
        ),
        // Per-invoice overdue — NOT customer.outstanding_balance > 0 (Financial Rules §13)
        sqlite.select<{ c: number }[]>(
          `SELECT COUNT(*) AS c FROM sales
            WHERE due_date < ? AND payment_status != 'paid' AND is_cancelled = 0`,
          [todayDate()]
        ),
      ]);
      setCounts({ lowStock: low[0]?.c ?? 0, overdue: over[0]?.c ?? 0 });
    } catch (err) {
      console.error("[Sidebar] Failed to refresh badge counts:", err);
    }
  }, []);

  // Live refresh every 30s
  useEffect(() => {
    const id = setInterval(() => void refreshCounts(), 30_000);
    return () => clearInterval(id);
  }, [refreshCounts]);

  // Also refresh on every page change so badges update right after a sale/purchase
  useEffect(() => {
    void refreshCounts();
  }, [currentPage, refreshCounts]);

  const items = MAIN_NAV.filter(
    (i) => i.page !== "expenses" || settings?.expensesEnabled
  );

  return (
    <aside className="flex h-full w-54 shrink-0 flex-col border-r border-[#e4e7ec] bg-white">
      <div className="flex h-13 items-center border-b border-[#e4e7ec] px-4">
        <span className="text-base font-bold text-[#2563eb]">StockWise</span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActivePage(currentPage, item.page);
          const count = item.badge ? counts[item.badge] : 0;
          return (
            <button
              key={item.page}
              type="button"
              onClick={() => navigate(item.page)}
              className={cn(
                "flex h-9 w-full items-center gap-2.5 rounded-[7px] px-3 text-sm transition-colors",
                active
                  ? "bg-[#eff6ff] font-medium text-[#2563eb]"
                  : "text-[#374151] hover:bg-[#f9fafb]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate text-left">{item.label}</span>
              {item.badge && count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none",
                    BADGE_STYLE[item.badge]
                  )}
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="space-y-0.5 border-t border-[#e4e7ec] p-2">
        <button
          type="button"
          onClick={() => navigate("settings")}
          className={cn(
            "flex h-9 w-full items-center gap-2.5 rounded-[7px] px-3 text-sm transition-colors",
            currentPage === "settings"
              ? "bg-[#eff6ff] font-medium text-[#2563eb]"
              : "text-[#374151] hover:bg-[#f9fafb]"
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Settings</span>
        </button>

        {([
          { label: "Opening Balances", page: "opening-balances" as AppPage, icon: Scale },
          { label: "Audit Log",        page: "audit-log" as AppPage,        icon: History },
        ]).map(({ label, page, icon: Icon }) => (
          <button
            key={page}
            type="button"
            onClick={() => navigate(page)}
            className={cn(
              "flex h-8 w-full items-center gap-2.5 rounded-[7px] pl-7 pr-3 text-xs transition-colors",
              currentPage === page
                ? "bg-[#eff6ff] font-medium text-[#2563eb]"
                : "text-[#6b7280] hover:bg-[#f9fafb]"
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="text-left">{label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

export default Sidebar;