-- src/db/migrations/0001_initial.sql
-- PRAGMAs: journal_mode and synchronous set here (run once, persist).
-- foreign_keys is NOT set here — it must be re-set on every connection (done in initDb()).
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  brand TEXT,
  unit TEXT NOT NULL DEFAULT 'pcs',
  barcode TEXT,
  avg_cost REAL NOT NULL DEFAULT 0,
  sale_price REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  damaged_stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 5,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  city TEXT,
  address TEXT,
  notes TEXT,
  outstanding_balance REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  shop_name TEXT NOT NULL,
  owner_name TEXT,
  phone TEXT,
  whatsapp TEXT,
  city TEXT,
  area TEXT,
  address TEXT,
  business_type TEXT DEFAULT 'retailer',
  credit_limit REAL,
  payment_terms INTEGER NOT NULL DEFAULT 0,
  discount_group TEXT DEFAULT 'standard',
  outstanding_balance REAL NOT NULL DEFAULT 0,
  notes TEXT,
  cnic TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  supplier_id TEXT REFERENCES suppliers(id),
  invoice_no TEXT,
  total_amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  payment_method TEXT,
  notes TEXT,
  purchase_date TEXT NOT NULL,
  is_cancelled INTEGER NOT NULL DEFAULT 0,
  cancel_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  cost_price REAL NOT NULL,
  total_cost REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  invoice_no TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  payment_method TEXT,
  notes TEXT,
  sale_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  is_cancelled INTEGER NOT NULL DEFAULT 0,
  cancel_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(invoice_no)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  sale_price REAL NOT NULL,
  cost_price REAL NOT NULL,
  discount_pct REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  party_id TEXT NOT NULL,
  reference_id TEXT,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  cheque_no TEXT,
  bank_name TEXT,
  notes TEXT,
  payment_date TEXT NOT NULL,
  is_refund INTEGER NOT NULL DEFAULT 0,
  is_reversed INTEGER NOT NULL DEFAULT 0,
  reversal_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  expense_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  movement_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  cost_price REAL NOT NULL DEFAULT 0,
  reference_type TEXT,
  reference_id TEXT,
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_returns (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  cost_price REAL NOT NULL,
  reason TEXT,
  refund_amount REAL NOT NULL DEFAULT 0,
  return_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_returns (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  sale_price REAL NOT NULL,
  cost_price REAL NOT NULL,
  reason TEXT,
  return_condition TEXT NOT NULL DEFAULT 'sellable',
  refund_amount REAL NOT NULL DEFAULT 0,
  refund_method TEXT NOT NULL DEFAULT 'credit_note',
  return_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  description TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS opening_balances (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  quantity INTEGER,
  cost_price REAL,
  notes TEXT,
  as_of_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  business_name TEXT NOT NULL DEFAULT 'My Business',
  business_phone TEXT,
  business_address TEXT,
  business_city TEXT,
  currency TEXT NOT NULL DEFAULT 'Rs.',
  expenses_enabled INTEGER NOT NULL DEFAULT 0,
  tax_enabled INTEGER NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
  next_invoice_no INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);
CREATE INDEX IF NOT EXISTS products_barcode_idx ON products(barcode);
CREATE INDEX IF NOT EXISTS products_is_active_idx ON products(is_active);
CREATE INDEX IF NOT EXISTS customers_city_idx ON customers(city);
CREATE INDEX IF NOT EXISTS customers_is_active_idx ON customers(is_active);
CREATE INDEX IF NOT EXISTS purchases_supplier_idx ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS purchases_status_idx ON purchases(payment_status);
CREATE INDEX IF NOT EXISTS purchases_date_idx ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS purchases_cancelled_idx ON purchases(is_cancelled);
CREATE INDEX IF NOT EXISTS purchase_items_purchase_idx ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS purchase_items_product_idx ON purchase_items(product_id);
CREATE INDEX IF NOT EXISTS sales_customer_idx ON sales(customer_id);
CREATE INDEX IF NOT EXISTS sales_status_idx ON sales(payment_status);
CREATE INDEX IF NOT EXISTS sales_date_idx ON sales(sale_date);
CREATE INDEX IF NOT EXISTS sales_due_date_idx ON sales(due_date);
CREATE INDEX IF NOT EXISTS sales_cancelled_idx ON sales(is_cancelled);
CREATE INDEX IF NOT EXISTS sale_items_sale_idx ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS sale_items_product_idx ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS payments_party_idx ON payments(type, party_id);
CREATE INDEX IF NOT EXISTS payments_date_idx ON payments(payment_date);
CREATE INDEX IF NOT EXISTS payments_reference_idx ON payments(reference_id);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses(category);
CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS stock_mov_product_idx ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS stock_mov_type_idx ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS stock_mov_date_idx ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS stock_mov_reference_idx ON stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_date_idx ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS opening_bal_entity_idx ON opening_balances(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS purchase_returns_purchase_idx ON purchase_returns(purchase_id);
CREATE INDEX IF NOT EXISTS sale_returns_sale_idx ON sale_returns(sale_id);