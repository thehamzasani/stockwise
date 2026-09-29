// src/hooks/useExpenses.ts
import { useState, useEffect, useCallback } from "react";
import { getSqlite } from "@/db";
import { generateId, nowISO } from "@/lib/utils";
import { AUDIT_EVENTS, ITEMS_PER_PAGE } from "@/lib/constants";
import type { Expense } from "@/types";

interface UseExpensesOptions {
  page?: number;
  search?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface UseExpensesResult {
  data: Expense[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useExpenses(options: UseExpensesOptions = {}): UseExpensesResult {
  const { page = 1, search = "", category = "", dateFrom = "", dateTo = "" } = options;
  const [data, setData] = useState<Expense[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const sqlite = getSqlite();
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (search) {
          conditions.push("(description LIKE ? OR category LIKE ?)");
          params.push(`%${search}%`, `%${search}%`);
        }
        if (category) {
          conditions.push("category = ?");
          params.push(category);
        }
        if (dateFrom) {
          conditions.push("expense_date >= ?");
          params.push(dateFrom);
        }
        if (dateTo) {
          conditions.push("expense_date <= ?");
          params.push(dateTo);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const offset = (page - 1) * ITEMS_PER_PAGE;

        const countResult = await sqlite.select<{ c: number }[]>(
          `SELECT COUNT(*) AS c FROM expenses ${where}`,
          params
        );
        const total = countResult[0]?.c ?? 0;

        const rows = await sqlite.select<Expense[]>(
          `SELECT * FROM expenses ${where} ORDER BY expense_date DESC, created_at DESC
           LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}`,
          params
        );

        if (!cancelled) {
          setData(rows);
          setTotalCount(total);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [page, search, category, dateFrom, dateTo, tick]);

  return { data, totalCount, isLoading, error, refetch };
}

export interface CreateExpenseInput {
  category: string;
  description: string;
  amount: number;
  expenseDate: string;
  notes?: string;
}

export async function createExpense(input: CreateExpenseInput): Promise<string> {
  const sqlite = getSqlite();
  const id = generateId();
  const now = nowISO();

  await sqlite.execute(
    `INSERT INTO expenses (id, category, description, amount, expense_date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.category, input.description, input.amount, input.expenseDate, input.notes ?? null, now]
  );

  await sqlite.execute(
    `INSERT INTO audit_log (id, event_type, entity_type, entity_id, description, new_values, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      AUDIT_EVENTS.SETTINGS_CHANGED,
      "expense",
      id,
      `Expense recorded: ${input.description} (${input.category}) — Rs. ${input.amount.toFixed(2)}`,
      JSON.stringify(input),
      now,
    ]
  );

  return id;
}

export interface UpdateExpenseInput extends CreateExpenseInput {
  id: string;
}

export async function updateExpense(input: UpdateExpenseInput): Promise<void> {
  const sqlite = getSqlite();
  const now = nowISO();

  await sqlite.execute(
    `UPDATE expenses
     SET category = ?, description = ?, amount = ?, expense_date = ?, notes = ?
     WHERE id = ?`,
    [input.category, input.description, input.amount, input.expenseDate, input.notes ?? null, input.id]
  );

  await sqlite.execute(
    `INSERT INTO audit_log (id, event_type, entity_type, entity_id, description, new_values, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      AUDIT_EVENTS.SETTINGS_CHANGED,
      "expense",
      input.id,
      `Expense updated: ${input.description} (${input.category}) — Rs. ${input.amount.toFixed(2)}`,
      JSON.stringify(input),
      now,
    ]
  );
}

export async function deleteExpense(id: string): Promise<void> {
  const sqlite = getSqlite();
  const now = nowISO();

  const rows = await sqlite.select<Array<{ description: string; amount: number }>>(
    "SELECT description, amount FROM expenses WHERE id = ?",
    [id]
  );
  const label = rows[0] ? `${rows[0].description} — Rs. ${rows[0].amount}` : id;

  await sqlite.execute("DELETE FROM expenses WHERE id = ?", [id]);

  await sqlite.execute(
    `INSERT INTO audit_log (id, event_type, entity_type, entity_id, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [generateId(), AUDIT_EVENTS.SETTINGS_CHANGED, "expense", id, `Expense deleted: ${label}`, now]
  );
}

export async function getExpenseSummary(
  dateFrom: string,
  dateTo: string
): Promise<{ category: string; total: number }[]> {
  const sqlite = getSqlite();
  return sqlite.select<{ category: string; total: number }[]>(
    `SELECT category, COALESCE(SUM(amount), 0) AS total
       FROM expenses
      WHERE expense_date >= ? AND expense_date <= ?
      GROUP BY category
      ORDER BY total DESC`,
    [dateFrom, dateTo]
  );
}