// src/components/layout/Sidebar.tsx
import { useAppStore } from "@/stores/appStore";
import { useNavigate, useCurrentPage } from "@/lib/navigation";
import type { AppPage } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Receipt,
  Users,
  Truck,
  CreditCard,
  Wallet,
  BarChart3,
  Settings,
  Scale,
  ClipboardList,
  AlertTriangle,
} from "lucide-react";

interface SidebarProps {
  overdueCount: number;
  lowStockCount: number;
}

interface NavItem {
  page: AppPage;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  badgeColor?: "red" | "amber";
}

interface NavSection {
  heading?: string;
  items: NavItem[];
}

export default function Sidebar({ overdueCount, lowStockCount }: SidebarProps) {
  const navigate      = useNavigate();
  const { currentPage } = useCurrentPage();
  const settings      = useAppStore((s) => s.settings);

  const sections: NavSection[] = [
    {
      items: [
        {
          page: "dashboard",
          label: "Dashboard",
          icon: <LayoutDashboard size={16} />,
        },
      ],
    },
    {
      heading: "Operations",
      items: [
        {
          page: "inventory",
          label: "Inventory",
          icon: <Package size={16} />,
          badge: lowStockCount > 0 ? lowStockCount : undefined,
          badgeColor: "amber",
        },
        {
          page: "purchases",
          label: "Purchases",
          icon: <ShoppingCart size={16} />,
        },
        {
          page: "sales",
          label: "Sales",
          icon: <Receipt size={16} />,
          badge: overdueCount > 0 ? overdueCount : undefined,
          badgeColor: "red",
        },
      ],
    },
    {
      heading: "Parties",
      items: [
        {
          page: "customers",
          label: "Customers",
          icon: <Users size={16} />,
        },
        {
          page: "suppliers",
          label: "Suppliers",
          icon: <Truck size={16} />,
        },
      ],
    },
    {
      heading: "Finance",
      items: [
        {
          page: "payments",
          label: "Payments",
          icon: <CreditCard size={16} />,
        },
        // Expenses only shown when expensesEnabled
        ...(settings?.expensesEnabled
          ? [
              {
                page: "expenses" as AppPage,
                label: "Expenses",
                icon: <Wallet size={16} />,
              },
            ]
          : []),
        {
          page: "reports",
          label: "Reports",
          icon: <BarChart3 size={16} />,
        },
      ],
    },
    {
      heading: "Settings",
      items: [
        {
          page: "settings",
          label: "Settings",
          icon: <Settings size={16} />,
        },
      ],
    },
  ];

  // Smaller utility links below main nav
  const utilityLinks: { page: AppPage; label: string; icon: React.ReactNode }[] = [
    {
      page: "opening-balances",
      label: "Opening Balances",
      icon: <Scale size={13} />,
    },
    {
      page: "audit-log",
      label: "Audit Log",
      icon: <ClipboardList size={13} />,
    },
  ];

  function isActive(page: AppPage): boolean {
    // Mark parent active for sub-pages
    if (currentPage === page) return true;
    if (page === "inventory" && currentPage.startsWith("inventory/")) return true;
    if (page === "purchases" && currentPage.startsWith("purchases/")) return true;
    if (page === "sales"     && currentPage.startsWith("sales/"))     return true;
    if (page === "customers" && currentPage.startsWith("customers/")) return true;
    if (page === "suppliers" && currentPage.startsWith("suppliers/")) return true;
    return false;
  }

  return (
    <aside
      className="flex h-full flex-col border-r border-[#e4e7ec] bg-white"
      style={{ width: "216px", minWidth: "216px" }}
    >
      {/* Logo / Brand */}
      <div className="flex h-[52px] items-center gap-2 border-b border-[#e4e7ec] px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[#2563eb]">
          <Package size={14} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-[#111827]">StockWise</span>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto py-3">
        {sections.map((section, si) => (
          <div key={si} className="mb-1">
            {section.heading && (
              <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">
                {section.heading}
              </p>
            )}
            {section.items.map((item) => (
              <button
                key={item.page}
                onClick={() => navigate(item.page)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[7px] mx-2 px-2.5 py-[7px] text-sm transition-colors",
                  "w-[calc(100%-16px)]",
                  isActive(item.page)
                    ? "bg-[#eff6ff] text-[#2563eb] font-medium"
                    : "text-[#374151] hover:bg-[#f9fafb] hover:text-[#111827]"
                )}
              >
                <span className={isActive(item.page) ? "text-[#2563eb]" : "text-[#6b7280]"}>
                  {item.icon}
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={cn(
                      "flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                      item.badgeColor === "red"
                        ? "bg-[#fee2e2] text-[#dc2626]"
                        : "bg-[#fef3c7] text-[#d97706]"
                    )}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}

        {/* Overdue callout if any */}
        {overdueCount > 0 && (
          <div className="mx-3 mt-2 flex items-center gap-1.5 rounded-[7px] border border-[#fecaca] bg-[#fff5f5] px-2.5 py-2">
            <AlertTriangle size={11} className="shrink-0 text-[#dc2626]" />
            <span className="text-[11px] text-[#dc2626]">
              {overdueCount} overdue invoice{overdueCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Utility links */}
        <div className="mt-3 border-t border-[#e4e7ec] pt-3">
          {utilityLinks.map((link) => (
            <button
              key={link.page}
              onClick={() => navigate(link.page)}
              className={cn(
                "flex w-[calc(100%-16px)] mx-2 items-center gap-2 rounded-[7px] px-2.5 py-[6px] text-xs transition-colors",
                currentPage === link.page
                  ? "bg-[#eff6ff] text-[#2563eb] font-medium"
                  : "text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#374151]"
              )}
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Business name footer */}
      {settings?.businessName && (
        <div className="border-t border-[#e4e7ec] px-4 py-3">
          <p className="truncate text-[11px] text-[#9ca3af]">{settings.businessName}</p>
        </div>
      )}
    </aside>
  );
}