// src/hooks/useAuditLog.ts
import { useCallback, useEffect, useState } from "react";
import { getSqlite } from "@/db";
import { AUDIT_EVENTS, ITEMS_PER_PAGE } from "@/lib/constants";
import type { AuditLog } from "@/types";

// ─── EVENT LABELS ────────────────────────────────────────────────────────────
export const AUDIT_EVENT_LABELS: Record<string, string> = {
  [AUDIT_EVENTS.SALE_CREATED]:           "Sale created",
  [AUDIT_EVENTS.SALE_CANCELLED]:         "Sale cancelled",
  [AUDIT_EVENTS.SALE_PAYMENT]:           "Payment received",
  [AUDIT_EVENTS.PURCHASE_CREATED]:       "Purchase created",
  [AUDIT_EVENTS.PURCHASE_CANCELLED]:     "Purchase cancelled",
  [AUDIT_EVENTS.PURCHASE_PAYMENT]:       "Payment made",
  [AUDIT_EVENTS.PAYMENT_REVERSED]:       "Payment reversed",
  [AUDIT_EVENTS.SALE_RETURN]:            "Sale return",
  [AUDIT_EVENTS.PURCHASE_RETURN]:        "Purchase return",
  [AUDIT_EVENTS.STOCK_ADJUSTED]:         "Stock adjusted",
  [AUDIT_EVENTS.CUSTOMER_BALANCE_FIXED]: "Customer balance fixed",
  [AUDIT_EVENTS.SUPPLIER_BALANCE_FIXED]: "Supplier balance fixed",
  [AUDIT_EVENTS.STOCK_FIXED]:            "Stock level fixed",
  [AUDIT_EVENTS.SETTINGS_CHANGED]:       "Settings changed",
  [AUDIT_EVENTS.BACKUP_CREATED]:         "Backup created",
  [AUDIT_EVENTS.DATABASE_RESTORED]:      "Database restored",
};

export interface AuditDisplay {
  label: string;
  description: string;
  isRefund: boolean;
}

/**
 * Financial Rules §18: refund payouts must never read as "Payment received".
 * A payment audit entry is a refund when its newValues JSON has isRefund = true.
 */
export function getAuditDisplay(
  entry: Pick<AuditLog, "eventType" | "description" | "newValues">
): AuditDisplay {
  let label =
    AUDIT_EVENT_LABELS[entry.eventType] ?? entry.eventType.replace(/_/g, " ");
  let description = entry.description;
  let isRefund = false;

  const isCustomerPaymentEvent =
    entry.eventType === AUDIT_EVENTS.SALE_PAYMENT ||
    entry.eventType === AUDIT_EVENTS.PAYMENT_REVERSED;

  if (isCustomerPaymentEvent && entry.newValues) {
    try {
      const parsed = JSON.parse(entry.newValues) as Record<string, unknown>;
      isRefund =
        parsed.isRefund === true ||
        parsed.is_refund === true ||
        parsed.is_refund === 1;
    } catch {
      isRefund = false;
    }
  }

  if (isRefund) {
    label =
      entry.eventType === AUDIT_EVENTS.PAYMENT_REVERSED
        ? "Refund reversed"
        : "Refund paid";
    description = description.replace(/payment received/gi, "Refund paid");
  }

  return { label, description, isRefund };
}

// ─── ROW MAPPING ─────────────────────────────────────────────────────────────
interface AuditRow {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  old_values: string | null;
  new_values: string | null;
  created_at: string;
}

function mapRow(r: AuditRow): AuditLog {
  return {
    id: r.id,
    eventType: r.event_type,
    entityType: r.entity_type,
    entityId: r.entity_id,
    description: r.description,
    oldValues: r.old_values,
    newValues: r.new_values,
    createdAt: r.created_at,
  };
}

// ─── PAGINATED LIST WITH FILTERS ─────────────────────────────────────────────
export interface AuditLogOptions {
  page?: number;
  eventType?: string;
  entityType?: string;
  dateFrom?: string; // yyyy-MM-dd
  dateTo?: string;   // yyyy-MM-dd
}

function buildWhere(o: AuditLogOptions): { clause: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (o.eventType) {
    conditions.push("event_type = ?");
    params.push(o.eventType);
  }
  if (o.entityType) {
    conditions.push("entity_type = ?");
    params.push(o.entityType);
  }
  if (o.dateFrom) {
    conditions.push("created_at >= ?");
    params.push(o.dateFrom);
  }
  if (o.dateTo) {
    conditions.push("created_at <= ?");
    params.push(`${o.dateTo}T23:59:59.999Z`);
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

export function useAuditLog(options: AuditLogOptions = {}) {
  const { page = 1, eventType, entityType, dateFrom, dateTo } = options;

  const [data, setData]             = useState<AuditLog[] | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [tick, setTick]             = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const sqlite = getSqlite();
        const { clause, params } = buildWhere({ eventType, entityType, dateFrom, dateTo });
        const offset = (Math.max(1, page) - 1) * ITEMS_PER_PAGE;

        const countRows = await sqlite.select<{ c: number }[]>(
          `SELECT COUNT(*) AS c FROM audit_log ${clause}`,
          params
        );
        const rows = await sqlite.select<AuditRow[]>(
          `SELECT id, event_type, entity_type, entity_id, description,
                  old_values, new_values, created_at
             FROM audit_log ${clause}
            ORDER BY created_at DESC
            LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}`,
          params
        );

        if (cancelled) return;
        setTotalCount(countRows[0]?.c ?? 0);
        setData(rows.map(mapRow));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [page, eventType, entityType, dateFrom, dateTo, tick]);

  return { data, totalCount, isLoading, error, refetch };
}

// ─── RECENT ENTRIES (Settings → Data Integrity) ──────────────────────────────
export function useRecentAuditLog(limit = 10) {
  const [data, setData]           = useState<AuditLog[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [tick, setTick]           = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const rows = await getSqlite().select<AuditRow[]>(
          `SELECT id, event_type, entity_type, entity_id, description,
                  old_values, new_values, created_at
             FROM audit_log
            ORDER BY created_at DESC
            LIMIT ${Math.max(1, Math.floor(limit))}`
        );
        if (!cancelled) setData(rows.map(mapRow));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [limit, tick]);

  return { data, isLoading, error, refetch };
}

// ─── DISTINCT ENTITY TYPES (for the filter dropdown) ─────────────────────────
export function useAuditEntityTypes() {
  const [data, setData] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const rows = await getSqlite().select<{ entity_type: string }[]>(
          "SELECT DISTINCT entity_type FROM audit_log ORDER BY entity_type ASC"
        );
        if (!cancelled) setData(rows.map((r) => r.entity_type));
      } catch {
        if (!cancelled) setData([]);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return data;
}