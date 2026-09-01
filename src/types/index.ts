// src/types/index.ts
import type {
  products,
  customers,
  suppliers,
  sales,
  saleItems,
  purchases,
  purchaseItems,
  payments,
  expenses,
  appSettings,
  stockMovements,
  saleReturns,
  purchaseReturns,
  auditLog,
  openingBalances,
} from "@/db/schema";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

export type Product        = InferSelectModel<typeof products>;
export type NewProduct     = InferInsertModel<typeof products>;
export type Customer       = InferSelectModel<typeof customers>;
export type NewCustomer    = InferInsertModel<typeof customers>;
export type Supplier       = InferSelectModel<typeof suppliers>;
export type NewSupplier    = InferInsertModel<typeof suppliers>;
export type Sale           = InferSelectModel<typeof sales>;
export type NewSale        = InferInsertModel<typeof sales>;
export type SaleItem       = InferSelectModel<typeof saleItems>;
export type Purchase       = InferSelectModel<typeof purchases>;
export type NewPurchase    = InferInsertModel<typeof purchases>;
export type PurchaseItem   = InferSelectModel<typeof purchaseItems>;
export type Payment        = InferSelectModel<typeof payments>;
export type NewPayment     = InferInsertModel<typeof payments>;
export type Expense        = InferSelectModel<typeof expenses>;
export type NewExpense     = InferInsertModel<typeof expenses>;
export type AppSettings    = InferSelectModel<typeof appSettings>;
export type StockMovement  = InferSelectModel<typeof stockMovements>;
export type SaleReturn     = InferSelectModel<typeof saleReturns>;
export type PurchaseReturn = InferSelectModel<typeof purchaseReturns>;
export type AuditLog       = InferSelectModel<typeof auditLog>;
export type OpeningBalance = InferSelectModel<typeof openingBalances>;

// ─── STRICT ENUM TYPES ───────────────────────────────────────────────────────
// paymentMethod = physical movement of money. "credit" and "credit_note" are NEVER valid here.
export type PaymentMethod   = "cash" | "bank" | "cheque";
export type PaymentStatus   = "paid" | "partial" | "unpaid";
export type ReturnCondition = "sellable" | "damaged";
// refundMethod = how a return is settled. "credit_note" does NOT create a payment row.
export type RefundMethod    = "credit_note" | "cash" | "bank" | "cheque";

// ─── ENRICHED MODELS ─────────────────────────────────────────────────────────
export interface SaleWithItems extends Sale {
  items: (SaleItem & { product: Product })[];
  customer: Customer;
}

export interface PurchaseWithItems extends Purchase {
  items: (PurchaseItem & { product: Product })[];
  supplier: Supplier | null;
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
export interface DashboardStats {
  todaySales: number;
  todayProfit: number;       // uses saleItems.costPrice — NEVER products.avgCost
  totalReceivables: number;  // excludes WALKIN customer
  totalPayables: number;
  stockValue: number;        // SUM(product.stock * product.avgCost)
  overdueCount: number;      // per-invoice: dueDate < today AND not paid AND not cancelled
  lowStockCount: number;
  monthlySalesData: { date: string; sales: number; profit: number }[];
}

// ─── SALE BUILDER (POS state) ────────────────────────────────────────────────
export interface SaleLineItem {
  product: Product;
  quantity: number;
  salePrice: number;
  // costPrice = product.avgCost snapshotted at the moment this item was added to the cart.
  // This value is written to saleItems.costPrice and is IMMUTABLE after sale creation.
  costPrice: number;
  discountPct: number;
  // totalAmount = salePrice * (1 - discountPct/100) * quantity
  totalAmount: number;
}

export interface ActiveSale {
  customerId: string | null;
  items: SaleLineItem[];
  discountAmount: number;
  taxAmount: number;
  paidAmount: number;
  paymentMethod: PaymentMethod | null; // null = not yet chosen (unpaid)
  notes: string;
}

// ─── REPORTS ─────────────────────────────────────────────────────────────────
export interface ProfitLossReport {
  period: string;
  totalSales: number;     // SUM(sale_items.total_amount) for non-cancelled
  totalCOGS: number;      // SUM(sale_items.cost_price * quantity) — historical costPrice
  grossProfit: number;
  totalExpenses: number;  // 0 if expensesEnabled=false
  netProfit: number;
  grossMarginPct: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;  // SUM(sale_items.total_amount)
  totalProfit: number;   // SUM(total_amount - cost_price * quantity)
}

export interface LowStockProduct extends Product {
  percentRemaining: number;
}

// ─── LEDGER ──────────────────────────────────────────────────────────────────
// DEBIT/CREDIT CONVENTION:
//   debit  = customer owes MORE (sale creates debit)
//   credit = customer owes LESS (payment, credit note, cash refund — all create credit)
//
// CANCELLED SALES: do NOT appear in the ledger at all.
// They have zero net balance effect and are shown separately in a "Cancelled Transactions"
// section for audit purposes only. Including them as credit entries would artificially
// reduce the running balance. The recalculateCustomerBalance() formula already excludes
// cancelled sales — the ledger display must match.
// See Financial Rules §17.
//
// REFUND ENTRIES: all return types (credit_note, cash, bank, cheque) appear as credits.
//   type="return_credit" for credit notes (no cash movement)
//   type="return_cash"   for cash/bank/cheque refunds (actual payout)
// Both reduce the customer's balance — both are credits.
export interface LedgerEntry {
  date: string;
  type: "opening" | "sale" | "payment" | "return_credit" | "return_cash";
  description: string;
  debit: number;    // amount added to what customer owes
  credit: number;   // amount deducted from what customer owes
  balance: number;  // running total after this entry (positive = customer owes us)
  referenceId: string;
}

// ─── RECONCILIATION ──────────────────────────────────────────────────────────
export interface BalanceMismatch {
  entityId: string;
  entityName: string;
  cachedBalance: number;
  computedBalance: number;
  difference: number;
}

export interface StockMismatch {
  productId: string;
  productName: string;
  systemStock: number;   // product.stock (cached column)
  computedStock: number; // from recalculateProductStock()
  difference: number;
}

// ─── PAGINATION ──────────────────────────────────────────────────────────────
export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}