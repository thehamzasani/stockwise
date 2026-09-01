// src/tests/invoiceNumber.test.ts
import { describe, it, expect } from "vitest";
import { calcInvoiceNo } from "@/lib/utils";

describe("calcInvoiceNo", () => {
  it('("INV-", 1) → "INV-0001"', () => {
    expect(calcInvoiceNo("INV-", 1)).toBe("INV-0001");
  });

  it('("INV-", 999) → "INV-0999"', () => {
    expect(calcInvoiceNo("INV-", 999)).toBe("INV-0999");
  });

  it('("INV-", 1000) → "INV-1000" (no truncation beyond 4 digits)', () => {
    expect(calcInvoiceNo("INV-", 1000)).toBe("INV-1000");
  });

  it('("INV-", 10000) → "INV-10000" (5 digits, no truncation)', () => {
    expect(calcInvoiceNo("INV-", 10000)).toBe("INV-10000");
  });

  it('("SO-", 42) → "SO-0042"', () => {
    expect(calcInvoiceNo("SO-", 42)).toBe("SO-0042");
  });

  it('("", 7) → "0007" (empty prefix)', () => {
    expect(calcInvoiceNo("", 7)).toBe("0007");
  });

  it('("PO-", 1) → "PO-0001"', () => {
    expect(calcInvoiceNo("PO-", 1)).toBe("PO-0001");
  });
});