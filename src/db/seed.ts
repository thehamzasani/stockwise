// src/db/seed.ts
import type Database from "@tauri-apps/plugin-sql";
import { WALKIN_CUSTOMER_ID, SETTINGS_ID } from "@/lib/constants";

export async function seedInitialData(db: Database): Promise<void> {
  const now = new Date().toISOString();

  // Seed Walk-in Customer — creditLimit=0 (cash only), paymentTerms=0 (due immediately)
  const walkin = await db.select<{ id: string }[]>(
    "SELECT id FROM customers WHERE id = ?",
    [WALKIN_CUSTOMER_ID]
  );
  if (walkin.length === 0) {
    await db.execute(
      `INSERT INTO customers (
        id, shop_name, owner_name, credit_limit, payment_terms,
        discount_group, outstanding_balance, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        WALKIN_CUSTOMER_ID,
        "Walk-in Customer",
        "Cash Sale",
        0,      // creditLimit = 0: cash only — blocks all credit via checkCreditLimit()
        0,      // paymentTerms = 0: due immediately
        "standard",
        0,
        1,
        now,
        now,
      ]
    );
  }

  // Seed default app settings
  const settings = await db.select<{ id: string }[]>(
    "SELECT id FROM app_settings WHERE id = ?",
    [SETTINGS_ID]
  );
  if (settings.length === 0) {
    await db.execute(
      `INSERT INTO app_settings (
        id, business_name, currency, expenses_enabled,
        tax_enabled, tax_rate, invoice_prefix, next_invoice_no, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [SETTINGS_ID, "My Business", "Rs.", 0, 0, 0, "INV-", 1, now]
    );
  }
}