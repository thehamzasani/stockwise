// src/lib/navigation.ts
import { createContext, useContext } from "react";

export type AppPage =
  | "dashboard"
  | "inventory"
  | "inventory/add"
  | "inventory/edit"
  | "purchases"
  | "purchases/new"
  | "sales"
  | "sales/new"
  | "customers"
  | "customers/add"
  | "customers/detail"
  | "suppliers"
  | "suppliers/add"
  | "payments"
  | "expenses"
  | "reports"
  | "settings"
  | "opening-balances"
  | "audit-log";

export interface NavigateParams {
  id?: string;
  customerId?: string;
  tab?: string;
}

export interface NavigationContextType {
  currentPage: AppPage;
  params: NavigateParams;
  navigate: (page: AppPage, params?: NavigateParams) => void;
}

export const NavigationContext = createContext<NavigationContextType>({
  currentPage: "dashboard",
  params: {},
  navigate: () => {},
});

export function useNavigate() {
  return useContext(NavigationContext).navigate;
}

export function useCurrentPage() {
  const ctx = useContext(NavigationContext);
  return { currentPage: ctx.currentPage, params: ctx.params };
}