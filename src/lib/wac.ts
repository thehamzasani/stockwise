// src/lib/wac.ts
// Pure functions — no DB access. Fully unit-testable without mocks.

/**
 * Calculates new Weighted Average Cost when units are received into inventory.
 *
 * WAC IS recalculated when:
 *   - purchase_in          (new stock from supplier at a potentially different price)
 *   - sale_return_in       (sellable goods returning — re-enter inventory at original cost)
 *   - adjustment_add       (manual stock addition treated as receiving)
 *
 * WAC is NOT recalculated when:
 *   - sale_out             (units leave; per-unit cost of remainder is unchanged)
 *   - purchase_return_out  (units leave; per-unit cost unchanged)
 *   - damaged_write_off    (units move to damagedStock; sellable avgCost unchanged)
 *   - adjustment_remove    (units removed; per-unit cost unchanged)
 *   - correction           (count corrected; per-unit cost unchanged)
 *   - opening_stock        (sets avgCost directly = costPrice; does not use this formula)
 *   - sale_cancelled       (stock restored; avgCost unchanged — see Financial Rules §7)
 *   - purchase_cancelled   (stock removed; avgCost unchanged — see Financial Rules §7)
 */
export function calcNewAvgCost(
  currentStock: number,
  currentAvgCost: number,
  incomingQty: number,
  incomingCost: number
): number {
  if (incomingQty <= 0) return currentAvgCost;
  const totalUnits = currentStock + incomingQty;
  // Guard against negative currentStock (should not occur, but prevents NaN)
  if (totalUnits <= 0) return incomingCost;
  return (currentStock * currentAvgCost + incomingQty * incomingCost) / totalUnits;
}

/**
 * Pure credit limit check. Called BEFORE withTransaction() in createSale.
 * Returns { allowed: true } or { allowed: false, message: string }.
 *
 * Rules:
 *   newDebt = 0        → always allowed (fully paid, no credit extended)
 *   creditLimit = 0    → always blocked (cash only; Walk-in always has creditLimit=0)
 *   creditLimit = null → always allowed (unlimited credit)
 *   creditLimit > 0    → allowed only if (currentOutstanding + newDebt) <= creditLimit
 */
export function checkCreditLimit(
  creditLimit: number | null,
  currentOutstanding: number,
  newDebt: number
): { allowed: boolean; message?: string } {
  if (newDebt <= 0) return { allowed: true };
  if (creditLimit === 0) {
    return {
      allowed: false,
      message: "This customer is cash only. Full payment is required.",
    };
  }
  if (creditLimit === null) {
    return { allowed: true };
  }
  const totalAfter = currentOutstanding + newDebt;
  if (totalAfter > creditLimit) {
    const available = Math.max(0, creditLimit - currentOutstanding);
    return {
      allowed: false,
      message: `Credit limit exceeded. Available: Rs. ${available.toFixed(0)}. Limit: Rs. ${creditLimit.toFixed(0)}.`,
    };
  }
  return { allowed: true };
}