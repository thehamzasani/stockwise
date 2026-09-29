// src/components/sales/SaleForm.tsx
import { useState, useEffect, useRef } from "react";
import { Search, Plus, User, AlertCircle } from "lucide-react";
import { useSaleStore } from "@/stores/saleStore";
import { useAppStore } from "@/stores/appStore";
import { getSqlite } from "@/db";
import { createSale } from "@/hooks/useSales";
import { SaleItemRow } from "./SaleItemRow";
import { SaleSummary } from "./SaleSummary";
import { WALKIN_CUSTOMER_ID } from "@/lib/constants";
import { todayDate } from "@/lib/utils";
import { toast } from "sonner";
import type { Customer, Product } from "@/types";
import { notifyLowStock } from "@/lib/notify";
interface SaleFormProps {
  initialCustomerId?: string | null;
  onSuccess: (saleId: string) => void;
  onPrintReady: (saleId: string) => void;
  onCancel: () => void;
}

export function SaleForm({ initialCustomerId, onSuccess, onPrintReady, onCancel }: SaleFormProps) {
  const { settings } = useAppStore();
  const {
    activeSale, addItem, setCustomer, setDiscount, setPaid,
    setPaymentMethod, setNotes, resetSale, getComputedTotals,
  } = useSaleStore();

  const currency = settings?.currency ?? "Rs.";

  // Product search
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const productSearchRef = useRef<HTMLInputElement>(null);

  // Customer search
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Misc
  const [saleDate, setSaleDate] = useState(todayDate());
  const [saving, setSaving] = useState(false);
  const [creditWarning, setCreditWarning] = useState<string | null>(null);

  const { subtotal, total, balanceDue } = getComputedTotals();

  // Auto-focus product search on mount
  useEffect(() => {
    productSearchRef.current?.focus();
  }, []);

  // Initialise customer if passed in (e.g. "New Sale for this Customer")
  useEffect(() => {
    if (!initialCustomerId) return;
    async function loadInitialCustomer() {
      try {
        const sqlite = getSqlite();
        const rows = await sqlite.select<Customer[]>(
          `SELECT id, shop_name as shopName, owner_name as ownerName, phone, city, area, address,
                  business_type as businessType, credit_limit as creditLimit,
                  payment_terms as paymentTerms, discount_group as discountGroup,
                  outstanding_balance as outstandingBalance, notes, cnic,
                  is_active as isActive, created_at as createdAt, updated_at as updatedAt
           FROM customers WHERE id = ? AND id != ?`,
          [initialCustomerId, WALKIN_CUSTOMER_ID]
        );
        if (rows.length > 0) {
          setSelectedCustomer(rows[0]);
          setCustomer(rows[0].id);
          setCustomerSearch(rows[0].shopName);
        }
      } catch { /* silent */ }
    }
    void loadInitialCustomer();
  }, [initialCustomerId, setCustomer]);

  // Product search
  useEffect(() => {
    if (productSearch.length < 1) { setProductResults([]); setProductDropdownOpen(false); return; }
    const timer = setTimeout(async () => {
      try {
        const sqlite = getSqlite();
        const rows = await sqlite.select<Product[]>(
          `SELECT id, name, category, brand, unit, barcode, avg_cost as avgCost,
                  sale_price as salePrice, stock, damaged_stock as damagedStock,
                  min_stock as minStock, description, is_active as isActive,
                  created_at as createdAt, updated_at as updatedAt
           FROM products
           WHERE is_active = 1 AND stock > 0
             AND (name LIKE ? OR category LIKE ? OR barcode LIKE ?)
           ORDER BY name ASC LIMIT 10`,
          [`%${productSearch}%`, `%${productSearch}%`, `%${productSearch}%`]
        );
        setProductResults(rows);
        setProductDropdownOpen(rows.length > 0);
      } catch { /* silent */ }
    }, 200);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // Customer search
  useEffect(() => {
    if (customerSearch.length < 1) { setCustomerResults([]); setCustomerDropdownOpen(false); return; }
    const timer = setTimeout(async () => {
      try {
        const sqlite = getSqlite();
        const rows = await sqlite.select<Customer[]>(
          `SELECT id, shop_name as shopName, owner_name as ownerName, phone, city, area, address,
                  business_type as businessType, credit_limit as creditLimit,
                  payment_terms as paymentTerms, discount_group as discountGroup,
                  outstanding_balance as outstandingBalance, notes, cnic,
                  is_active as isActive, created_at as createdAt, updated_at as updatedAt
           FROM customers
           WHERE is_active = 1 AND id != ?
             AND (shop_name LIKE ? OR owner_name LIKE ? OR phone LIKE ?)
           ORDER BY shop_name ASC LIMIT 10`,
          [WALKIN_CUSTOMER_ID, `%${customerSearch}%`, `%${customerSearch}%`, `%${customerSearch}%`]
        );
        setCustomerResults(rows);
        setCustomerDropdownOpen(rows.length > 0);
      } catch { /* silent */ }
    }, 200);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Credit warning: recalc whenever balanceDue or customer changes
  useEffect(() => {
    if (!selectedCustomer || activeSale.customerId === WALKIN_CUSTOMER_ID) {
      setCreditWarning(null);
      return;
    }
    const { creditLimit, outstandingBalance } = selectedCustomer;
    if (creditLimit === null) { setCreditWarning(null); return; }
    if (creditLimit === 0 && balanceDue > 0) {
      setCreditWarning("This customer is cash only. Full payment required.");
      return;
    }
    if (creditLimit > 0) {
      const totalAfter = outstandingBalance + balanceDue;
      if (totalAfter > creditLimit) {
        const avail = Math.max(0, creditLimit - outstandingBalance);
        setCreditWarning(`Credit limit exceeded. Available: ${currency} ${avail.toFixed(0)} / Limit: ${currency} ${creditLimit.toFixed(0)}.`);
        return;
      }
    }
    setCreditWarning(null);
  }, [selectedCustomer, balanceDue, activeSale.customerId, currency]);

  function selectProduct(product: Product) {
    addItem(product);
    setProductSearch("");
    setProductDropdownOpen(false);
    productSearchRef.current?.focus();
    // Low-stock warning
    if (product.stock <= product.minStock + 1) {
      toast.warning(`Low stock: "${product.name}" only has ${product.stock} left.`);
    }
  }

  function selectCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setCustomer(customer.id);
    setCustomerSearch(customer.shopName);
    setCustomerDropdownOpen(false);
    // Walk-in: auto set paid = total
    if (customer.id === WALKIN_CUSTOMER_ID) {
      const totals = getComputedTotals();
      setPaid(totals.total);
    }
  }

  function selectWalkin() {
    const walkinCustomer: Customer = {
      id: WALKIN_CUSTOMER_ID,
      shopName: "Walk-in Customer",
      ownerName: "Cash Sale",
      phone: null,
      whatsapp: null,
      city: null,
      area: null,
      address: null,
      businessType: "retailer",
      creditLimit: 0,
      paymentTerms: 0,
      discountGroup: "standard",
      outstandingBalance: 0,
      notes: null,
      cnic: null,
      isActive: true,
      createdAt: "",
      updatedAt: "",
    };
    setSelectedCustomer(walkinCustomer);
    setCustomer(WALKIN_CUSTOMER_ID);
    setCustomerSearch("Walk-in / Cash Sale");
    setCustomerDropdownOpen(false);
    // Force paid = total
    const totals = getComputedTotals();
    setPaid(totals.total);
  }

  // Sync Walk-in paid amount when items change
  useEffect(() => {
    if (activeSale.customerId === WALKIN_CUSTOMER_ID) {
      setPaid(total);
    }
  }, [total, activeSale.customerId, setPaid]);

  async function handleSave() {
    if (!activeSale.customerId) { toast.error("Please select a customer."); return; }
    if (activeSale.items.length === 0) { toast.error("Add at least one item."); return; }

    const isWalkin = activeSale.customerId === WALKIN_CUSTOMER_ID;
    const effectivePaid = isWalkin ? total : activeSale.paidAmount;
    const needsPaymentMethod = effectivePaid > 0 || isWalkin;

    if (needsPaymentMethod && !activeSale.paymentMethod) {
      toast.error("Please select a payment method.");
      return;
    }
    if (creditWarning && !isWalkin) {
      toast.error(creditWarning);
      return;
    }

    setSaving(true);
    try {
      const saleId = await createSale({
        customerId: activeSale.customerId,
        items: activeSale.items,
        subtotal,
        discountAmount: activeSale.discountAmount,
        taxAmount: activeSale.taxAmount,
        totalAmount: total,
        paidAmount: effectivePaid,
        paymentMethod: activeSale.paymentMethod,
        notes: activeSale.notes,
        saleDate,
      });
      const soldProductIds = activeSale.items.map((i) => i.product.id);

      toast.success("Sale created successfully.");
      resetSale();
      void notifyLowStock(soldProductIds); // runs after commit, never inside the transaction
      onPrintReady(saleId);
      onSuccess(saleId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create sale.");
    } finally {
      setSaving(false);
    }
  }

  const isWalkin = activeSale.customerId === WALKIN_CUSTOMER_ID;
  const effectivePaid = isWalkin ? total : activeSale.paidAmount;

  return (
    <div className="flex gap-4 h-full">
      {/* ── Left: Items ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">

        {/* Customer selector */}
        <div className="bg-white border border-[#e4e7ec] rounded-lg p-4">
          <label className="text-xs font-medium text-[#374151] mb-1.5 block">Customer *</label>
          <div className="relative">
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af]">
              <User size={14} />
            </div>
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setCustomerDropdownOpen(true); }}
              onFocus={() => { if (customerSearch) setCustomerDropdownOpen(true); }}
              placeholder="Search customer by name or phone…"
              className="w-full h-9 pl-8 pr-3 rounded-[7px] border border-[#e4e7ec] text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
            />

            {customerDropdownOpen && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white border border-[#e4e7ec]
                              rounded-lg shadow-md max-h-60 overflow-y-auto">
                {/* Walk-in always at top */}
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); selectWalkin(); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[#eff6ff] border-b border-[#e4e7ec]"
                >
                  <div className="font-medium text-[#2563eb]">Walk-in / Cash Sale</div>
                  <div className="text-xs text-[#6b7280]">Full payment required — no credit</div>
                </button>
                {customerResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectCustomer(c); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#f9fafb]"
                  >
                    <div className="font-medium text-[#111827]">{c.shopName}</div>
                    <div className="text-xs text-[#6b7280]">
                      {c.ownerName && `${c.ownerName} · `}
                      {c.phone && `${c.phone} · `}
                      Balance: {currency} {c.outstandingBalance.toFixed(0)}
                      {c.creditLimit === 0
                        ? " · Cash only"
                        : c.creditLimit === null
                          ? " · Unlimited credit"
                          : ` · Limit: ${currency} ${c.creditLimit.toFixed(0)}`}
                    </div>
                  </button>
                ))}
                {customerResults.length === 0 && customerSearch.length > 0 && (
                  <div className="px-3 py-2 text-sm text-[#6b7280]">No customers found.</div>
                )}
              </div>
            )}
          </div>

          {/* Credit warning */}
          {creditWarning && (
            <div className="mt-2 flex items-start gap-2 rounded-[7px] bg-[#fee2e2] border border-[#fecaca] px-3 py-2">
              <AlertCircle size={14} className="text-[#dc2626] mt-0.5 shrink-0" />
              <p className="text-xs text-[#dc2626]">{creditWarning}</p>
            </div>
          )}
        </div>

        {/* Product search */}
        <div className="bg-white border border-[#e4e7ec] rounded-lg p-4">
          <label className="text-xs font-medium text-[#374151] mb-1.5 block">Add Products</label>
          <div className="relative">
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af]">
              <Search size={14} />
            </div>
            <input
              ref={productSearchRef}
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              onFocus={() => { if (productSearch && productResults.length > 0) setProductDropdownOpen(true); }}
              placeholder="Search by name, category, or barcode…"
              className="w-full h-9 pl-8 pr-3 rounded-[7px] border border-[#e4e7ec] text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
            />

            {productDropdownOpen && productResults.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white border border-[#e4e7ec]
                              rounded-lg shadow-md max-h-64 overflow-y-auto">
                {productResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectProduct(p); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#f9fafb] border-b border-[#f3f4f6] last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-[#111827]">{p.name}</div>
                        <div className="text-xs text-[#6b7280]">{p.category} · {p.unit}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-[#2563eb]">
                          {currency} {p.salePrice.toFixed(2)}
                        </div>
                        <div className={`text-xs ${p.stock <= p.minStock ? "text-[#dc2626]" : "text-[#6b7280]"}`}>
                          {p.stock} in stock
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Items table */}
        <div className="bg-white border border-[#e4e7ec] rounded-lg overflow-hidden flex-1">
          {activeSale.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#9ca3af]">
              <Plus size={32} className="mb-2 opacity-30" />
              <p className="text-sm">No items added yet</p>
              <p className="text-xs mt-1">Search for products above to add them</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-[#f9fafb] border-b border-[#e4e7ec]">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-[#6b7280]">Product</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-[#6b7280]">Qty</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-[#6b7280]">Unit Price</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-[#6b7280]">Disc%</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-[#6b7280]">Amount</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {activeSale.items.map((item) => (
                  <SaleItemRow key={item.product.id} item={item} currency={currency} />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Notes + Date */}
        <div className="bg-white border border-[#e4e7ec] rounded-lg p-4 flex gap-4">
          <div className="flex-1">
            <label className="text-xs font-medium text-[#374151] mb-1 block">Notes</label>
            <textarea
              value={activeSale.notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes…"
              className="w-full rounded-[7px] border border-[#e4e7ec] px-3 py-2 text-sm resize-none
                         focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
            />
          </div>
          <div className="w-44">
            <label className="text-xs font-medium text-[#374151] mb-1 block">Sale Date</label>
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="w-full h-9 rounded-[7px] border border-[#e4e7ec] px-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* ── Right: Summary ───────────────────────────────────────────────────── */}
      <div className="w-72 flex flex-col gap-4 shrink-0">
        <SaleSummary
          customerId={activeSale.customerId}
          subtotal={subtotal}
          discountAmount={activeSale.discountAmount}
          taxAmount={activeSale.taxAmount}
          total={total}
          paidAmount={effectivePaid}
          balanceDue={isWalkin ? 0 : balanceDue}
          paymentMethod={activeSale.paymentMethod}
          taxEnabled={settings?.taxEnabled ?? false}
          currency={currency}
          onDiscountChange={setDiscount}
          onPaidChange={setPaid}
          onPaymentMethodChange={setPaymentMethod}
        />

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || activeSale.items.length === 0 || !activeSale.customerId}
            className="w-full h-10 rounded-[7px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white
                       text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {saving ? "Saving…" : "Save Sale"}
          </button>
          <button
            type="button"
            onClick={() => { resetSale(); onCancel(); }}
            className="w-full h-9 rounded-[7px] border border-[#e4e7ec] text-sm text-[#374151]
                       hover:bg-[#f9fafb] transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Item count */}
        {activeSale.items.length > 0 && (
          <p className="text-xs text-center text-[#6b7280]">
            {activeSale.items.length} item{activeSale.items.length !== 1 ? "s" : ""} ·{" "}
            {activeSale.items.reduce((s, i) => s + i.quantity, 0)} units
          </p>
        )}
      </div>
    </div>
  );
}