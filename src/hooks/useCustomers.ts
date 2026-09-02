// src/hooks/useCustomers.ts
import { useState, useEffect } from "react";
import { getSqlite } from "@/db";
import { generateId, nowISO} from "@/lib/utils";
import { AUDIT_EVENTS, ITEMS_PER_PAGE, WALKIN_CUSTOMER_ID } from "@/lib/constants";
import type { Customer, NewCustomer, LedgerEntry, Sale } from "@/types";

interface UseCustomersOptions {
  search?: string;
  city?: string;
  showInactive?: boolean;
  page?: number;
}

interface UseCustomersResult {
  data: Customer[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCustomers(opts: UseCustomersOptions = {}): UseCustomersResult {
  const { search = "", city = "", showInactive = false, page = 1 } = opts;
  const [data, setData] = useState<Customer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const sqlite = getSqlite();
        const offset = (page - 1) * ITEMS_PER_PAGE;
        const conditions: string[] = [];
        const params: unknown[] = [];

        // Always exclude Walk-in Customer
        conditions.push("id != ?");
        params.push(WALKIN_CUSTOMER_ID);

        if (!showInactive) {
          conditions.push("is_active = 1");
        }
        if (search) {
          conditions.push(
            "(shop_name LIKE ? OR owner_name LIKE ? OR phone LIKE ? OR city LIKE ?)"
          );
          params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (city) {
          conditions.push("city = ?");
          params.push(city);
        }

        const where = `WHERE ${conditions.join(" AND ")}`;

        const countResult = await sqlite.select<{ c: number }[]>(
          `SELECT COUNT(*) AS c FROM customers ${where}`,
          params
        );
        const rows = await sqlite.select<Customer[]>(
          `SELECT * FROM customers ${where} ORDER BY shop_name ASC LIMIT ? OFFSET ?`,
          [...params, ITEMS_PER_PAGE, offset]
        );

        if (!cancelled) {
          setTotalCount(countResult[0]?.c ?? 0);
          setData(rows);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [search, city, showInactive, page, tick]);

  return { data, totalCount, isLoading, error, refetch: () => setTick((t) => t + 1) };
}

interface UseSingleCustomerResult {
  data: Customer | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCustomer(id: string): UseSingleCustomerResult {
  const [data, setData] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!id) { setIsLoading(false); return; }
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const sqlite = getSqlite();
        const rows = await sqlite.select<Customer[]>(
          "SELECT * FROM customers WHERE id = ?", [id]
        );
        if (!cancelled) setData(rows[0] ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id, tick]);

  return { data, isLoading, error, refetch: () => setTick((t) => t + 1) };
}

interface UseCustomerLedgerResult {
  entries: LedgerEntry[];
  cancelledSales: Sale[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCustomerLedger(customerId: string): UseCustomerLedgerResult {
  const [entries, setEntries]               = useState<LedgerEntry[]>([]);
  const [cancelledSales, setCancelledSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading]           = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [tick, setTick]                     = useState(0);

  useEffect(() => {
    if (!customerId) { setIsLoading(false); return; }
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const sqlite = getSqlite();

        // 1. Opening balance
        const openingRows = await sqlite.select<{ amount: number; as_of_date: string }[]>(
          `SELECT amount, as_of_date FROM opening_balances
           WHERE entity_type = 'customer' AND entity_id = ?`,
          [customerId]
        );

        // 2. Non-cancelled sales only — these are the only sales that affect balance
        const salesRows = await sqlite.select<{
          id: string; invoice_no: string; total_amount: number; sale_date: string;
        }[]>(
          `SELECT id, invoice_no, total_amount, sale_date
           FROM sales
           WHERE customer_id = ? AND is_cancelled = 0
           ORDER BY sale_date ASC, created_at ASC`,
          [customerId]
        );

        // 3. Payments received (isRefund=false) — money coming IN
        const paymentRows = await sqlite.select<{
          id: string; amount: number; payment_date: string;
          payment_method: string; reference_id: string | null; is_refund: number;
        }[]>(
          `SELECT id, amount, payment_date, payment_method, reference_id, is_refund
           FROM payments
           WHERE type = 'customer' AND party_id = ? AND is_reversed = 0 AND is_refund = 0
           ORDER BY payment_date ASC, created_at ASC`,
          [customerId]
        );

        // 4. Cash/bank/cheque refunds paid OUT to customer (isRefund=true)
        const refundPaymentRows = await sqlite.select<{
          id: string; amount: number; payment_date: string;
          payment_method: string; reference_id: string | null;
        }[]>(
          `SELECT id, amount, payment_date, payment_method, reference_id
           FROM payments
           WHERE type = 'customer' AND party_id = ? AND is_reversed = 0 AND is_refund = 1
           ORDER BY payment_date ASC, created_at ASC`,
          [customerId]
        );

        // 5. Credit note returns (refund_method='credit_note')
        const creditNoteRows = await sqlite.select<{
          id: string; refund_amount: number; return_date: string; sale_id: string;
        }[]>(
          `SELECT sr.id, sr.refund_amount, sr.return_date, sr.sale_id
           FROM sale_returns sr
           JOIN sales s ON s.id = sr.sale_id
           WHERE s.customer_id = ? AND sr.refund_method = 'credit_note'
           ORDER BY sr.return_date ASC, sr.created_at ASC`,
          [customerId]
        );

        // 6. Cancelled sales — fetched SEPARATELY for audit display only
        // These do NOT contribute to the running balance
        const cancelledRows = await sqlite.select<Sale[]>(
          `SELECT * FROM sales
           WHERE customer_id = ? AND is_cancelled = 1
           ORDER BY sale_date DESC`,
          [customerId]
        );

        if (cancelled) return;

        // Build all raw events with date for sorting
        type RawEvent =
          | { kind: "opening"; date: string; amount: number }
          | { kind: "sale"; date: string; id: string; invoiceNo: string; amount: number }
          | { kind: "payment"; date: string; id: string; amount: number; method: string; referenceId: string | null }
          | { kind: "return_credit"; date: string; id: string; amount: number; saleId: string }
          | { kind: "return_cash"; date: string; id: string; amount: number; method: string; referenceId: string | null };

        const events: RawEvent[] = [];

        if (openingRows.length > 0 && openingRows[0].amount !== 0) {
          events.push({
            kind: "opening",
            date: openingRows[0].as_of_date,
            amount: openingRows[0].amount,
          });
        }

        for (const s of salesRows) {
          events.push({
            kind: "sale",
            date: s.sale_date,
            id: s.id,
            invoiceNo: s.invoice_no,
            amount: s.total_amount,
          });
        }

        for (const p of paymentRows) {
          events.push({
            kind: "payment",
            date: p.payment_date,
            id: p.id,
            amount: p.amount,
            method: p.payment_method,
            referenceId: p.reference_id,
          });
        }

        for (const r of creditNoteRows) {
          events.push({
            kind: "return_credit",
            date: r.return_date,
            id: r.id,
            amount: r.refund_amount,
            saleId: r.sale_id,
          });
        }

        for (const r of refundPaymentRows) {
          events.push({
            kind: "return_cash",
            date: r.payment_date,
            id: r.id,
            amount: r.amount,
            method: r.payment_method,
            referenceId: r.reference_id,
          });
        }

        // Sort all events chronologically
        events.sort((a, b) => {
          if (a.date < b.date) return -1;
          if (a.date > b.date) return 1;
          // Opening always first on same date
          if (a.kind === "opening") return -1;
          if (b.kind === "opening") return 1;
          return 0;
        });

        // Build running balance ledger
        let runningBalance = 0;
        const ledger: LedgerEntry[] = [];

        for (const ev of events) {
          if (ev.kind === "opening") {
            runningBalance += ev.amount;
            ledger.push({
              date: ev.date,
              type: "opening",
              description: "Opening Balance",
              debit: ev.amount > 0 ? ev.amount : 0,
              credit: ev.amount < 0 ? Math.abs(ev.amount) : 0,
              balance: runningBalance,
              referenceId: "opening",
            });
          } else if (ev.kind === "sale") {
            runningBalance += ev.amount;
            ledger.push({
              date: ev.date,
              type: "sale",
              description: `Invoice ${ev.invoiceNo}`,
              debit: ev.amount,
              credit: 0,
              balance: runningBalance,
              referenceId: ev.id,
            });
          } else if (ev.kind === "payment") {
            runningBalance -= ev.amount;
            const methodLabel = ev.method.charAt(0).toUpperCase() + ev.method.slice(1);
            ledger.push({
              date: ev.date,
              type: "payment",
              description: `Payment received — ${methodLabel}`,
              debit: 0,
              credit: ev.amount,
              balance: runningBalance,
              referenceId: ev.referenceId ?? ev.id,
            });
          } else if (ev.kind === "return_credit") {
            runningBalance -= ev.amount;
            ledger.push({
              date: ev.date,
              type: "return_credit",
              description: "Credit note issued",
              debit: 0,
              credit: ev.amount,
              balance: runningBalance,
              referenceId: ev.saleId,
            });
          } else if (ev.kind === "return_cash") {
            runningBalance -= ev.amount;
            const methodLabel = ev.method.charAt(0).toUpperCase() + ev.method.slice(1);
            ledger.push({
              date: ev.date,
              type: "return_cash",
              description: `Refund paid — ${methodLabel}`,
              debit: 0,
              credit: ev.amount,
              balance: runningBalance,
              referenceId: ev.referenceId ?? ev.id,
            });
          }
        }

        setEntries(ledger);
        setCancelledSales(cancelledRows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [customerId, tick]);

  return { entries, cancelledSales, isLoading, error, refetch: () => setTick((t) => t + 1) };
}

// All cities that have active (non-WALKIN) customers — for city filter
export function useCustomerCities(): string[] {
  const [cities, setCities] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const sqlite = getSqlite();
        const rows = await sqlite.select<{ city: string }[]>(
          `SELECT DISTINCT city FROM customers
           WHERE city IS NOT NULL AND city != '' AND id != ? AND is_active = 1
           ORDER BY city ASC`,
          [WALKIN_CUSTOMER_ID]
        );
        setCities(rows.map((r) => r.city));
      } catch {
        // non-critical
      }
    }
    void load();
  }, []);

  return cities;
}

export async function createCustomer(
  input: Omit<NewCustomer, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const id  = generateId();
  const now = nowISO();
  const sqlite = getSqlite();

  await sqlite.execute(
    `INSERT INTO customers
      (id, shop_name, owner_name, phone, whatsapp, city, area, address,
       business_type, credit_limit, payment_terms, discount_group,
       outstanding_balance, notes, cnic, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.shopName,
      input.ownerName        ?? null,
      input.phone            ?? null,
      input.whatsapp         ?? null,
      input.city             ?? null,
      input.area             ?? null,
      input.address          ?? null,
      input.businessType     ?? "retailer",
      input.creditLimit      ?? null,   // null = unlimited
      input.paymentTerms     ?? 0,
      input.discountGroup    ?? "standard",
      input.outstandingBalance ?? 0,
      input.notes            ?? null,
      input.cnic             ?? null,
      input.isActive         ?? true ? 1 : 0,
      now,
      now,
    ]
  );

  await sqlite.execute(
    `INSERT INTO audit_log (id, event_type, entity_type, entity_id, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [generateId(), AUDIT_EVENTS.SALE_CREATED, "customer", id, `Customer created: ${input.shopName}`, now]
  );

  return id;
}

export async function updateCustomer(
  id: string,
  input: Partial<Omit<NewCustomer, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  const now = nowISO();
  const sqlite = getSqlite();

  const fields: string[] = [];
  const params: unknown[] = [];

  if (input.shopName       !== undefined) { fields.push("shop_name = ?");       params.push(input.shopName); }
  if (input.ownerName      !== undefined) { fields.push("owner_name = ?");      params.push(input.ownerName); }
  if (input.phone          !== undefined) { fields.push("phone = ?");           params.push(input.phone); }
  if (input.whatsapp       !== undefined) { fields.push("whatsapp = ?");        params.push(input.whatsapp); }
  if (input.city           !== undefined) { fields.push("city = ?");            params.push(input.city); }
  if (input.area           !== undefined) { fields.push("area = ?");            params.push(input.area); }
  if (input.address        !== undefined) { fields.push("address = ?");         params.push(input.address); }
  if (input.businessType   !== undefined) { fields.push("business_type = ?");   params.push(input.businessType); }
  if ("creditLimit" in input)             { fields.push("credit_limit = ?");    params.push(input.creditLimit ?? null); }
  if (input.paymentTerms   !== undefined) { fields.push("payment_terms = ?");   params.push(input.paymentTerms); }
  if (input.discountGroup  !== undefined) { fields.push("discount_group = ?");  params.push(input.discountGroup); }
  if (input.notes          !== undefined) { fields.push("notes = ?");           params.push(input.notes); }
  if (input.cnic           !== undefined) { fields.push("cnic = ?");            params.push(input.cnic); }
  if (input.isActive       !== undefined) { fields.push("is_active = ?");       params.push(input.isActive ? 1 : 0); }

  if (fields.length === 0) return;

  fields.push("updated_at = ?");
  params.push(now, id);

  await sqlite.execute(
    `UPDATE customers SET ${fields.join(", ")} WHERE id = ?`,
    params
  );

  await sqlite.execute(
    `INSERT INTO audit_log (id, event_type, entity_type, entity_id, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [generateId(), AUDIT_EVENTS.SALE_CREATED, "customer", id, `Customer updated: ${id}`, now]
  );
}

export async function deactivateCustomer(id: string): Promise<void> {
  const now = nowISO();
  const sqlite = getSqlite();

  const linked = await sqlite.select<{ c: number }[]>(
    `SELECT COUNT(*) AS c FROM sales
     WHERE customer_id = ? AND is_cancelled = 0 AND payment_status != 'paid'`,
    [id]
  );
  if ((linked[0]?.c ?? 0) > 0) {
    throw new Error(
      "Cannot deactivate this customer — they have unpaid invoices. " +
      "Settle all outstanding balances first."
    );
  }

  await sqlite.execute(
    "UPDATE customers SET is_active = 0, updated_at = ? WHERE id = ?",
    [now, id]
  );

  await sqlite.execute(
    `INSERT INTO audit_log (id, event_type, entity_type, entity_id, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [generateId(), AUDIT_EVENTS.SALE_CREATED, "customer", id, `Customer deactivated: ${id}`, now]
  );
}