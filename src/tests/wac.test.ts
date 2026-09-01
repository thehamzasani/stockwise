// src/tests/wac.test.ts
import { describe, it, expect } from "vitest";
import { calcNewAvgCost } from "@/lib/wac";

describe("calcNewAvgCost", () => {
  it("first purchase into empty stock sets avgCost to incoming cost", () => {
    const result = calcNewAvgCost(0, 0, 100, 5);
    expect(result).toBe(5);
  });

  it("standard WAC calculation", () => {
    // stock=100 @ avg=5, buy 50 @ 8
    // (100*5 + 50*8) / 150 = (500 + 400) / 150 = 900/150 = 6
    const result = calcNewAvgCost(100, 5, 50, 8);
    expect(result).toBeCloseTo(6, 10);
  });

  it("same price purchase leaves avgCost unchanged", () => {
    const result = calcNewAvgCost(100, 5, 50, 5);
    expect(result).toBe(5);
  });

  it("incomingQty of 0 returns currentAvgCost unchanged", () => {
    const result = calcNewAvgCost(100, 5.75, 0, 10);
    expect(result).toBe(5.75);
  });

  it("negative currentStock guard: returns incomingCost when totalUnits <= 0", () => {
    // currentStock=-50, incomingQty=30 → totalUnits=-20 → guard fires → returns incomingCost
    const result = calcNewAvgCost(-50, 5, 30, 8);
    expect(result).toBe(8);
  });

  it("large purchase dominates the average", () => {
    // stock=10 @ avg=100, buy 990 @ 10
    // (10*100 + 990*10) / 1000 = (1000 + 9900) / 1000 = 10.9
    const result = calcNewAvgCost(10, 100, 990, 10);
    expect(result).toBeCloseTo(10.9, 10);
  });
});