// src/db/schema.ts
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { WALKIN_CUSTOMER_ID, SETTINGS_ID } from "@/lib/constants";

export { WALKIN_CUSTOMER_ID, SETTINGS_ID }; // re-export for convenience

// ─── PRODUCTS ────────────────────────────────────────────────────────────────
export const products = sqliteTable(
  "products",
  {
    id:           text("id").primaryKey(),
    name:         text("name").notNull(),
    category:     text("category").notNull(),
    brand:        text("brand"),
    unit:         text("unit").notNull().default("pcs"),
    barcode:      text("barcode"),
    // avgCost = Weighted Average Cost. See MOVEMENT_TYPES WAC triggers in constants.ts.
    avgCost:      real("avg_cost").notNull().default(0),
    salePrice:    real("sale_price").notNull().default(0),
    stock:        integer("stock").notNull().default(0),
    damagedStock: integer("damaged_stock").notNull().default(0),
    minStock:     integer("min_stock").notNull().default(5),
    description:  text("description"),
    isActive:     integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt:    text("created_at").notNull(),
    updatedAt:    text("updated_at").notNull(),
  },
  (t) => [
    index("products_category_idx").on(t.category),
    index("products_barcode_idx").on(t.barcode),
    index("products_is_active_idx").on(t.isActive),
  ]
);

// ─── SUPPLIERS ───────────────────────────────────────────────────────────────
export const suppliers = sqliteTable("suppliers", {
  id:                 text("id").primaryKey(),
  name:               text("name").notNull(),
  contactPerson:      text("contact_person"),
  phone:              text("phone"),
  city:               text("city"),
  address:            text("address"),
  notes:              text("notes"),
  outstandingBalance: real("outstanding_balance").notNull().default(0),
  isActive:           integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt:          text("created_at").notNull(),
  updatedAt:          text("updated_at").notNull(),
});

// ─── CUSTOMERS ───────────────────────────────────────────────────────────────
export const customers = sqliteTable(
  "customers",
  {
    id:                 text("id").primaryKey(),
    shopName:           text("shop_name").notNull(),
    ownerName:          text("owner_name"),
    phone:              text("phone"),
    whatsapp:           text("whatsapp"),
    city:               text("city"),
    area:               text("area"),
    address:            text("address"),
    businessType:       text("business_type").default("retailer"),
    // creditLimit: NULL = unlimited. 0 = cash only. Walk-in always has 0.
    creditLimit:        real("credit_limit"),
    paymentTerms:       integer("payment_terms").notNull().default(0),
    // discountGroup: display/grouping only. No automatic pricing in V1.
    discountGroup:      text("discount_group").default("standard"),
    outstandingBalance: real("outstanding_balance").notNull().default(0),
    notes:              text("notes"),
    cnic:               text("cnic"),
    isActive:           integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt:          text("created_at").notNull(),
    updatedAt:          text("updated_at").notNull(),
  },
  (t) => [
    index("customers_city_idx").on(t.city),
    index("customers_is_active_idx").on(t.isActive),
  ]
);

// ─── PURCHASES ───────────────────────────────────────────────────────────────
export const purchases = sqliteTable(
  "purchases",
  {
    id:            text("id").primaryKey(),
    supplierId:    text("supplier_id").references(() => suppliers.id),
    invoiceNo:     text("invoice_no"),
    totalAmount:   real("total_amount").notNull().default(0),
    paidAmount:    real("paid_amount").notNull().default(0),
    paymentStatus: text("payment_status").notNull().default("unpaid"),
    paymentMethod: text("payment_method"),
    notes:         text("notes"),
    purchaseDate:  text("purchase_date").notNull(),
    isCancelled:   integer("is_cancelled", { mode: "boolean" }).notNull().default(false),
    cancelReason:  text("cancel_reason"),
    createdAt:     text("created_at").notNull(),
    updatedAt:     text("updated_at").notNull(),
  },
  (t) => [
    index("purchases_supplier_idx").on(t.supplierId),
    index("purchases_status_idx").on(t.paymentStatus),
    index("purchases_date_idx").on(t.purchaseDate),
    index("purchases_cancelled_idx").on(t.isCancelled),
  ]
);

