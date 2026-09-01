// src/tests/creditLimit.test.ts
import { describe, it, expect } from "vitest";
import { checkCreditLimit } from "@/lib/wac";

describe("checkCreditLimit", () => {
  it("creditLimit=0, newDebt>0 → blocked (cash only)", () => {
    const result = checkCreditLimit(0, 0, 100);
    expect(result.allowed).toBe(false);
    expect(result.message).toContain("cash only");
  });

  it("creditLimit=0, newDebt=0 → allowed (fully paid, no credit extended)", () => {
    const result = checkCreditLimit(0, 0, 0);
    expect(result.allowed).toBe(true);
  });

  it("creditLimit=0, newDebt=0, outstanding>0 → allowed (paying existing balance)", () => {
    const result = checkCreditLimit(0, 5000, 0);
    expect(result.allowed).toBe(true);
  });

  it("creditLimit=null → always allowed (unlimited credit)", () => {
    const result = checkCreditLimit(null, 999999, 999999);
    expect(result.allowed).toBe(true);
  });

  it("creditLimit=null, newDebt=0 → allowed", () => {
    const result = checkCreditLimit(null, 0, 0);
    expect(result.allowed).toBe(true);
  });

  it("under limit → allowed", () => {
    // outstanding=2000, limit=5000, newDebt=1000 → totalAfter=3000 ≤ 5000
    const result = checkCreditLimit(5000, 2000, 1000);
    expect(result.allowed).toBe(true);
  });

  it("exactly at limit → allowed", () => {
    // outstanding=3000, limit=5000, newDebt=2000 → totalAfter=5000 ≤ 5000
    const result = checkCreditLimit(5000, 3000, 2000);
    expect(result.allowed).toBe(true);
  });

  it("over limit by 1 → blocked", () => {
    // outstanding=3000, limit=5000, newDebt=2001 → totalAfter=5001 > 5000
    const result = checkCreditLimit(5000, 3000, 2001);
    expect(result.allowed).toBe(false);
    expect(result.message).toContain("Credit limit exceeded");
  });

  it("available credit shown in error message", () => {
    // outstanding=4500, limit=5000, newDebt=600 → available=500
    const result = checkCreditLimit(5000, 4500, 600);
    expect(result.allowed).toBe(false);
    expect(result.message).toContain("500");
  });

  it("zero outstanding, newDebt within limit → allowed", () => {
    const result = checkCreditLimit(10000, 0, 9999);
    expect(result.allowed).toBe(true);
  });

  it("zero outstanding, newDebt exactly equals limit → allowed", () => {
    const result = checkCreditLimit(10000, 0, 10000);
    expect(result.allowed).toBe(true);
  });

  it("zero outstanding, newDebt exceeds limit → blocked", () => {
    const result = checkCreditLimit(10000, 0, 10001);
    expect(result.allowed).toBe(false);
  });
});