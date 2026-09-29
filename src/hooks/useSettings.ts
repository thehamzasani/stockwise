// src/hooks/useSettings.ts
import { useCallback, useEffect, useState } from "react";
import { getSqlite } from "@/db";
import { withTransaction } from "@/db/transaction";
import { useAppStore } from "@/stores/appStore";
import { SETTINGS_ID, AUDIT_EVENTS } from "@/lib/constants";
import { generateId, nowISO } from "@/lib/utils";
import type { AppSettings } from "@/types";

interface SettingsRow {
  id: string;
  business_name: string;
  business_phone: string | null;
  business_address: string | null;
  business_city: string | null;
  currency: string;
  expenses_enabled: number;
  tax_enabled: number;
  tax_rate: number;
  invoice_prefix: string;
  next_invoice_no: number;
  updated_at: string;
}

// Fields the user may edit. nextInvoiceNo is intentionally excluded:
// it is only ever incremented inside the createSale transaction (Financial Rules §3).
export interface SettingsUpdate {
  businessName?: string;
  businessPhone?: string | null;
  businessAddress?: string | null;
  businessCity?: string | null;
  currency?: string;
  expensesEnabled?: boolean;
  taxEnabled?: boolean;
  taxRate?: number;
  invoicePrefix?: string;
}

function mapRow(r: SettingsRow): AppSettings {
  return {
    id: r.id,
    businessName: r.business_name,
    businessPhone: r.business_phone,
    businessAddress: r.business_address,
    businessCity: r.business_city,
    currency: r.currency,
    expensesEnabled: r.expenses_enabled === 1,
    taxEnabled: r.tax_enabled === 1,
    taxRate: r.tax_rate,
    invoicePrefix: r.invoice_prefix,
    nextInvoiceNo: r.next_invoice_no,
    updatedAt: r.updated_at,
  };
}

export async function fetchSettings(): Promise<AppSettings> {
  const sqlite = getSqlite();
  const rows = await sqlite.select<SettingsRow[]>(
    "SELECT * FROM app_settings WHERE id = ?",
    [SETTINGS_ID]
  );
  if (rows.length === 0) throw new Error("Settings record not found.");
  return mapRow(rows[0]);
}

async function persistSettings(updates: SettingsUpdate): Promise<AppSettings> {
  return withTransaction(async () => {
    const sqlite = getSqlite();

    const rows = await sqlite.select<SettingsRow[]>(
      "SELECT * FROM app_settings WHERE id = ?",
      [SETTINGS_ID]
    );
    if (rows.length === 0) throw new Error("Settings record not found.");
    const current = mapRow(rows[0]);

    const merged: AppSettings = { ...current, ...updates };

    // Work out which keys actually changed, for the audit log
    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};
    (Object.keys(updates) as (keyof SettingsUpdate)[]).forEach((key) => {
      if (current[key] !== merged[key]) {
        oldValues[key] = current[key];
        newValues[key] = merged[key];
      }
    });

    if (Object.keys(newValues).length === 0) return current;

    const now = nowISO();

    await sqlite.execute(
      `UPDATE app_settings SET
         business_name = ?, business_phone = ?, business_address = ?, business_city = ?,
         currency = ?, expenses_enabled = ?, tax_enabled = ?, tax_rate = ?,
         invoice_prefix = ?, updated_at = ?
       WHERE id = ?`,
      [
        merged.businessName,
        merged.businessPhone,
        merged.businessAddress,
        merged.businessCity,
        merged.currency,
        merged.expensesEnabled ? 1 : 0,
        merged.taxEnabled ? 1 : 0,
        merged.taxRate,
        merged.invoicePrefix,
        now,
        SETTINGS_ID,
      ]
    );

    const changedKeys = Object.keys(newValues).join(", ");
    await sqlite.execute(
      `INSERT INTO audit_log
         (id, event_type, entity_type, entity_id, description, old_values, new_values, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        AUDIT_EVENTS.SETTINGS_CHANGED,
        "settings",
        SETTINGS_ID,
        `Settings changed: ${changedKeys}`,
        JSON.stringify(oldValues),
        JSON.stringify(newValues),
        now,
      ]
    );

    return { ...merged, updatedAt: now };
  });
}

export function useSettings() {
  const setStoreSettings = useAppStore((s) => s.setSettings);

  const [data, setData] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchSettings()
      .then((s) => {
        if (cancelled) return;
        setData(s);
        setError(null);
        setStoreSettings(s);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tick, setStoreSettings]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  // Saves, then immediately pushes the result into useAppStore so the
  // sidebar (Expenses nav, etc.) reacts without a page reload.
  const saveSettings = useCallback(
    async (updates: SettingsUpdate): Promise<AppSettings> => {
      const updated = await persistSettings(updates);
      setData(updated);
      setStoreSettings(updated);
      return updated;
    },
    [setStoreSettings]
  );

  return { data, isLoading, error, refetch, saveSettings };
}