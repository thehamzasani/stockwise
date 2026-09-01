// src/lib/constants.ts

// ─── SEEDED RECORD IDs ──────────────────────────────────────────────────────
// These are the only records with fixed, known IDs. All others use generateId().
// Defined HERE only. schema.ts imports and re-exports these — it does NOT define them.
export const WALKIN_CUSTOMER_ID = "WALKIN";
export const SETTINGS_ID = "singleton";

// ─── PRODUCT ────────────────────────────────────────────────────────────────
export const PRODUCT_CATEGORIES = [
  "Capacitors",
  "Resistors",
  "Transistors",
  "Diodes",
  "LEDs",
  "Integrated Circuits",
  "Relays",
  "Switches",
  "Connectors",
  "Cables & Wires",
  "Batteries",
  "Modules",
  "Sensors",
  "Tools",
  "Other",
] as const;

export const PRODUCT_UNITS = [
  { value: "pcs",  label: "Pieces (pcs)" },
  { value: "box",  label: "Box" },
  { value: "pack", label: "Pack" },
  { value: "kg",   label: "Kilogram (kg)" },
  { value: "m",    label: "Meter (m)" },
] as const;

// ─── EXPENSE ─────────────────────────────────────────────────────────────────
export const EXPENSE_CATEGORIES = [
  "Rent",
  "Electricity",
  "Salary",
  "Transport",
  "Packaging",
  "Marketing",
  "Repairs",
  "Other",
] as const;

// ─── CUSTOMER / BUSINESS ─────────────────────────────────────────────────────
export const BUSINESS_TYPES = [
  { value: "retailer",   label: "Retailer" },
  { value: "wholesaler", label: "Wholesaler" },
  { value: "dealer",     label: "Dealer" },
  { value: "other",      label: "Other" },
] as const;

export const DISCOUNT_GROUPS = [
  { value: "standard",    label: "Standard" },
  { value: "wholesale-a", label: "Wholesale A" },
  { value: "wholesale-b", label: "Wholesale B" },
  { value: "vip",         label: "VIP" },
] as const;

// ─── PAYMENT ─────────────────────────────────────────────────────────────────
// paymentMethod = how money physically moves. "credit" is NEVER a payment method.
export const PAYMENT_METHODS = [
  { value: "cash",   label: "Cash" },
  { value: "bank",   label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
] as const;

// paymentStatus = how much of an invoice is settled
export const PAYMENT_STATUSES = [
  { value: "paid",    label: "Paid",    color: "green" },
  { value: "partial", label: "Partial", color: "amber" },
  { value: "unpaid",  label: "Unpaid",  color: "red" },
] as const;

// ─── RETURNS ─────────────────────────────────────────────────────────────────
export const RETURN_CONDITIONS = [
  { value: "sellable", label: "Sellable — return to stock" },
  { value: "damaged",  label: "Damaged — write off (do not return to stock)" },
] as const;

// refundMethod = how the refund is given back to customer.
// "credit_note" = reduces their outstanding balance only. NO payment row inserted.
// "cash"|"bank"|"cheque" = actual money paid out. A payment row IS inserted
//   with type="customer" and isRefund=true to distinguish it from received payments.
export const REFUND_METHODS = [
  { value: "credit_note", label: "Credit Note (reduce balance)" },
  { value: "cash",        label: "Cash Refund" },
  { value: "bank",        label: "Bank Transfer Refund" },
  { value: "cheque",      label: "Cheque Refund" },
] as const;

// ─── STOCK MOVEMENTS ─────────────────────────────────────────────────────────
// Every change to product.stock writes a stock_movements row with one of these types.
// Signed conventions for computeStockFromMovements():
//   ADDITIVE (+qty):    purchase_in, sale_return_in, adjustment_add, opening_stock, sale_cancelled
//   SUBTRACTIVE (-qty): sale_out, purchase_return_out, adjustment_remove,
//                       damaged_write_off, purchase_cancelled
//   CORRECTION:         uses (stock_after - stock_before) as signed delta
//
// WAC recalculation triggers (avgCost CHANGES):
//   purchase_in, sale_return_in (sellable only), adjustment_add
// WAC non-triggers (avgCost UNCHANGED):
//   sale_out, purchase_return_out, damaged_write_off, adjustment_remove,
//   correction, opening_stock, sale_cancelled, purchase_cancelled
export const MOVEMENT_TYPES = {
  PURCHASE_IN:         "purchase_in",
  SALE_OUT:            "sale_out",
  SALE_RETURN_IN:      "sale_return_in",
  PURCHASE_RETURN_OUT: "purchase_return_out",
  DAMAGED_WRITE_OFF:   "damaged_write_off",
  ADJUSTMENT_ADD:      "adjustment_add",
  ADJUSTMENT_REMOVE:   "adjustment_remove",
  OPENING_STOCK:       "opening_stock",
  CORRECTION:          "correction",
  SALE_CANCELLED:      "sale_cancelled",
  PURCHASE_CANCELLED:  "purchase_cancelled",
} as const;

// ─── AUDIT LOG EVENT TYPES ───────────────────────────────────────────────────
export const AUDIT_EVENTS = {
  SALE_CREATED:           "sale_created",
  SALE_CANCELLED:         "sale_cancelled",
  SALE_PAYMENT:           "sale_payment",
  PURCHASE_CREATED:       "purchase_created",
  PURCHASE_CANCELLED:     "purchase_cancelled",
  PURCHASE_PAYMENT:       "purchase_payment",
  PAYMENT_REVERSED:       "payment_reversed",
  SALE_RETURN:            "sale_return",
  PURCHASE_RETURN:        "purchase_return",
  STOCK_ADJUSTED:         "stock_adjusted",
  CUSTOMER_BALANCE_FIXED: "customer_balance_fixed",
  SUPPLIER_BALANCE_FIXED: "supplier_balance_fixed",
  STOCK_FIXED:            "stock_fixed",
  SETTINGS_CHANGED:       "settings_changed",
  BACKUP_CREATED:         "backup_created",
  DATABASE_RESTORED:      "database_restored",
} as const;

// ─── MISC ────────────────────────────────────────────────────────────────────
export const ITEMS_PER_PAGE = 20;