// src/hooks/useSuppliers.ts
import { useState, useEffect } from "react";
import { getSqlite } from "@/db";
import { generateId, nowISO } from "@/lib/utils";
import { AUDIT_EVENTS, ITEMS_PER_PAGE } from "@/lib/constants";
import type { Supplier, NewSupplier } from "@/types";

interface UseSuppliersOptions {
  search?: string;
  showInactive?: boolean;
  page?: number;
}

interface UseSuppliersResult {
  data: Supplier[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSuppliers(opts: UseSuppliersOptions = {}): UseSuppliersResult {
  const { search = "", showInactive = false, page = 1 } = opts;
  const [data, setData] = useState<Supplier[]>([]);
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

        if (!showInactive) {
          conditions.push("is_active = 1");
        }
        if (search) {
          conditions.push("(name LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR city LIKE ?)");
          params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const countResult = await sqlite.select<{ c: number }[]>(
          `SELECT COUNT(*) AS c FROM suppliers ${where}`,
          params
        );
        const rows = await sqlite.select<Supplier[]>(
          `SELECT * FROM suppliers ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
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
  }, [search, showInactive, page, tick]);

  return { data, totalCount, isLoading, error, refetch: () => setTick((t) => t + 1) };
}

interface UseSingleSupplierResult {
  data: Supplier | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSupplier(id: string): UseSingleSupplierResult {
  const [data, setData] = useState<Supplier | null>(null);
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
        const rows = await sqlite.select<Supplier[]>(
          "SELECT * FROM suppliers WHERE id = ?", [id]
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

export async function createSupplier(
  input: Omit<NewSupplier, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const id = generateId();
  const now = nowISO();
  const sqlite = getSqlite();

  await sqlite.execute(
    `INSERT INTO suppliers
      (id, name, contact_person, phone, city, address, notes,
       outstanding_balance, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.contactPerson ?? null,
      input.phone        ?? null,
      input.city         ?? null,
      input.address      ?? null,
      input.notes        ?? null,
      input.outstandingBalance ?? 0,
      input.isActive ?? true ? 1 : 0,
      now,
      now,
    ]
  );

  await sqlite.execute(
    `INSERT INTO audit_log (id, event_type, entity_type, entity_id, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [generateId(), AUDIT_EVENTS.PURCHASE_CREATED, "supplier", id, `Supplier created: ${input.name}`, now]
  );

  return id;
}

export async function updateSupplier(
  id: string,
  input: Partial<Omit<NewSupplier, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  const now = nowISO();
  const sqlite = getSqlite();

  const fields: string[] = [];
  const params: unknown[] = [];

  if (input.name            !== undefined) { fields.push("name = ?");             params.push(input.name); }
  if (input.contactPerson   !== undefined) { fields.push("contact_person = ?");   params.push(input.contactPerson); }
  if (input.phone           !== undefined) { fields.push("phone = ?");            params.push(input.phone); }
  if (input.city            !== undefined) { fields.push("city = ?");             params.push(input.city); }
  if (input.address         !== undefined) { fields.push("address = ?");          params.push(input.address); }
  if (input.notes           !== undefined) { fields.push("notes = ?");            params.push(input.notes); }
  if (input.isActive        !== undefined) { fields.push("is_active = ?");        params.push(input.isActive ? 1 : 0); }

  if (fields.length === 0) return;

  fields.push("updated_at = ?");
  params.push(now, id);

  await sqlite.execute(
    `UPDATE suppliers SET ${fields.join(", ")} WHERE id = ?`,
    params
  );

  await sqlite.execute(
    `INSERT INTO audit_log (id, event_type, entity_type, entity_id, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [generateId(), AUDIT_EVENTS.PURCHASE_CREATED, "supplier", id, `Supplier updated: ${id}`, now]
  );
}

export async function deleteSupplier(id: string): Promise<void> {
  const now = nowISO();
  const sqlite = getSqlite();

  // Check for linked purchases before deactivating
  const linked = await sqlite.select<{ c: number }[]>(
    "SELECT COUNT(*) AS c FROM purchases WHERE supplier_id = ? AND is_cancelled = 0",
    [id]
  );
  if ((linked[0]?.c ?? 0) > 0) {
    throw new Error(
      "Cannot deactivate this supplier — they have active purchases on record. " +
      "Cancel or settle all purchases first."
    );
  }

  await sqlite.execute(
    "UPDATE suppliers SET is_active = 0, updated_at = ? WHERE id = ?",
    [now, id]
  );

  await sqlite.execute(
    `INSERT INTO audit_log (id, event_type, entity_type, entity_id, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [generateId(), AUDIT_EVENTS.PURCHASE_CREATED, "supplier", id, `Supplier deactivated: ${id}`, now]
  );
}