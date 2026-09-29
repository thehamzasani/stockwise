// src/hooks/usePDF.ts
// No JSX in this file (.ts extension) — elements are built with createElement.
import { createElement, type ReactElement } from "react";
import { pdf, type DocumentProps } from "@react-pdf/renderer";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-shell";
import { eq } from "drizzle-orm";
import { toast } from "sonner";

import { getDb } from "@/db";
import { sales, saleItems, products, customers } from "@/db/schema";
import { useAppStore } from "@/stores/appStore";
import InvoicePDF from "@/lib/pdf/InvoicePDF";
import StatementPDF from "@/lib/pdf/StatementPDF";
import type {
  SaleWithItems,
  AppSettings,
  Customer,
  LedgerEntry,
} from "@/types";

// ─── Shared save + open flow ─────────────────────────────────────────────────

async function saveAndOpenPdf(
  element: ReactElement<DocumentProps>,
  defaultPath: string
): Promise<void> {
  const blob = await pdf(element).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer); // Uint8Array required by fs v2

  const filePath = await save({
    defaultPath,
    filters: [{ name: "PDF Files", extensions: ["pdf"] }],
  });
  if (!filePath) return; // user cancelled dialog — do nothing

  await writeFile(filePath, uint8Array);
  toast.success("PDF saved");

  try {
    await open(filePath); // open in system PDF viewer
  } catch {
    // Shell scope may reject local paths — the file is saved regardless.
    toast.info(`Saved to ${filePath}`);
  }
}

function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim();
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function generateInvoicePDF(
  sale: SaleWithItems,
  settings: AppSettings
): Promise<void> {
  try {
    const element = createElement(InvoicePDF, {
      sale,
      settings,
    }) as ReactElement<DocumentProps>;
    await saveAndOpenPdf(element, `Invoice-${safeFileName(sale.invoiceNo)}.pdf`);
  } catch (err) {
    console.error("[StockWise] Invoice PDF failed:", err);
    toast.error(err instanceof Error ? err.message : "Failed to generate invoice PDF");
  }
}

export async function generateStatementPDF(
  customer: Customer,
  entries: LedgerEntry[],
  settings: AppSettings,
  dateRange: { from: string; to: string }
): Promise<void> {
  try {
    const element = createElement(StatementPDF, {
      customer,
      entries,
      settings,
      dateRange,
    }) as ReactElement<DocumentProps>;
    await saveAndOpenPdf(
      element,
      `Statement-${safeFileName(customer.shopName)}-${dateRange.from}.pdf`
    );
  } catch (err) {
    console.error("[StockWise] Statement PDF failed:", err);
    toast.error(err instanceof Error ? err.message : "Failed to generate statement PDF");
  }
}

// ─── Loader: build SaleWithItems from a sale id (read-only, outside a transaction) ─

export async function loadSaleWithItems(saleId: string): Promise<SaleWithItems> {
  const db = getDb();

  const saleRows = await db.select().from(sales).where(eq(sales.id, saleId));
  const sale = saleRows[0];
  if (!sale) throw new Error("Sale not found.");

  const customerRows = await db
    .select()
    .from(customers)
    .where(eq(customers.id, sale.customerId));
  const customer = customerRows[0];
  if (!customer) throw new Error("Customer not found for this sale.");

  const itemRows = await db
    .select({ item: saleItems, product: products })
    .from(saleItems)
    .innerJoin(products, eq(saleItems.productId, products.id))
    .where(eq(saleItems.saleId, saleId));

  return {
    ...sale,
    customer,
    items: itemRows.map((r) => ({ ...r.item, product: r.product })),
  };
}

// ─── Convenience: print by sale id (used by SalesPage and NewSalePage) ───────

export async function printInvoiceById(saleId: string): Promise<void> {
  try {
    const settings = useAppStore.getState().settings;
    if (!settings) throw new Error("Settings not loaded yet.");
    const sale = await loadSaleWithItems(saleId);
    await generateInvoicePDF(sale, settings);
  } catch (err) {
    console.error("[StockWise] printInvoiceById failed:", err);
    toast.error(err instanceof Error ? err.message : "Failed to print invoice");
  }
}