export const purchaseItems = sqliteTable(
  "purchase_items",
  {
    id:         text("id").primaryKey(),
    purchaseId: text("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    productId:  text("product_id").notNull().references(() => products.id),
    quantity:   integer("quantity").notNull(),
    costPrice:  real("cost_price").notNull(), // locked at purchase time — IMMUTABLE
    totalCost:  real("total_cost").notNull(),
  },
  (t) => [
    index("purchase_items_purchase_idx").on(t.purchaseId),
    index("purchase_items_product_idx").on(t.productId),
  ]
);

// ─── SALES ───────────────────────────────────────────────────────────────────
export const sales = sqliteTable(
  "sales",
  {
    id:             text("id").primaryKey(),
    customerId:     text("customer_id").notNull().references(() => customers.id),
    invoiceNo:      text("invoice_no").notNull(),
    subtotal:       real("subtotal").notNull().default(0),
    discountAmount: real("discount_amount").notNull().default(0),
    taxAmount:      real("tax_amount").notNull().default(0),
    totalAmount:    real("total_amount").notNull().default(0),
    paidAmount:     real("paid_amount").notNull().default(0),
    paymentStatus:  text("payment_status").notNull().default("unpaid"),
    paymentMethod:  text("payment_method"),
    notes:          text("notes"),
    saleDate:       text("sale_date").notNull(),
    dueDate:        text("due_date").notNull(),
    isCancelled:    integer("is_cancelled", { mode: "boolean" }).notNull().default(false),
    cancelReason:   text("cancel_reason"),
    createdAt:      text("created_at").notNull(),
    updatedAt:      text("updated_at").notNull(),
  },
  (t) => [
    index("sales_customer_idx").on(t.customerId),
    index("sales_status_idx").on(t.paymentStatus),
    index("sales_date_idx").on(t.saleDate),
    index("sales_due_date_idx").on(t.dueDate),
    index("sales_cancelled_idx").on(t.isCancelled),
    uniqueIndex("sales_invoice_unique").on(t.invoiceNo),
  ]
);

export const saleItems = sqliteTable(
  "sale_items",
  {
    id:          text("id").primaryKey(),
    saleId:      text("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId:   text("product_id").notNull().references(() => products.id),
    quantity:    integer("quantity").notNull(),
    salePrice:   real("sale_price").notNull(),  // locked at sale time — IMMUTABLE
    costPrice:   real("cost_price").notNull(),  // product.avgCost at sale time — IMMUTABLE
    discountPct: real("discount_pct").notNull().default(0),
    // totalAmount = salePrice * (1 - discountPct/100) * quantity
    // Use THIS for all revenue calculations — never salePrice * quantity (ignores discount)
    totalAmount: real("total_amount").notNull(),
  },
  (t) => [
    index("sale_items_sale_idx").on(t.saleId),
    index("sale_items_product_idx").on(t.productId),
  ]
);

// ─── PAYMENTS ────────────────────────────────────────────────────────────────
// Records money received from customers OR paid to suppliers.
// paymentMethod: "cash" | "bank" | "cheque" ONLY — never "credit" or "credit_note".
// isRefund: true when this row represents a cash/bank/cheque refund paid OUT to customer.
//   This distinguishes refunds from received payments in the payment history UI.
//   Balance formula treats all type="customer" payments the same (reduces outstanding).
// Credit note returns do NOT create a payment row — they directly adjust outstandingBalance.
export const payments = sqliteTable(
  "payments",
  {
    id:            text("id").primaryKey(),
    type:          text("type").notNull(),       // "customer" | "supplier"
    partyId:       text("party_id").notNull(),
    referenceId:   text("reference_id"),         // saleId or purchaseId
    amount:        real("amount").notNull(),      // always positive
    paymentMethod: text("payment_method").notNull().default("cash"),
    chequeNo:      text("cheque_no"),
    bankName:      text("bank_name"),
    notes:         text("notes"),
    paymentDate:   text("payment_date").notNull(),
    // isRefund: true when money was paid OUT to customer (cash/bank/cheque refund)
    // false (default) when money was received FROM customer or paid TO supplier
    isRefund:    integer("is_refund", { mode: "boolean" }).notNull().default(false),
    isReversed:  integer("is_reversed", { mode: "boolean" }).notNull().default(false),
    reversalId:  text("reversal_id"),
    createdAt:   text("created_at").notNull(),
  },
  (t) => [
    index("payments_party_idx").on(t.type, t.partyId),
    index("payments_date_idx").on(t.paymentDate),
    index("payments_reference_idx").on(t.referenceId),
  ]
);

// ─── EXPENSES ────────────────────────────────────────────────────────────────
export const expenses = sqliteTable(
  "expenses",
  {
    id:          text("id").primaryKey(),
    category:    text("category").notNull(),
    description: text("description").notNull(),
    amount:      real("amount").notNull(),
    expenseDate: text("expense_date").notNull(),
    notes:       text("notes"),
    createdAt:   text("created_at").notNull(),
  },
  (t) => [
    index("expenses_category_idx").on(t.category),
    index("expenses_date_idx").on(t.expenseDate),
  ]
);

// ─── STOCK MOVEMENTS ─────────────────────────────────────────────────────────
// quantity: always stored POSITIVE. Direction implied by movementType (see MOVEMENT_TYPES).
// Exception: "correction" — quantity = absolute change; stockBefore/After show direction.
export const stockMovements = sqliteTable(
  "stock_movements",
  {
    id:            text("id").primaryKey(),
    productId:     text("product_id").notNull().references(() => products.id),
    movementType:  text("movement_type").notNull(),
    quantity:      integer("quantity").notNull(),
    costPrice:     real("cost_price").notNull().default(0),
    referenceType: text("reference_type"),
    referenceId:   text("reference_id"),
    stockBefore:   integer("stock_before").notNull(),
    stockAfter:    integer("stock_after").notNull(),
    notes:         text("notes"),
    createdAt:     text("created_at").notNull(),
  },
  (t) => [
    index("stock_mov_product_idx").on(t.productId),
    index("stock_mov_type_idx").on(t.movementType),
    index("stock_mov_date_idx").on(t.createdAt),
    index("stock_mov_reference_idx").on(t.referenceType, t.referenceId),
  ]
);

// ─── PURCHASE RETURNS ────────────────────────────────────────────────────────
export const purchaseReturns = sqliteTable(
  "purchase_returns",
  {
    id:           text("id").primaryKey(),
    purchaseId:   text("purchase_id").notNull().references(() => purchases.id),
    productId:    text("product_id").notNull().references(() => products.id),
    quantity:     integer("quantity").notNull(),
    costPrice:    real("cost_price").notNull(), // locked from original purchaseItem
    reason:       text("reason"),
    refundAmount: real("refund_amount").notNull().default(0),
    returnDate:   text("return_date").notNull(),
    createdAt:    text("created_at").notNull(),
  },
  (t) => [index("purchase_returns_purchase_idx").on(t.purchaseId)]
);

// ─── SALE RETURNS ────────────────────────────────────────────────────────────
export const saleReturns = sqliteTable(
  "sale_returns",
  {
    id:              text("id").primaryKey(),
    saleId:          text("sale_id").notNull().references(() => sales.id),
    productId:       text("product_id").notNull().references(() => products.id),
    quantity:        integer("quantity").notNull(),
    salePrice:       real("sale_price").notNull(),  // locked from original saleItem
    costPrice:       real("cost_price").notNull(),  // locked from original saleItem
    reason:          text("reason"),
    returnCondition: text("return_condition").notNull().default("sellable"),
    refundAmount:    real("refund_amount").notNull().default(0),
    // refundMethod: how the customer is compensated.
    // "credit_note" → NO payment row, balance adjusted directly.
    // "cash"|"bank"|"cheque" → payment row with isRefund=true inserted.
    refundMethod:    text("refund_method").notNull().default("credit_note"),
    returnDate:      text("return_date").notNull(),
    createdAt:       text("created_at").notNull(),
  },
  (t) => [index("sale_returns_sale_idx").on(t.saleId)]
);

// ─── AUDIT LOG ───────────────────────────────────────────────────────────────
export const auditLog = sqliteTable(
  "audit_log",
  {
    id:          text("id").primaryKey(),
    eventType:   text("event_type").notNull(),
    entityType:  text("entity_type").notNull(),
    entityId:    text("entity_id"),
    description: text("description").notNull(),
    oldValues:   text("old_values"),
    newValues:   text("new_values"),
    createdAt:   text("created_at").notNull(),
  },
  (t) => [
    index("audit_entity_idx").on(t.entityType, t.entityId),
    index("audit_date_idx").on(t.createdAt),
  ]
);

// ─── OPENING BALANCES ────────────────────────────────────────────────────────
// One record per entity. UNIQUE enforced by DB.
// Locked (read-only) once any transaction exists for that entity.
// Correctable BEFORE any transactions exist — hook allows UPDATE if no transactions yet.
export const openingBalances = sqliteTable(
  "opening_balances",
  {
    id:         text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId:   text("entity_id").notNull(),
    amount:     real("amount").notNull().default(0),
    quantity:   integer("quantity"),
    costPrice:  real("cost_price"),
    notes:      text("notes"),
    asOfDate:   text("as_of_date").notNull(),
    createdAt:  text("created_at").notNull(),
  },
  (t) => [
    index("opening_bal_entity_idx").on(t.entityType, t.entityId),
    uniqueIndex("opening_bal_unique").on(t.entityType, t.entityId),
  ]
);

// ─── APP SETTINGS ────────────────────────────────────────────────────────────
export const appSettings = sqliteTable("app_settings", {
  id:              text("id").primaryKey().default(SETTINGS_ID),
  businessName:    text("business_name").notNull().default("My Business"),
  businessPhone:   text("business_phone"),
  businessAddress: text("business_address"),
  businessCity:    text("business_city"),
  currency:        text("currency").notNull().default("Rs."),
  expensesEnabled: integer("expenses_enabled", { mode: "boolean" }).notNull().default(false),
  taxEnabled:      integer("tax_enabled", { mode: "boolean" }).notNull().default(false),
  taxRate:         real("tax_rate").notNull().default(0),
  invoicePrefix:   text("invoice_prefix").notNull().default("INV-"),
  nextInvoiceNo:   integer("next_invoice_no").notNull().default(1),
  updatedAt:       text("updated_at").notNull(),
});