// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, parseISO, addDays } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Named generateId — NOT "nanoid". Do NOT install the npm "nanoid" package.
// The name conflict would cause silent import errors.
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function todayDate(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function addDaysToDate(dateStr: string, days: number): string {
  return format(addDays(parseISO(dateStr), days), "yyyy-MM-dd");
}

// Uses explicit regex formatting — en-PK locale is unreliable in Tauri's Chromium WebView.
export function formatCurrency(amount: number, symbol = "Rs."): string {
  const abs = Math.abs(amount).toFixed(2).replace(/\.00$/, "");
  const formatted = abs.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${symbol} ${amount < 0 ? "-" : ""}${formatted}`;
}

export function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "dd MMM yyyy");
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "dd MMM yyyy, hh:mm a");
  } catch {
    return dateStr;
  }
}

export function formatRelativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

// isCancelled parameter: cancelled sales are never overdue regardless of dueDate.
export function isOverdue(
  dueDate: string,
  paymentStatus: string,
  isCancelled = false
): boolean {
  if (isCancelled || paymentStatus === "paid") return false;
  return dueDate < todayDate();
}

export function daysOverdue(dueDate: string): number {
  const due = parseISO(dueDate);
  const today = new Date();
  const diff = Math.floor(
    (today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.max(0, diff);
}

// calcInvoiceNo: pure function — used inside createSale transaction and in unit tests.
export function calcInvoiceNo(prefix: string, n: number): string {
  return `${prefix}${String(n).padStart(4, "0")}`;
}

export function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

// Uses the costPrice parameter — never reads from any global or product state.
// Always pass saleItems.costPrice for historical profit — never products.avgCost.
export function calcItemProfit(
  salePrice: number,
  costPrice: number,
  discountPct: number,
  qty: number
): number {
  const effectivePrice = salePrice * (1 - discountPct / 100);
  return (effectivePrice - costPrice) * qty;
}

export function calcMarginPct(revenue: number, cogs: number): number {
  if (revenue === 0) return 0;
  return ((revenue - cogs) / revenue) * 100;
}

export function getStatusColor(status: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case "paid":
      return { bg: "#dcfce7", text: "#16a34a", border: "#bbf7d0" };
    case "partial":
      return { bg: "#fef3c7", text: "#d97706", border: "#fde68a" };
    case "unpaid":
      return { bg: "#fee2e2", text: "#dc2626", border: "#fecaca" };
    default:
      return { bg: "#f3f4f6", text: "#6b7280", border: "#e5e7eb" };
  }
}