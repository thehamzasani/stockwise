// src/components/purchases/PurchaseForm.tsx
import { useState, useEffect, useRef } from "react";
import { Search, Plus, PackageOpen, AlertCircle, ChevronDown } from "lucide-react";
import { formatCurrency, todayDate } from "@/lib/utils";
import { getSqlite } from "@/db";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { Product, Supplier } from "@/types";
import type { CreatePurchaseInput } from "@/hooks/usePurchases";
import type { PurchaseLineItem } from "./PurchaseItemRow";
import { PurchaseItemRow } from "./PurchaseItemRow";

// import { useState, useEffect, useRef, useCallback } from "react";
// import { Search, Plus, PackageOpen, AlertCircle, ChevronDown } from "lucide-react";
// import { formatCurrency, todayDate, generateId } from "@/lib/utils";
// import { getSqlite } from "@/db";
// import { PAYMENT_METHODS } from "@/lib/constants";
// import type { Product, Supplier } from "@/types";
// import type { CreatePurchaseInput } from "@/hooks/usePurchases";
// import type { PurchaseLineItem } from "./PurchaseItemRow";
// import { PurchaseItemRow } from "./PurchaseItemRow";


interface PurchaseFormProps {
  onSubmit: (input: CreatePurchaseInput) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function PurchaseForm({ onSubmit, onCancel, isSubmitting }: PurchaseFormProps) {
  // Supplier
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  // Items
  const [items, setItems] = useState<PurchaseLineItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const productSearchRef = useRef<HTMLInputElement>(null);

  // Purchase details
  const [invoiceNo, setInvoiceNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayDate());
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load suppliers
  useEffect(() => {
    async function load() {
      try {
        const sqlite = getSqlite();
        const rows = await sqlite.select<{
          id: string; name: string; contact_person: string | null;
          phone: string | null; city: string | null; outstanding_balance: number;
        }[]>(
          "SELECT id, name, contact_person, phone, city, outstanding_balance FROM suppliers WHERE is_active = 1 ORDER BY name ASC"
        );
        setSuppliers(rows.map((r) => ({
          id: r.id, name: r.name, contactPerson: r.contact_person,
          phone: r.phone, city: r.city, address: null, notes: null,
          outstandingBalance: r.outstanding_balance, isActive: true,
          createdAt: "", updatedAt: "",
        })));
      } catch (err) {
        console.error("Failed to load suppliers:", err);
      }
    }
    void load();
  }, []);

  // Product search
  useEffect(() => {
    if (!productSearch.trim()) { setProductResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const sqlite = getSqlite();
        const rows = await sqlite.select<{
          id: string; name: string; category: string; brand: string | null;
          unit: string; barcode: string | null; avg_cost: number; sale_price: number;
          stock: number; damaged_stock: number; min_stock: number;
          description: string | null; is_active: number;
          created_at: string; updated_at: string;
        }[]>(
          `SELECT * FROM products WHERE is_active = 1 AND (name LIKE ? OR barcode LIKE ? OR brand LIKE ?) ORDER BY name ASC LIMIT 10`,
          [`%${productSearch}%`, `%${productSearch}%`, `%${productSearch}%`]
        );
        setProductResults(rows.map((r) => ({
          id: r.id, name: r.name, category: r.category, brand: r.brand,
          unit: r.unit, barcode: r.barcode, avgCost: r.avg_cost,
          salePrice: r.sale_price, stock: r.stock, damagedStock: r.damaged_stock,
          minStock: r.min_stock, description: r.description,
          isActive: r.is_active === 1, createdAt: r.created_at, updatedAt: r.updated_at,
        })));
      } catch (err) {
        console.error("Product search error:", err);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [productSearch]);

  function addProduct(product: Product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) => {
          if (i.product.id !== product.id) return i;
          const quantity = i.quantity + 1;
          return { ...i, quantity, totalCost: quantity * i.costPrice };
        });
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          costPrice: product.avgCost > 0 ? product.avgCost : 0,
          totalCost: product.avgCost > 0 ? product.avgCost : 0,
        },
      ];
    });
    setProductSearch("");
    setProductResults([]);
    setShowProductSearch(false);
    productSearchRef.current?.focus();
  }

  function updateItem(productId: string, updates: Partial<Omit<PurchaseLineItem, "product">>) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.product.id !== productId) return i;
        const updated = { ...i, ...updates };
        updated.totalCost = updated.quantity * updated.costPrice;
        return updated;
      })
    );
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }

  const totalAmount = items.reduce((sum, i) => sum + i.totalCost, 0);
  const balanceDue = Math.max(0, totalAmount - paidAmount);
  const paymentStatus =
    paidAmount >= totalAmount && totalAmount > 0 ? "paid"
    : paidAmount > 0 ? "partial"
    : "unpaid";

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);
  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    (s.city?.toLowerCase().includes(supplierSearch.toLowerCase()) ?? false)
  );

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (items.length === 0) errs.items = "Add at least one item.";
    if (paidAmount < 0) errs.paidAmount = "Paid amount cannot be negative.";
    if (paidAmount > totalAmount) errs.paidAmount = `Cannot exceed total (${formatCurrency(totalAmount)}).`;
    if (items.some((i) => i.costPrice <= 0)) errs.costPrice = "All items must have a cost price > 0.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      supplierId: supplierId || null,
      invoiceNo,
      purchaseDate,
      paymentMethod: paidAmount > 0 ? paymentMethod : null,
      paidAmount,
      notes,
      items: items.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
        costPrice: i.costPrice,
      })),
    });
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
      {/* Top row: Supplier + Invoice details */}
      <div className="grid grid-cols-2 gap-4">
        {/* Supplier selector */}
        <div className="bg-white border border-[#e4e7ec] rounded-lg p-4">
          <h3 className="text-sm font-semibold text-[#111827] mb-3">Supplier (Optional)</h3>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSupplierDropdown(!showSupplierDropdown)}
              className="w-full h-9 rounded-[7px] border border-[#e4e7ec] px-3 text-sm text-left
                         flex items-center justify-between hover:border-[#2563eb] transition-colors"
            >
              <span className={selectedSupplier ? "text-[#111827]" : "text-[#9ca3af]"}>
                {selectedSupplier ? selectedSupplier.name : "No supplier (cash/direct)"}
              </span>
              <ChevronDown size={14} className="text-[#6b7280]" />
            </button>

            {showSupplierDropdown && (
              <div className="absolute top-full mt-1 left-0 right-0 z-20 bg-white border border-[#e4e7ec]
                              rounded-lg shadow-lg overflow-hidden">
                <div className="p-2 border-b border-[#e4e7ec]">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search suppliers…"
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    className="w-full h-8 rounded-[7px] border border-[#e4e7ec] px-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => { setSupplierId(""); setShowSupplierDropdown(false); setSupplierSearch(""); }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-[#f9fafb] text-[#6b7280]"
                  >
                    No supplier (cash/direct)
                  </button>
                  {filteredSuppliers.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setSupplierId(s.id); setShowSupplierDropdown(false); setSupplierSearch(""); }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-[#f9fafb] border-t border-[#f3f4f6]"
                    >
                      <div className="font-medium text-[#111827]">{s.name}</div>
                      {s.city && <div className="text-xs text-[#6b7280]">{s.city}</div>}
                      {s.outstandingBalance > 0 && (
                        <div className="text-xs text-[#d97706]">
                          Owing: {formatCurrency(s.outstandingBalance)}
                        </div>
                      )}
                    </button>
                  ))}
                  {filteredSuppliers.length === 0 && (
                    <div className="px-3 py-4 text-sm text-[#6b7280] text-center">No suppliers found</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {selectedSupplier && (
            <div className="mt-2 p-2 bg-[#eff6ff] rounded-[7px] text-xs text-[#1e40af]">
              {selectedSupplier.phone && <div>📞 {selectedSupplier.phone}</div>}
              {selectedSupplier.city && <div>📍 {selectedSupplier.city}</div>}
              {selectedSupplier.outstandingBalance > 0 && (
                <div className="text-[#d97706] font-medium">
                  Outstanding: {formatCurrency(selectedSupplier.outstandingBalance)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Purchase details */}
        <div className="bg-white border border-[#e4e7ec] rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[#111827]">Purchase Details</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">
                Supplier Invoice # <span className="text-[#9ca3af] font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="e.g. SI-1234"
                className="w-full h-9 rounded-[7px] border border-[#e4e7ec] px-3 text-sm
                           focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">Purchase Date</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full h-9 rounded-[7px] border border-[#e4e7ec] px-3 text-sm
                           focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes…"
              className="w-full h-9 rounded-[7px] border border-[#e4e7ec] px-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Items section */}
      <div className="bg-white border border-[#e4e7ec] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e4e7ec] bg-[#f9fafb]">
          <h3 className="text-sm font-semibold text-[#111827]">Items</h3>
          <button
            type="button"
            onClick={() => { setShowProductSearch(true); setTimeout(() => productSearchRef.current?.focus(), 50); }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-[7px] bg-[#2563eb] text-white
                       text-xs font-medium hover:bg-[#1d4ed8] transition-colors"
          >
            <Plus size={13} />
            Add Product
          </button>
        </div>

        {/* Product search bar */}
        {showProductSearch && (
          <div className="p-3 border-b border-[#e4e7ec] bg-[#eff6ff] relative">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b7280]" />
              <input
                ref={productSearchRef}
                type="text"
                placeholder="Search products by name, barcode, or brand…"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                onBlur={() => { if (!productSearch) setShowProductSearch(false); }}
                className="w-full h-9 rounded-[7px] border border-[#bfdbfe] pl-8 pr-3 text-sm
                           focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent bg-white"
              />
            </div>
            {productResults.length > 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 z-20 bg-white border border-[#e4e7ec]
                              rounded-lg shadow-lg overflow-hidden">
                {productResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={() => addProduct(p)}
                    className="w-full px-3 py-2.5 text-sm text-left hover:bg-[#eff6ff] border-b border-[#f3f4f6]
                               flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-[#111827]">{p.name}</div>
                      <div className="text-xs text-[#6b7280]">
                        {p.category} {p.brand ? `· ${p.brand}` : ""} · Stock: {p.stock} {p.unit}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-xs text-[#6b7280]">Avg Cost</div>
                      <div className="text-sm font-medium text-[#111827]">
                        {formatCurrency(p.avgCost)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Items table */}
        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f9fafb] border-b border-[#e4e7ec]">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-[#6b7280] w-8">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-[#6b7280]">Product</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-[#6b7280]">In Stock</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-[#6b7280] w-24">Qty</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-[#6b7280] w-32">Cost Price</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-[#6b7280]">Total</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <PurchaseItemRow
                    key={item.product.id}
                    item={item}
                    index={idx}
                    onUpdate={updateItem}
                    onRemove={removeItem}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 text-center">
            <PackageOpen size={36} className="mx-auto mb-2 text-[#d1d5db]" />
            <p className="text-sm text-[#6b7280]">No items added yet</p>
            <p className="text-xs text-[#9ca3af]">Click "Add Product" to search for products</p>
          </div>
        )}

        {errors.items && (
          <div className="px-4 py-2 bg-[#fee2e2] text-[#dc2626] text-xs flex items-center gap-1.5">
            <AlertCircle size={12} /> {errors.items}
          </div>
        )}
      </div>

      {/* Payment + Summary */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {/* Payment */}
          <div className="bg-white border border-[#e4e7ec] rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[#111827]">Payment</h3>

            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">Amount Paid Now</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#6b7280]">Rs.</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={totalAmount}
                  value={paidAmount || ""}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full h-9 rounded-[7px] border border-[#e4e7ec] pl-9 pr-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
                />
              </div>
              {errors.paidAmount && (
                <p className="text-xs text-[#dc2626] mt-1">{errors.paidAmount}</p>
              )}
            </div>

            {paidAmount > 0 && (
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setPaymentMethod(m.value)}
                      className={`h-9 rounded-[7px] text-xs font-medium border transition-colors ${
                        paymentMethod === m.value
                          ? "bg-[#2563eb] text-white border-[#2563eb]"
                          : "border-[#e4e7ec] text-[#374151] hover:border-[#2563eb] hover:text-[#2563eb]"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPaidAmount(totalAmount)}
                className="flex-1 h-8 rounded-[7px] border border-[#2563eb] text-[#2563eb]
                           text-xs font-medium hover:bg-[#eff6ff] transition-colors"
              >
                Pay Full
              </button>
              <button
                type="button"
                onClick={() => setPaidAmount(0)}
                className="flex-1 h-8 rounded-[7px] border border-[#e4e7ec] text-[#6b7280]
                           text-xs font-medium hover:bg-[#f9fafb] transition-colors"
              >
                Pay Later
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white border border-[#e4e7ec] rounded-lg p-4">
            <h3 className="text-sm font-semibold text-[#111827] mb-3">Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#6b7280]">Items ({items.reduce((s, i) => s + i.quantity, 0)})</span>
                <span className="text-[#111827]">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6b7280]">Paid Now</span>
                <span className="text-[#16a34a] font-medium">{formatCurrency(paidAmount)}</span>
              </div>
              {balanceDue > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[#6b7280]">Balance Due</span>
                  <span className="text-[#dc2626] font-medium">{formatCurrency(balanceDue)}</span>
                </div>
              )}
              <div className="border-t border-[#e4e7ec] pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-sm font-semibold text-[#111827]">Total</span>
                  <span className="text-base font-bold text-[#2563eb]">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
              <div className="pt-1">
                <span
                  className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                    paymentStatus === "paid"
                      ? "bg-[#dcfce7] text-[#16a34a]"
                      : paymentStatus === "partial"
                      ? "bg-[#fef3c7] text-[#d97706]"
                      : "bg-[#fee2e2] text-[#dc2626]"
                  }`}
                >
                  {paymentStatus === "paid" ? "Fully Paid"
                    : paymentStatus === "partial" ? "Partial Payment"
                    : "Unpaid — to be paid later"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="h-9 px-5 rounded-[7px] border border-[#e4e7ec] text-sm font-medium
                     text-[#374151] hover:bg-[#f9fafb] disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || items.length === 0}
          className="h-9 px-6 rounded-[7px] bg-[#2563eb] text-white text-sm font-medium
                     hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? "Saving…" : "Save Purchase"}
        </button>
      </div>
    </form>
  );
}