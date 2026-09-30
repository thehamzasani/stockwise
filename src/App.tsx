// src/App.tsx
import { useState, useEffect } from "react";
import { NavigationContext } from "@/lib/navigation";
import type { AppPage, NavigateParams } from "@/lib/navigation";
import { useAppStore } from "@/stores/appStore";
import { useSaleStore } from "@/stores/saleStore";
import { getSqlite } from "@/db";
import { SETTINGS_ID } from "@/lib/constants";
import type { AppSettings } from "@/types";
import AppLayout from "@/components/layout/AppLayout";
import  GlobalSearch  from "@/components/shared/GlobalSearch";
import { flushPendingRestoreAudit } from "@/hooks/useBackup";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import Dashboard from "@/pages/Dashboard";
import InventoryPage from "@/pages/inventory/InventoryPage";
import AddProductPage from "@/pages/inventory/AddProductPage";
import EditProductPage from "@/pages/inventory/EditProductPage";
import PurchasesPage from "@/pages/purchases/PurchasesPage";
import NewPurchasePage from "@/pages/purchases/NewPurchasePage";
import { SalesPage } from "@/pages/sales/SalesPage";
import { NewSalePage } from "@/pages/sales/NewSalePage";
import CustomersPage from "@/pages/customers/CustomersPage";
import AddCustomerPage from "@/pages/customers/AddCustomerPage";
import CustomerDetailPage from "@/pages/customers/CustomerDetailPage";
import SuppliersPage from "@/pages/suppliers/SuppliersPage";
import AddSupplierPage from "@/pages/suppliers/AddSupplierPage";
import PaymentsPage from "@/pages/payments/PaymentsPage";
import { ExpensesPage } from "@/pages/expenses/ExpensesPage";
import ReportsPage from "@/pages/reports/ReportsPage";
import SettingsPage from "@/pages/settings/SettingsPage";
import OpeningBalancesPage from "@/pages/OpeningBalancesPage";
import AuditLogPage from "@/pages/AuditLogPage";

// Must render INSIDE NavigationContext.Provider — shortcuts call useNavigate().
function GlobalShortcuts() {
  useKeyboardShortcuts();
  return null;
}

const PAGE_META: Record<AppPage, { title: string; subtitle?: string }> = {
  dashboard:          { title: "Dashboard",        subtitle: "Overview & KPIs" },
  inventory:          { title: "Inventory",        subtitle: "Products & stock levels" },
  "inventory/add":    { title: "Add Product",      subtitle: "Create a new product" },
  "inventory/edit":   { title: "Edit Product",     subtitle: "Update product details" },
  purchases:          { title: "Purchases",        subtitle: "Supplier orders & payments" },
  "purchases/new":    { title: "New Purchase",     subtitle: "Record a supplier purchase" },
  sales:              { title: "Sales",            subtitle: "Customer invoices" },
  "sales/new":        { title: "New Sale",         subtitle: "Create an invoice" },
  customers:          { title: "Customers",        subtitle: "Manage customer accounts" },
  "customers/add":    { title: "Add Customer",     subtitle: "Register a new customer" },
  "customers/detail": { title: "Customer Details", subtitle: "Account & ledger" },
  suppliers:          { title: "Suppliers",        subtitle: "Manage suppliers" },
  "suppliers/add":    { title: "Add Supplier",     subtitle: "Register a new supplier" },
  payments:           { title: "Payments",         subtitle: "Payment history & recording" },
  expenses:           { title: "Expenses",         subtitle: "Business expenses" },
  reports:            { title: "Reports",          subtitle: "Analytics & financials" },
  settings:           { title: "Settings",         subtitle: "App & business configuration" },
  "opening-balances": { title: "Opening Balances", subtitle: "Set starting balances & stock" },
  "audit-log":        { title: "Audit Log",        subtitle: "System activity history" },
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>("dashboard");
  const [params, setParams] = useState<NavigateParams>({});
  const { setSettings } = useAppStore();

  // Load settings once on mount — Zustand holds them for sidebar + feature flags
  useEffect(() => {
    async function loadSettings() {
      try {
        const sqlite = getSqlite();
        const rows = await sqlite.select<AppSettings[]>(
          "SELECT * FROM app_settings WHERE id = ?",
          [SETTINGS_ID]
        );
        if (rows[0]) setSettings(rows[0]);
        void flushPendingRestoreAudit();
      } catch (err) {
        console.error("[App] Failed to load settings:", err);
      }
    }
    void loadSettings();
  }, [setSettings]);

  // "New Sale for this Customer" → navigate("sales/new", { customerId }).
  // Runs as a parent effect, i.e. AFTER NewSalePage's own mount effects,
  // so a resetSale() on mount cannot wipe the pre-selected customer.
  useEffect(() => {
    if (currentPage === "sales/new" && params.customerId) {
      useSaleStore.getState().setCustomer(params.customerId);
    }
  }, [currentPage, params]);

  function navigate(page: AppPage, p: NavigateParams = {}) {
    setCurrentPage(page);
    setParams(p);
    document.getElementById("sw-main-content")?.scrollTo(0, 0);
  }

  const meta = PAGE_META[currentPage];

  function renderPage() {
    switch (currentPage) {
      case "dashboard":        return <Dashboard />;
      case "inventory":        return <InventoryPage />;
      case "inventory/add":    return <AddProductPage />;
      case "inventory/edit":   return <EditProductPage />;
      case "purchases":        return <PurchasesPage />;
      case "purchases/new":    return <NewPurchasePage />;
      case "sales":            return <SalesPage />;
      case "sales/new":        return <NewSalePage />;
      case "customers":        return <CustomersPage />;
      case "customers/add":    return <AddCustomerPage />;
      case "customers/detail": return <CustomerDetailPage />;
      case "suppliers":        return <SuppliersPage />;
      case "suppliers/add":    return <AddSupplierPage />;
      case "payments":         return <PaymentsPage />;
      case "expenses":         return <ExpensesPage />;
      case "reports":          return <ReportsPage />;
      case "settings":         return <SettingsPage />;
      case "opening-balances": return <OpeningBalancesPage />;
      case "audit-log":        return <AuditLogPage />;
      default:                 return <Dashboard />;
    }
  }

  return (
    <NavigationContext.Provider value={{ currentPage, params, navigate }}>
      <GlobalShortcuts />
      <AppLayout
        title={meta.title}
        subtitle={meta.subtitle}
        action={<GlobalSearch />}
      >
        {renderPage()}
      </AppLayout>
    </NavigationContext.Provider>
  );
}