// src/stores/saleStore.ts
import { create } from "zustand";
import type { ActiveSale, SaleLineItem, Product, PaymentMethod } from "@/types";

interface SaleState {
  activeSale: ActiveSale;
  addItem: (product: Product) => void;
  updateItem: (
    productId: string,
    updates: Partial<Omit<SaleLineItem, "product">>
  ) => void;
  removeItem: (productId: string) => void;
  setCustomer: (id: string | null) => void;
  setDiscount: (amount: number) => void;
  setPaid: (amount: number) => void;
  setPaymentMethod: (mode: PaymentMethod | null) => void;
  setNotes: (notes: string) => void;
  resetSale: () => void;
  getComputedTotals: () => {
    subtotal: number;
    total: number;
    profit: number;
    balanceDue: number;
  };
}

const emptyState: ActiveSale = {
  customerId: null,
  items: [],
  discountAmount: 0,
  taxAmount: 0,
  paidAmount: 0,
  paymentMethod: null,
  notes: "",
};

function calcItemTotal(item: SaleLineItem): number {
  return item.salePrice * (1 - item.discountPct / 100) * item.quantity;
}

export const useSaleStore = create<SaleState>()((set, get) => ({
  activeSale: emptyState,

  addItem: (product) =>
    set((s) => {
      const existing = s.activeSale.items.find(
        (i) => i.product.id === product.id
      );
      if (existing) {
        return {
          activeSale: {
            ...s.activeSale,
            items: s.activeSale.items.map((i) => {
              if (i.product.id !== product.id) return i;
              const updated = { ...i, quantity: i.quantity + 1 };
              return { ...updated, totalAmount: calcItemTotal(updated) };
            }),
          },
        };
      }
      // costPrice snapshotted from product.avgCost at add-time — IMMUTABLE after this point.
      const newItem: SaleLineItem = {
        product,
        quantity: 1,
        salePrice: product.salePrice,
        costPrice: product.avgCost, // snapshot at add-time
        discountPct: 0,
        totalAmount: product.salePrice,
      };
      return {
        activeSale: {
          ...s.activeSale,
          items: [...s.activeSale.items, newItem],
        },
      };
    }),

  updateItem: (productId, updates) =>
    set((s) => ({
      activeSale: {
        ...s.activeSale,
        items: s.activeSale.items.map((i) => {
          if (i.product.id !== productId) return i;
          const updated = { ...i, ...updates };
          return { ...updated, totalAmount: calcItemTotal(updated) };
        }),
      },
    })),

  removeItem: (productId) =>
    set((s) => ({
      activeSale: {
        ...s.activeSale,
        items: s.activeSale.items.filter((i) => i.product.id !== productId),
      },
    })),

  setCustomer: (id) =>
    set((s) => ({ activeSale: { ...s.activeSale, customerId: id } })),

  setDiscount: (amt) =>
    set((s) => ({ activeSale: { ...s.activeSale, discountAmount: amt } })),

  setPaid: (amt) =>
    set((s) => ({ activeSale: { ...s.activeSale, paidAmount: amt } })),

  setPaymentMethod: (mode) =>
    set((s) => ({ activeSale: { ...s.activeSale, paymentMethod: mode } })),

  setNotes: (n) =>
    set((s) => ({ activeSale: { ...s.activeSale, notes: n } })),

  resetSale: () => set({ activeSale: emptyState }),

  getComputedTotals: () => {
    const { activeSale } = get();
    const subtotal = activeSale.items.reduce((sum, i) => sum + i.totalAmount, 0);
    const total = subtotal - activeSale.discountAmount + activeSale.taxAmount;
    const profit = activeSale.items.reduce(
      (sum, i) =>
        sum +
        (i.salePrice * (1 - i.discountPct / 100) - i.costPrice) * i.quantity,
      0
    );
    const balanceDue = Math.max(0, total - activeSale.paidAmount);
    return { subtotal, total, profit, balanceDue };
  },
}));