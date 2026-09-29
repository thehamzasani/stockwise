// src/hooks/usePayments.ts
import { useCallback, useEffect, useState } from "react";
import { getSqlite } from "@/db";
import { withTransaction } from "@/db/transaction";
import {
  AUDIT_EVENTS,
  ITEMS_PER_PAGE,
  PAYMENT_METHODS,
  WALKIN_CUSTOMER_ID,
} from "@/lib/constants";
import { formatCurrency, generateId, nowISO, todayDate } from "@/lib/utils";
import type { PaymentMethod, PaymentStatus } from "@/types";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type PartyType = "customer" | "supplier";

export const REVERSAL_NOTE_PREFIX = "Reversal of payment ";

export interface PaymentRow {
  id: string;
  type: PartyType;
  partyId: string;
  partyName: string;
  referenceId: string | null;
  referenceNo: string | null;
  amount: number;
  paymentMethod: string;
  chequeNo: string | null;
  bankName: string | null;
  notes: string | null;
  paymentDate: string;
  isRefund: boolean;
  isReversed: boolean;
  reversalId: string | null;
  createdAt: string;
}

export interface OpenInvoice {
  id: string;
  reference: string;
  date: string;
  dueDate: string | null;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  paymentStatus: PaymentStatus;
}

export interface OverdueInvoice {
  id: string;
  invoiceNo: string;
  customerId: string;
  customerName: string;
  saleDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  paymentStatus: string;
  daysOverdue: number;
}

export interface PartyOption {
  id: string;
  name: string;
  balance: number;
}

