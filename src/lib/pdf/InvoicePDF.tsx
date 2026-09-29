// src/lib/pdf/InvoicePDF.tsx
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { SaleWithItems, AppSettings } from "@/types";
import { formatCurrency, formatDate, todayDate } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/lib/constants";

const BLUE = "#2563eb";
const RED = "#dc2626";
const GREEN = "#16a34a";
const TEXT = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e4e7ec";
const ALT_ROW = "#f9fafb";

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: "Helvetica", fontSize: 10, color: TEXT },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  businessName: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  muted: { color: MUTED, fontSize: 9, marginBottom: 2 },
  headerRight: { alignItems: "flex-end" },
  invoiceTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: BLUE,
    marginBottom: 4,
  },
  invoiceMeta: { fontSize: 10, marginBottom: 2 },

  billTo: { marginBottom: 20 },
  billToLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  customerName: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 2 },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: BLUE,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  th: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 9 },
  row: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  colNo: { width: "6%" },
  colProduct: { width: "38%" },
  colQty: { width: "10%", textAlign: "right" },
  colPrice: { width: "18%", textAlign: "right" },
  colDisc: { width: "10%", textAlign: "right" },
  colAmount: { width: "18%", textAlign: "right" },

  summaryWrap: { alignItems: "flex-end", marginTop: 16 },
  summary: { width: "50%" },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  totalText: { fontSize: 13, fontFamily: "Helvetica-Bold", color: BLUE },

  payment: {
    marginTop: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
  },
  paymentTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    marginBottom: 6,
    textTransform: "uppercase",
  },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 30,
    right: 30,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8,
  },
  thanks: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 2 },
});

interface InvoicePDFProps {
  sale: SaleWithItems;
  settings: AppSettings;
}

function methodLabel(method: string | null): string {
  if (!method) return "—";
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
}

export default function InvoicePDF({ sale, settings }: InvoicePDFProps) {
  const symbol = settings.currency || "Rs.";
  const money = (n: number) => formatCurrency(n, symbol);
  const balanceDue = Math.max(0, sale.totalAmount - sale.paidAmount);
  const customer = sale.customer;
  const location = [customer.area, customer.city].filter(Boolean).join(", ");

  return (
    <Document title={`Invoice ${sale.invoiceNo}`} author={settings.businessName}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.businessName}>{settings.businessName}</Text>
            {settings.businessAddress ? (
              <Text style={styles.muted}>{settings.businessAddress}</Text>
            ) : null}
            {settings.businessCity ? (
              <Text style={styles.muted}>{settings.businessCity}</Text>
            ) : null}
            {settings.businessPhone ? (
              <Text style={styles.muted}>Phone: {settings.businessPhone}</Text>
            ) : null}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceMeta}>{sale.invoiceNo}</Text>
            <Text style={styles.muted}>Date: {formatDate(sale.saleDate)}</Text>
            <Text style={styles.muted}>Due: {formatDate(sale.dueDate)}</Text>
          </View>
        </View>

        {/* Bill To */}
        <View style={styles.billTo}>
          <Text style={styles.billToLabel}>Bill To:</Text>
          <Text style={styles.customerName}>{customer.shopName}</Text>
          {customer.ownerName ? <Text style={styles.muted}>{customer.ownerName}</Text> : null}
          {location ? <Text style={styles.muted}>{location}</Text> : null}
          {customer.phone ? <Text style={styles.muted}>{customer.phone}</Text> : null}
        </View>

        {/* Items table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colNo]}>#</Text>
          <Text style={[styles.th, styles.colProduct]}>Product</Text>
          <Text style={[styles.th, styles.colQty]}>Qty</Text>
          <Text style={[styles.th, styles.colPrice]}>Unit Price</Text>
          <Text style={[styles.th, styles.colDisc]}>Disc%</Text>
          <Text style={[styles.th, styles.colAmount]}>Amount</Text>
        </View>
        {sale.items.map((item, idx) => (
          <View
            key={item.id}
            style={[styles.row, { backgroundColor: idx % 2 === 0 ? "#ffffff" : ALT_ROW }]}
            wrap={false}
          >
            <Text style={styles.colNo}>{idx + 1}</Text>
            <Text style={styles.colProduct}>{item.product.name}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <Text style={styles.colPrice}>{money(item.salePrice)}</Text>
            <Text style={styles.colDisc}>
              {item.discountPct > 0 ? `${item.discountPct}%` : "—"}
            </Text>
            {/* totalAmount already includes the per-item discount — never salePrice × qty */}
            <Text style={styles.colAmount}>{money(item.totalAmount)}</Text>
          </View>
        ))}

        {/* Summary */}
        <View style={styles.summaryWrap} wrap={false}>
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text>Subtotal</Text>
              <Text>{money(sale.subtotal)}</Text>
            </View>
            {sale.discountAmount > 0 ? (
              <View style={styles.summaryRow}>
                <Text>Discount</Text>
                <Text>- {money(sale.discountAmount)}</Text>
              </View>
            ) : null}
            {settings.taxEnabled && sale.taxAmount > 0 ? (
              <View style={styles.summaryRow}>
                <Text>Tax ({settings.taxRate}%)</Text>
                <Text>{money(sale.taxAmount)}</Text>
              </View>
            ) : null}
            <View style={styles.totalRow}>
              <Text style={styles.totalText}>Total</Text>
              <Text style={styles.totalText}>{money(sale.totalAmount)}</Text>
            </View>
          </View>
        </View>

        {/* Payment */}
        <View style={styles.payment} wrap={false}>
          <Text style={styles.paymentTitle}>Payment</Text>
          <View style={styles.summaryRow}>
            <Text>Method</Text>
            <Text>{sale.paidAmount > 0 ? methodLabel(sale.paymentMethod) : "Credit (unpaid)"}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Paid</Text>
            <Text style={{ color: GREEN }}>{money(sale.paidAmount)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Balance Due</Text>
            <Text
              style={{
                fontFamily: "Helvetica-Bold",
                color: balanceDue > 0 ? RED : TEXT,
              }}
            >
              {money(balanceDue)}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.thanks}>Thank you for your business!</Text>
          <Text style={styles.muted}>
            {settings.businessName} · Generated: {formatDate(todayDate())}
          </Text>
        </View>
      </Page>
    </Document>
  );
}