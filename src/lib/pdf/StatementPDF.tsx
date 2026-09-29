// src/lib/pdf/StatementPDF.tsx
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { Customer, LedgerEntry, AppSettings } from "@/types";
import { formatCurrency, formatDate, todayDate } from "@/lib/utils";

const BLUE = "#2563eb";
const RED = "#dc2626";
const GREEN = "#16a34a";
const MUTED = "#6b7280";
const BORDER = "#e4e7ec";
const ALT_ROW = "#f9fafb";

const styles = StyleSheet.create({
  page: { padding: 30, paddingBottom: 60, fontFamily: "Helvetica", fontSize: 9, color: "#111827" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  businessName: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 3 },
  muted: { color: MUTED, fontSize: 9, marginBottom: 2 },
  headerRight: { alignItems: "flex-end" },

  customerBox: { marginBottom: 16 },
  label: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  customerName: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 2 },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: BLUE,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  th: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 8.5 },
  row: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  colDate: { width: "14%" },
  colDesc: { width: "36%" },
  colDebit: { width: "16%", textAlign: "right" },
  colCredit: { width: "16%", textAlign: "right" },
  colBalance: { width: "18%", textAlign: "right" },

  totalRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: "#eff6ff",
    borderTopWidth: 1,
    borderTopColor: "#bfdbfe",
  },
  totalText: { fontFamily: "Helvetica-Bold" },

  outstandingWrap: { alignItems: "flex-end", marginTop: 18 },
  outstandingLabel: { fontSize: 9, color: MUTED, marginBottom: 2 },
  outstandingValue: { fontSize: 20, fontFamily: "Helvetica-Bold" },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
});

interface StatementPDFProps {
  customer: Customer;
  entries: LedgerEntry[];
  settings: AppSettings;
  dateRange: { from: string; to: string };
}

function describeEntry(entry: LedgerEntry): string {
  switch (entry.type) {
    case "return_credit":
      return "Credit note issued";
    case "return_cash":
      return entry.description.startsWith("Refund paid")
        ? entry.description
        : `Refund paid — ${entry.description}`;
    default:
      return entry.description;
  }
}

export default function StatementPDF({
  customer,
  entries,
  settings,
  dateRange,
}: StatementPDFProps) {
  const symbol = settings.currency || "Rs.";
  const money = (n: number) => formatCurrency(n, symbol);
  const cell = (n: number) => (n > 0 ? money(n) : "—");

  const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
  const outstanding = entries.length > 0 ? entries[entries.length - 1].balance : 0;
  const location = [customer.area, customer.city].filter(Boolean).join(", ");

  return (
    <Document
      title={`Statement - ${customer.shopName}`}
      author={settings.businessName}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.businessName}>{settings.businessName}</Text>
            {settings.businessAddress ? (
              <Text style={styles.muted}>{settings.businessAddress}</Text>
            ) : null}
            {settings.businessPhone ? (
              <Text style={styles.muted}>Phone: {settings.businessPhone}</Text>
            ) : null}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>Account Statement</Text>
            <Text style={styles.muted}>
              Period: {formatDate(dateRange.from)} to {formatDate(dateRange.to)}
            </Text>
          </View>
        </View>

        {/* Customer */}
        <View style={styles.customerBox}>
          <Text style={styles.label}>Customer</Text>
          <Text style={styles.customerName}>{customer.shopName}</Text>
          {customer.ownerName ? <Text style={styles.muted}>{customer.ownerName}</Text> : null}
          {location ? <Text style={styles.muted}>{location}</Text> : null}
          {customer.phone ? <Text style={styles.muted}>{customer.phone}</Text> : null}
        </View>

        {/* Table header (repeats on every page) */}
        <View style={styles.tableHeader} fixed>
          <Text style={[styles.th, styles.colDate]}>Date</Text>
          <Text style={[styles.th, styles.colDesc]}>Description</Text>
          <Text style={[styles.th, styles.colDebit]}>Debit ({symbol})</Text>
          <Text style={[styles.th, styles.colCredit]}>Credit ({symbol})</Text>
          <Text style={[styles.th, styles.colBalance]}>Balance ({symbol})</Text>
        </View>

        {entries.map((entry, idx) => (
          <View
            key={`${entry.referenceId}-${idx}`}
            style={[styles.row, { backgroundColor: idx % 2 === 0 ? "#ffffff" : ALT_ROW }]}
            wrap={false}
          >
            <Text style={styles.colDate}>{formatDate(entry.date)}</Text>
            <Text style={styles.colDesc}>
              {entry.type === "opening" ? "Opening balance" : describeEntry(entry)}
            </Text>
            <Text style={styles.colDebit}>{cell(entry.debit)}</Text>
            <Text style={styles.colCredit}>{cell(entry.credit)}</Text>
            <Text style={styles.colBalance}>{money(entry.balance)}</Text>
          </View>
        ))}

        {entries.length === 0 ? (
          <View style={styles.row}>
            <Text style={{ color: MUTED }}>No transactions in this period.</Text>
          </View>
        ) : null}

        {/* Totals */}
        <View style={styles.totalRow} wrap={false}>
          <Text style={[styles.totalText, styles.colDate]} />
          <Text style={[styles.totalText, styles.colDesc]}>Total</Text>
          <Text style={[styles.totalText, styles.colDebit]}>{money(totalDebit)}</Text>
          <Text style={[styles.totalText, styles.colCredit]}>{money(totalCredit)}</Text>
          <Text style={[styles.totalText, styles.colBalance]} />
        </View>

        {/* Outstanding */}
        <View style={styles.outstandingWrap} wrap={false}>
          <Text style={styles.outstandingLabel}>Outstanding Balance</Text>
          <Text
            style={[
              styles.outstandingValue,
              { color: outstanding > 0 ? RED : GREEN },
            ]}
          >
            {money(outstanding)}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.muted}>
            {settings.businessName} · Generated: {formatDate(todayDate())}
          </Text>
          <Text
            style={styles.muted}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}