export interface RecordPaymentInput {
  partyId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  referenceId?: string | null;
  chequeNo?: string | null;
  bankName?: string | null;
  notes?: string | null;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const round2 = (n: number): number => Math.round(n * 100) / 100;

function statusFor(total: number, paid: number): PaymentStatus {
  if (paid <= 0.005) return "unpaid";
  if (paid >= total - 0.005) return "paid";
  return "partial";
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function methodLabel(method: string): string {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
}

export function isReversalEntry(p: { notes: string | null }): boolean {
  return p.notes?.startsWith(REVERSAL_NOTE_PREFIX) ?? false;
}

// Payment history labels (Financial Rules §18).
export function getPaymentLabel(
  p: Pick<PaymentRow, "type" | "isRefund" | "paymentMethod" | "notes">
): string {
  const m = methodLabel(p.paymentMethod);
  if (isReversalEntry(p)) return `Reversal entry — ${m}`;
  if (p.type === "supplier") return `Paid to supplier — ${m}`;
  return p.isRefund ? `Refund paid — ${m}` : `Payment received — ${m}`;
}

// Table/column names below come from this fixed internal map only — never from user input.
const PARTY_CONFIG = {
  customer: {
    label: "Customer",
    partyTable: "customers",
    nameCol: "shop_name",
    refTable: "sales",
    refPartyCol: "customer_id",
    refDateCol: "sale_date",
    auditEvent: AUDIT_EVENTS.SALE_PAYMENT,
  },
  supplier: {
    label: "Supplier",
    partyTable: "suppliers",
    nameCol: "name",
    refTable: "purchases",
    refPartyCol: "supplier_id",
    refDateCol: "purchase_date",
    auditEvent: AUDIT_EVENTS.PURCHASE_PAYMENT,
  },
} as const;

// ─── GENERIC QUERY HELPER ────────────────────────────────────────────────────

function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetcher()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setIsLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("[usePayments]", e);
        setError(errMsg(e));
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { data, isLoading, error, refetch };
}

// ─── QUERIES ─────────────────────────────────────────────────────────────────

interface RawPaymentRow {
  id: string;
  type: string;
  party_id: string;
  party_name: string | null;
  reference_id: string | null;
  reference_no: string | null;
  amount: number;
  payment_method: string;
  cheque_no: string | null;
  bank_name: string | null;
  notes: string | null;
  payment_date: string;
  is_refund: number;
  is_reversed: number;
  reversal_id: string | null;
  created_at: string;
}

const PAYMENTS_FROM = `
  FROM payments p
  LEFT JOIN customers c ON p.type = 'customer' AND c.id = p.party_id
  LEFT JOIN suppliers s ON p.type = 'supplier' AND s.id = p.party_id
  LEFT JOIN sales sa ON p.type = 'customer' AND sa.id = p.reference_id
  LEFT JOIN purchases pu ON p.type = 'supplier' AND pu.id = p.reference_id
`;

export interface UsePaymentsOptions {
  type?: "all" | PartyType;
  partyId?: string;
  search?: string;
  page?: number;
}

// Payment history. Walk-in cash-sale payments are excluded (Coding Rule 20).
export function usePayments(options: UsePaymentsOptions = {}) {
  const { type = "all", partyId = "", search = "", page = 1 } = options;

  const q = useQuery(
    async () => {
      const sqlite = getSqlite();
      const where: string[] = ["p.party_id != ?"];
      const params: unknown[] = [WALKIN_CUSTOMER_ID];

      if (type !== "all") {
        where.push("p.type = ?");
        params.push(type);
      }
      if (partyId) {
        where.push("p.party_id = ?");
        params.push(partyId);
      }
      if (search) {
        where.push(
          `(COALESCE(c.shop_name, s.name, '') LIKE ?
            OR COALESCE(p.cheque_no, '') LIKE ?
            OR COALESCE(sa.invoice_no, pu.invoice_no, '') LIKE ?)`
        );
        const like = `%${search}%`;
        params.push(like, like, like);
      }
      const whereSql = `WHERE ${where.join(" AND ")}`;

      const countRows = await sqlite.select<{ c: number }[]>(
        `SELECT COUNT(*) AS c ${PAYMENTS_FROM} ${whereSql}`,
        params
      );
      const total = countRows[0]?.c ?? 0;

      const rows = await sqlite.select<RawPaymentRow[]>(
        `SELECT p.id, p.type, p.party_id,
                COALESCE(c.shop_name, s.name) AS party_name,
                p.reference_id,
                COALESCE(sa.invoice_no, pu.invoice_no) AS reference_no,
                p.amount, p.payment_method, p.cheque_no, p.bank_name, p.notes,
                p.payment_date, p.is_refund, p.is_reversed, p.reversal_id, p.created_at
           ${PAYMENTS_FROM}
           ${whereSql}
          ORDER BY p.payment_date DESC, p.created_at DESC
          LIMIT ${ITEMS_PER_PAGE} OFFSET ${(page - 1) * ITEMS_PER_PAGE}`,
        params
      );

      const mapped: PaymentRow[] = rows.map((r) => ({
        id: r.id,
        type: r.type as PartyType,
        partyId: r.party_id,
        partyName: r.party_name ?? "Unknown",
        referenceId: r.reference_id,
        referenceNo: r.reference_no,
        amount: r.amount,
        paymentMethod: r.payment_method,
        chequeNo: r.cheque_no,
        bankName: r.bank_name,
        notes: r.notes,
        paymentDate: r.payment_date,
        isRefund: Boolean(r.is_refund),
        isReversed: Boolean(r.is_reversed),
        reversalId: r.reversal_id,
        createdAt: r.created_at,
      }));
      return { rows: mapped, total };
    },
    [type, partyId, search, page]
  );

  return {
    data: q.data?.rows ?? null,
    totalCount: q.data?.total ?? 0,
    isLoading: q.isLoading,
    error: q.error,
    refetch: q.refetch,
  };
}

// Per-invoice overdue definition (Financial Rules §13) — NOT customer.outstandingBalance.
// date('now','localtime') is used so "today" matches the local calendar day.
export function useOverdueInvoices(page = 1) {
  const q = useQuery(async () => {
    const sqlite = getSqlite();
    const overdueWhere = `
      s.due_date < date('now', 'localtime')
      AND s.payment_status != 'paid'
      AND s.is_cancelled = 0
      AND s.customer_id != ?
    `;
    const countRows = await sqlite.select<{ c: number }[]>(
      `SELECT COUNT(*) AS c FROM sales s WHERE ${overdueWhere}`,
      [WALKIN_CUSTOMER_ID]
    );
    const rows = await sqlite.select<
      {
        id: string;
        invoice_no: string;
        customer_id: string;
        shop_name: string;
        sale_date: string;
        due_date: string;
        total_amount: number;
        paid_amount: number;
        payment_status: string;
        days_overdue: number;
      }[]
    >(
      `SELECT s.id, s.invoice_no, s.customer_id, c.shop_name, s.sale_date, s.due_date,
              s.total_amount, s.paid_amount, s.payment_status,
              CAST(julianday(date('now', 'localtime')) - julianday(s.due_date) AS INTEGER) AS days_overdue
         FROM sales s
         JOIN customers c ON c.id = s.customer_id
        WHERE ${overdueWhere}
        ORDER BY s.due_date ASC
        LIMIT ${ITEMS_PER_PAGE} OFFSET ${(page - 1) * ITEMS_PER_PAGE}`,
      [WALKIN_CUSTOMER_ID]
    );
    const mapped: OverdueInvoice[] = rows.map((r) => ({
      id: r.id,
      invoiceNo: r.invoice_no,
      customerId: r.customer_id,
      customerName: r.shop_name,
      saleDate: r.sale_date,
      dueDate: r.due_date,
      totalAmount: r.total_amount,
      paidAmount: r.paid_amount,
      balance: round2(r.total_amount - r.paid_amount),
      paymentStatus: r.payment_status,
      daysOverdue: Math.max(0, r.days_overdue),
    }));
    return { rows: mapped, total: countRows[0]?.c ?? 0 };
  }, [page]);

  return {
    data: q.data?.rows ?? null,
    totalCount: q.data?.total ?? 0,
    isLoading: q.isLoading,
    error: q.error,
    refetch: q.refetch,
  };
}

// Open (unpaid/partial, non-cancelled) invoices for a party — used by the "Link to invoice" select.
export function useOpenInvoices(type: PartyType, partyId: string) {
  return useQuery(async (): Promise<OpenInvoice[]> => {
    if (!partyId) return [];
    const sqlite = getSqlite();
    if (type === "customer") {
      const rows = await sqlite.select<
        {
          id: string;
          invoice_no: string;
          sale_date: string;
          due_date: string;
          total_amount: number;
          paid_amount: number;
          payment_status: string;
        }[]
      >(
        `SELECT id, invoice_no, sale_date, due_date, total_amount, paid_amount, payment_status
           FROM sales
          WHERE customer_id = ? AND is_cancelled = 0 AND payment_status != 'paid'
          ORDER BY due_date ASC`,
        [partyId]
      );
      return rows.map((r) => ({
        id: r.id,
        reference: r.invoice_no,
        date: r.sale_date,
        dueDate: r.due_date,
        totalAmount: r.total_amount,
        paidAmount: r.paid_amount,
        balance: round2(r.total_amount - r.paid_amount),
        paymentStatus: r.payment_status as PaymentStatus,
      }));
    }
    const rows = await sqlite.select<
      {
        id: string;
        invoice_no: string | null;
        purchase_date: string;
        total_amount: number;
        paid_amount: number;
        payment_status: string;
      }[]
    >(
      `SELECT id, invoice_no, purchase_date, total_amount, paid_amount, payment_status
         FROM purchases
        WHERE supplier_id = ? AND is_cancelled = 0 AND payment_status != 'paid'
        ORDER BY purchase_date ASC`,
      [partyId]
    );
    return rows.map((r) => ({
      id: r.id,
      reference: r.invoice_no ?? `Purchase ${r.purchase_date}`,
      date: r.purchase_date,
      dueDate: null,
      totalAmount: r.total_amount,
      paidAmount: r.paid_amount,
      balance: round2(r.total_amount - r.paid_amount),
      paymentStatus: r.payment_status as PaymentStatus,
    }));
  }, [type, partyId]);
}

// Party dropdown options. Customers exclude WALKIN (Coding Rule 20).
export function usePartyOptions(type: PartyType) {
  return useQuery(async (): Promise<PartyOption[]> => {
    const sqlite = getSqlite();
    if (type === "customer") {
      return sqlite.select<PartyOption[]>(
        `SELECT id, shop_name AS name, outstanding_balance AS balance
           FROM customers
          WHERE id != ? AND is_active = 1
          ORDER BY shop_name ASC`,
        [WALKIN_CUSTOMER_ID]
      );
    }
    return sqlite.select<PartyOption[]>(
      `SELECT id, name, outstanding_balance AS balance
         FROM suppliers
        WHERE is_active = 1
        ORDER BY name ASC`
    );
  }, [type]);
}

// ─── MUTATIONS ───────────────────────────────────────────────────────────────

async function recordPartyPayment(type: PartyType, input: RecordPaymentInput): Promise<string> {
  const cfg = PARTY_CONFIG[type];
  const amount = round2(input.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }
  if (!PAYMENT_METHODS.some((m) => m.value === input.paymentMethod)) {
    throw new Error("Invalid payment method. Use cash, bank or cheque.");
  }
  if (!input.partyId) throw new Error(`Select a ${cfg.label.toLowerCase()}.`);
  if (type === "customer" && input.partyId === WALKIN_CUSTOMER_ID) {
    throw new Error("Walk-in sales are always fully paid — payments cannot be recorded for them.");
  }

  const chequeNo =
    input.paymentMethod === "cheque" ? input.chequeNo?.trim() || null : null;
  const bankName =
    input.paymentMethod === "cheque" || input.paymentMethod === "bank"
      ? input.bankName?.trim() || null
      : null;
  const notes = input.notes?.trim() || null;

  return withTransaction(async () => {
    const sqlite = getSqlite();
    const now = nowISO();
    const paymentId = generateId();

    const partyRows = await sqlite.select<{ name: string; balance: number }[]>(
      `SELECT ${cfg.nameCol} AS name, outstanding_balance AS balance
         FROM ${cfg.partyTable} WHERE id = ?`,
      [input.partyId]
    );
    const party = partyRows[0];
    if (!party) throw new Error(`${cfg.label} not found.`);

    let referenceNo: string | null = null;

    if (input.referenceId) {
      const refRows = await sqlite.select<
        {
          id: string;
          party_id: string;
          invoice_no: string | null;
          total_amount: number;
          paid_amount: number;
          is_cancelled: number;
        }[]
      >(
        `SELECT id, ${cfg.refPartyCol} AS party_id, invoice_no, total_amount, paid_amount, is_cancelled
           FROM ${cfg.refTable} WHERE id = ?`,
        [input.referenceId]
      );
      const ref = refRows[0];
      if (!ref || ref.party_id !== input.partyId) {
        throw new Error(`The selected invoice does not belong to this ${cfg.label.toLowerCase()}.`);
      }
      if (ref.is_cancelled) {
        throw new Error("Cannot record a payment against a cancelled invoice.");
      }
      const invoiceBalance = round2(ref.total_amount - ref.paid_amount);
      if (amount > invoiceBalance + 0.005) {
        throw new Error(`Payment exceeds the invoice balance (${formatCurrency(invoiceBalance)}).`);
      }
      const newPaid = round2(ref.paid_amount + amount);
      await sqlite.execute(
        `UPDATE ${cfg.refTable}
            SET paid_amount = ?, payment_status = ?, updated_at = ?
          WHERE id = ?`,
        [newPaid, statusFor(ref.total_amount, newPaid), now, ref.id]
      );
      referenceNo = ref.invoice_no;
    } else {
      // Unlinked payment: reduces total balance only — no per-invoice update.
      if (amount > round2(party.balance) + 0.005) {
        throw new Error(
          `Payment exceeds the outstanding balance (${formatCurrency(round2(party.balance))}).`
        );
      }
    }

    await sqlite.execute(
      `INSERT INTO payments
         (id, type, party_id, reference_id, amount, payment_method, cheque_no, bank_name,
          notes, payment_date, is_refund, is_reversed, reversal_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, ?)`,
      [
        paymentId,
        type,
        input.partyId,
        input.referenceId ?? null,
        amount,
        input.paymentMethod,
        chequeNo,
        bankName,
        notes,
        input.paymentDate,
        now,
      ]
    );

    await sqlite.execute(
      `UPDATE ${cfg.partyTable}
          SET outstanding_balance = outstanding_balance - ?, updated_at = ?
        WHERE id = ?`,
      [amount, now, input.partyId]
    );

    await sqlite.execute(
      `INSERT INTO audit_log
         (id, event_type, entity_type, entity_id, description, old_values, new_values, created_at)
       VALUES (?, ?, 'payment', ?, ?, ?, ?, ?)`,
      [
        generateId(),
        cfg.auditEvent,
        paymentId,
        type === "customer"
          ? `Payment received from ${party.name}: ${formatCurrency(amount)} (${input.paymentMethod})` +
            (referenceNo ? ` against ${referenceNo}` : "")
          : `Payment made to ${party.name}: ${formatCurrency(amount)} (${input.paymentMethod})` +
            (referenceNo ? ` against ${referenceNo}` : ""),
        JSON.stringify({ balance: party.balance }),
        JSON.stringify({
          balance: round2(party.balance - amount),
          amount,
          paymentMethod: input.paymentMethod,
          referenceId: input.referenceId ?? null,
          isRefund: false,
        }),
        now,
      ]
    );

    return paymentId;
  });
}

// Records a payment RECEIVED from a customer (isRefund = false).
export function recordCustomerPayment(input: RecordPaymentInput): Promise<string> {
  return recordPartyPayment("customer", input);
}

// Records a payment MADE to a supplier.
export function recordSupplierPayment(input: RecordPaymentInput): Promise<string> {
  return recordPartyPayment("supplier", input);
}

interface RawPaymentFull {
  id: string;
  type: string;
  party_id: string;
  reference_id: string | null;
  amount: number;
  payment_method: string;
  cheque_no: string | null;
  bank_name: string | null;
  notes: string | null;
  is_refund: number;
  is_reversed: number;
}

// Payments are never deleted (Financial Rules §8). Reversal:
//   1. inserts a counter-entry (is_reversed = 1) linked to the original,
//   2. marks the ORIGINAL is_reversed = 1 with reversal_id → counter-entry.
// Both rows are flagged reversed, so balance formulas (which exclude reversed rows) ignore the pair,
// and the cached balances / invoice paid amounts are put back here.
export async function reversePayment(paymentId: string, reason?: string): Promise<void> {
  await withTransaction(async () => {
    const sqlite = getSqlite();
    const now = nowISO();

    const rows = await sqlite.select<RawPaymentFull[]>(
      `SELECT id, type, party_id, reference_id, amount, payment_method, cheque_no,
              bank_name, notes, is_refund, is_reversed
         FROM payments WHERE id = ?`,
      [paymentId]
    );
    const p = rows[0];
    if (!p) throw new Error("Payment not found.");
    if (p.is_reversed) throw new Error("This payment has already been reversed.");
    if (p.type !== "customer" && p.type !== "supplier") {
      throw new Error("Unknown payment type.");
    }

    const type = p.type as PartyType;
    const cfg = PARTY_CONFIG[type];
    const counterId = generateId();
    const cleanReason = reason?.trim();
    const counterNotes =
      `${REVERSAL_NOTE_PREFIX}${p.id}` + (cleanReason ? ` — ${cleanReason}` : "");

    await sqlite.execute(
      `INSERT INTO payments
         (id, type, party_id, reference_id, amount, payment_method, cheque_no, bank_name,
          notes, payment_date, is_refund, is_reversed, reversal_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        counterId,
        p.type,
        p.party_id,
        p.reference_id,
        p.amount,
        p.payment_method,
        p.cheque_no,
        p.bank_name,
        counterNotes,
        todayDate(),
        p.is_refund,
        p.id,
        now,
      ]
    );

    await sqlite.execute(
      `UPDATE payments SET is_reversed = 1, reversal_id = ? WHERE id = ?`,
      [counterId, p.id]
    );

    // Undo the linked invoice's paid amount. Cash/bank/cheque REFUNDS (isRefund) never touched
    // the invoice's paid_amount (Financial Rules §12), so they are skipped here.
    if (p.reference_id && !(type === "customer" && p.is_refund)) {
      const refRows = await sqlite.select<{ total_amount: number; paid_amount: number }[]>(
        `SELECT total_amount, paid_amount FROM ${cfg.refTable} WHERE id = ?`,
        [p.reference_id]
      );
      const ref = refRows[0];
      if (ref) {
        const newPaid = Math.max(0, round2(ref.paid_amount - p.amount));
        await sqlite.execute(
          `UPDATE ${cfg.refTable}
              SET paid_amount = ?, payment_status = ?, updated_at = ?
            WHERE id = ?`,
          [newPaid, statusFor(ref.total_amount, newPaid), now, p.reference_id]
        );
      }
    }

    // Payments (and refunds) reduced the balance, so reversing one adds it back.
    await sqlite.execute(
      `UPDATE ${cfg.partyTable}
          SET outstanding_balance = outstanding_balance + ?, updated_at = ?
        WHERE id = ?`,
      [p.amount, now, p.party_id]
    );

    await sqlite.execute(
      `INSERT INTO audit_log
         (id, event_type, entity_type, entity_id, description, old_values, new_values, created_at)
       VALUES (?, ?, 'payment', ?, ?, ?, ?, ?)`,
      [
        generateId(),
        AUDIT_EVENTS.PAYMENT_REVERSED,
        p.id,
        `Payment reversed: ${formatCurrency(p.amount)} (${p.payment_method})` +
          (p.is_refund ? " [refund]" : ""),
        JSON.stringify({ isReversed: false, amount: p.amount }),
        JSON.stringify({
          isReversed: true,
          reversalEntryId: counterId,
          reason: cleanReason ?? null,
          isRefund: Boolean(p.is_refund),
        }),
        now,
      ]
    );
  });
}